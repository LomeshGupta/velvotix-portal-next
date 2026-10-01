import { z } from "zod";

import { handler, audit, STAFF_WRITE } from "@/lib/api";
import { SUPPORT_VIEW } from "@/lib/roles";
import type { Row } from "@/lib/schema";
import { industryOk, productNames, productsCsv } from "@/lib/contractMeta";
import { notify } from "@/lib/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Support Contract request schema
 */
const body = z.object({
  customerId: z.string().min(1, "Customer is required"),

  contractNumber: z.string().trim().min(1, "Contract number is required"),

  type: z.string().trim().min(1, "Contract type is required"),

  startDate: z.string().trim().min(1, "Start date is required"),

  endDate: z.string().trim().min(1, "End date is required"),

  billingFrequency: z.string().trim().optional(),

  amount: z.number().min(0, "Amount cannot be negative"),

  tax: z.number().min(0, "Tax cannot be negative"),

  supportHours: z.number().min(0, "Support hours cannot be negative"),

  sla: z.string().trim().optional(),

  prioritySupport: z.boolean().optional(),

  notes: z.string().trim().optional(),

  industry: z.string().trim().optional().refine(industryOk, "Unknown industry"),

  products: z.array(z.string()).optional(),
});

/**
 * Calculate contract status from end date.
 */
const getContractStatus = (
  endDate: string,
  warningDays: number,
): "Expired" | "Expiring" | "Active" => {
  const end = new Date(endDate);

  if (Number.isNaN(end.getTime())) {
    return "Expired";
  }

  const daysRemaining = (end.getTime() - Date.now()) / 86400000;

  if (daysRemaining < 0) {
    return "Expired";
  }

  if (daysRemaining <= warningDays) {
    return "Expiring";
  }

  return "Active";
};

/**
 * GET /api/contracts
 *
 * STAFF:
 *   Returns all contracts.
 *
 * CUSTOMER:
 *   Returns only contracts belonging to the logged-in customer.
 */
export const GET = handler([...SUPPORT_VIEW, "CUSTOMER"], async ({ db, auth, req }) => {
  const settings = await db.list("Settings");

  const configuredWarningDays = settings.find(
    (setting) => setting.key === "contractWarnDays",
  )?.value;

  const warningDays = Number(configuredWarningDays || 30);

  const safeWarningDays =
    Number.isFinite(warningDays) && warningDays >= 0 ? warningDays : 30;

  let rows = await db.list("SupportContracts");

  /**
   * Customers can only see their own contracts.
   */
  if (auth.role === "CUSTOMER") {
    if (!auth.customerId) {
      return {
        total: 0,
        rows: [],
      };
    }

    rows = rows.filter((row) => row.customerId === auth.customerId);
  }

  /** Optional filter used by the ticket / customer screens (additive, existing callers are unaffected). */
  const onlyCustomer = new URL(req.url).searchParams.get("customerId");
  if (onlyCustomer && auth.role !== "CUSTOMER") {
    rows = rows.filter((row) => row.customerId === onlyCustomer);
  }

  const master = await db.list("Products");

  /** Milestone invoicing: sum the % and amount already invoiced against each contract (invoices that set milestonePercent; manual phase-completion invoices don't set it and are not counted). */
  const invoices = await db.list("Invoices");
  const invoicedFor = (contractId: string) => invoices.filter(i => i.contractId === contractId && i.status !== "Cancelled" && Number(i.milestonePercent || 0) > 0)
    .reduce((a, i) => ({ pct: a.pct + Number(i.milestonePercent || 0), amt: a.amt + Number(i.grandTotal || 0) }), { pct: 0, amt: 0 });

  /**
   * Don't dynamically overwrite Draft/Cancelled.
   * All other contracts get a calculated status.
   */
  const result: Row[] = rows.map((row): Row => {
    if (row.status === "Draft" || row.status === "Cancelled") {
      return row;
    }

    return {
      ...row,
      status: getContractStatus(row.endDate, safeWarningDays),
    };
  }).map((row) => {
    const inv = invoicedFor(row.id);
    const remainingPercent = Math.max(0, Math.round((100 - inv.pct) * 100) / 100);
    return { ...row, industry: row.industry || "", products: row.products || "", productNames: productNames(master, row.products),
      invoicedPercent: String(Math.min(100, inv.pct)), invoicedAmount: String(inv.amt), remainingPercent: String(remainingPercent),
      remainingAmount: String(Math.max(0, Math.round((Number(row.total || 0) * remainingPercent) / 100 * 100) / 100)) };
  });

  /**
   * Staff also get customer names + a small customer list in the same response,
   * so the contracts screen needs only one request.
   */
  if (auth.role === "CUSTOMER") {
    return { total: result.length, rows: result };
  }

  const customers = await db.list("Customers");
  const names = new Map(customers.map((customer) => [customer.id, customer.companyName]));

  return {
    total: result.length,
    rows: result.map((row) => ({ ...row, customerName: names.get(row.customerId) || row.customerId })),
    customers: customers.map((customer) => ({ id: customer.id, companyName: customer.companyName })),
  };
});

/**
 * POST /api/contracts
 *
 * Creates a new support contract.
 */
export const POST = handler(STAFF_WRITE, async (c) => {
  const payload = await c.req.json();

  const parsed = body.safeParse(payload);

  if (!parsed.success) {
    return Response.json(
      {
        message: "Validation failed.",
        issues: parsed.error.issues,
      },
      {
        status: 400,
      },
    );
  }

  const b = parsed.data;

  const productIds = await productsCsv(c.db, b.products);

  if (productIds === null) {
    return Response.json(
      { message: "One or more selected products / services do not exist." },
      { status: 400 },
    );
  }

  /**
   * Prevent invalid date ranges.
   */
  const startDate = new Date(b.startDate);
  const endDate = new Date(b.endDate);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return Response.json(
      {
        message: "Invalid contract start or end date.",
      },
      {
        status: 400,
      },
    );
  }

  if (endDate < startDate) {
    return Response.json(
      {
        message: "Contract end date cannot be before start date.",
      },
      {
        status: 400,
      },
    );
  }

  /**
   * Verify customer exists.
   */
  const customers = await c.db.list("Customers");

  const customerExists = customers.some(
    (customer) => customer.id === b.customerId,
  );

  if (!customerExists) {
    return Response.json(
      {
        message: "Customer not found.",
      },
      {
        status: 404,
      },
    );
  }

  /**
   * Prevent duplicate contract numbers.
   */
  const existingContracts = await c.db.list("SupportContracts");

  const duplicate = existingContracts.some(
    (contract) =>
      String(contract.contractNumber).trim().toLowerCase() ===
      b.contractNumber.trim().toLowerCase(),
  );

  if (duplicate) {
    return Response.json(
      {
        message: "A contract with this contract number already exists.",
      },
      {
        status: 409,
      },
    );
  }

  /**
   * Calculate totals.
   */
  const total = b.amount + b.tax;

  const contract = await c.db.insert("SupportContracts", {
    customerId: b.customerId,

    contractNumber: b.contractNumber.trim(),

    type: b.type.trim(),

    startDate: b.startDate,

    endDate: b.endDate,

    billingFrequency: b.billingFrequency?.trim() || "",

    amount: String(b.amount),

    tax: String(b.tax),

    total: String(total),

    supportHours: String(b.supportHours),

    usedHours: "0",

    remainingHours: String(b.supportHours),

    sla: b.sla?.trim() || "",

    prioritySupport: String(Boolean(b.prioritySupport)),

    notes: b.notes?.trim() || "",

    status: "Active",

    renewalDate: b.endDate,

    createdAt: new Date().toISOString(),

    createdBy: c.auth.uid,

    industry: b.industry || "",

    products: productIds,
  });

  await notify(c.db, { customerId: b.customerId }, { type: "CONTRACT", title: `New support contract ${contract.contractNumber}`, body: `${b.type}, ${b.supportHours} hours, valid till ${b.endDate}`, link: "/portal/tickets" }, { except: c.auth.uid });
  await audit(c, "CREATE", "SupportContracts", contract.id);

  return Response.json(contract, {
    status: 201,
  });
});
