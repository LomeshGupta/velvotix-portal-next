import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { createStore, DemoStore, Store } from "./store";
import { calcInvoice } from "./gst";
export type Auth = { uid: string; role: string; customerId: string };
type RowWithId = { id: string; [key: string]: string | undefined };
export const SECRET = (): string => {
  const secret =
    process.env.JWT_SECRET ||
    (process.env.NODE_ENV !== "production" ? "dev-only-insecure-secret" : "");
  if (!secret) {
    throw new Error("JWT_SECRET is required");
  }
  return secret;
};
export const STAFF = [
  "SUPER_ADMIN",
  "ADMIN",
  "SUPPORT",
  "ACCOUNTS",
  "SALES",
] as const;
export const STAFF_WRITE = ["SUPER_ADMIN", "ADMIN", "SALES"] as const;
/** * Seed default users and customer. */ async function seed(
  s: Store,
): Promise<void> {
  const users = await s.list("Users");
  if (users.length) {
    return;
  }
  const base = {
    active: "true",
    createdAt: new Date().toISOString(),
    isSeed: "SEED-DEV-DATA",
  };
  const hashPassword = (password: string): Promise<string> =>
    bcrypt.hash(password, 10);
  await s.insert("Users", {
    ...base,
    name: "Seed Admin",
    email: "admin@velvotix.local",
    passwordHash: await hashPassword("Admin@12345"),
    role: "SUPER_ADMIN",
  });
  await s.insert("Users", {
    ...base,
    name: "Seed Support",
    email: "support@velvotix.local",
    passwordHash: await hashPassword("Support@12345"),
    role: "SUPPORT",
  });
  const customer = await s.insert("Customers", {
    companyName: "Seed Customer Pvt Ltd (DEV)",
    type: "B2B",
    email: "client@example.com",
    cin: "U74999HR2020PTC000001",
    status: "Active",
    state: "Haryana",
    country: "India",
  });
  await s.insert("Users", {
    ...base,
    name: "Seed Client",
    email: "client@example.com",
    passwordHash: await hashPassword("Client@12345"),
    role: "CUSTOMER",
    customerId: customer.id,
  });
}
/** * Dummy data for DEMO mode only. */ async function seedDemo(
  s: Store,
): Promise<void> {
  const now = new Date().toISOString();
  const day = (n: number): string =>
    new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
  await s.insert("Company", {
    id: "COMPANY",
    name: "Velvotix Solutions",
    legalName: "Velvotix Solutions Pvt Ltd (DEMO)",
    state: "Haryana",
    country: "India",
    invoicePrefix: "INV",
    cin: "U74999HR2020PTC000000",
  });
  const customers = await s.list("Customers");
  if (!customers.length) {
    throw new Error("Unable to seed demo data: no customer exists.");
  }
  /** * Store rows are dynamically typed, so normalize the * customer before passing it to helpers requiring an ID. */ const c1 =
    customers[0] as unknown as RowWithId;
  const c2 = (await s.insert("Customers", {
    companyName: "Demo Traders LLP (DEV)",
    type: "B2B",
    email: "demo2@example.com",
    state: "Maharashtra",
    gstin: "DEMO27AAAAA0000A1Z5",
    cin: "U51909MH2019PTC000002",
    status: "Active",
    customerSince: day(-200),
  })) as RowWithId;
  const contractCustomers: Array<[RowWithId, string]> = [
    [c1, "CN-DEMO-1"],
    [c2, "CN-DEMO-2"],
  ];
  for (const [customer, contractNumber] of contractCustomers) {
    await s.insert("SupportContracts", {
      customerId: customer.id,
      contractNumber,
      type: "AMC",
      startDate: day(-300),
      endDate: day(contractNumber === "CN-DEMO-1" ? 20 : 200),
      amount: "100000",
      tax: "18000",
      total: "118000",
      supportHours: "100",
      usedHours: "20",
      remainingHours: "80",
      status: "Active",
    });
  }
  /** * Create demo ticket. */ const createTicket = async (
    customer: RowWithId,
    subject: string,
    priority: string,
    ticketStatus: string,
  ) => {
    const ticket = await s.insert("Tickets", {
      customerId: customer.id,
      subject,
      description: `${subject} - demo ticket`,
      category: "Business Central",
      priority,
      status: ticketStatus,
      createdAt: now,
      updatedAt: now,
    });
    await s.update("Tickets", ticket.id, { number: ticket.id });
    await s.insert("TicketActivities", {
      ticketId: ticket.id,
      type: "Ticket created",
      detail: subject,
      createdAt: now,
    });
    return ticket;
  };
  const t1 = await createTicket(
    c1,
    "Posting error in Sales Invoice",
    "High",
    "Open",
  );
  await createTicket(c1, "Need new report layout", "Low", "In Progress");
  await createTicket(c2, "Integration sync failing", "Critical", "Assigned");
  await s.insert("TicketMessages", {
    ticketId: t1.id,
    senderType: "CUSTOMER",
    message: "Getting an error when posting.",
    messageType: "REPLY",
    isInternal: "false",
    createdAt: now,
  });
  await s.insert("TicketMessages", {
    ticketId: t1.id,
    senderType: "STAFF",
    message: "Internal: check dimension setup.",
    messageType: "NOTE",
    isInternal: "true",
    createdAt: now,
  });
  const supportUser = (await s.list("Users")).find(
    (user) => user.email === "support@velvotix.local",
  );
  if (!supportUser) {
    throw new Error("Unable to seed demo data: support user not found.");
  }
  await s.update("Tickets", t1.id, {
    assignedTo: supportUser.id,
    status: "Assigned",
  });
  for (const customer of [c1, c2]) {
    await s.insert("HoursLedger", {
      customerId: customer.id,
      type: "ADD",
      hours: "40",
      validTill: day(90),
      note: "Annual support pack (DEMO)",
      createdBy: "seed",
      createdAt: now,
    });
    await s.insert("HoursLedger", {
      customerId: customer.id,
      type: "USE",
      hours: "6.5",
      note: "Earlier work (DEMO)",
      createdBy: "seed",
      createdAt: now,
    });
  }
  await s.insert("HourRequests", {
    customerId: c1.id,
    ticketId: t1.id,
    requestedBy: supportUser.id,
    hours: "3",
    reason: "Investigation and fix of posting error",
    status: "Pending",
    createdAt: now,
  });
  /** * Create demo invoice. */ const createInvoice = async (
    customer: RowWithId,
    place: string,
    rate: number,
    paid: number,
    date: string,
  ) => {
    const isSameState = place.toLowerCase() === "haryana";
    const invoiceCalculation = calcInvoice(
      [
        {
          description: "Support services",
          hsnSac: "998313",
          qty: 1,
          rate,
          taxPercent: 18,
        },
      ],
      isSameState,
    );
    const invoiceStatus =
      paid >= invoiceCalculation.grandTotal
        ? "Paid"
        : paid > 0
          ? "Partially Paid"
          : "Issued";
    const invoice = await s.insert("Invoices", {
      customerId: customer.id,
      date,
      dueDate: date,
      placeOfSupply: place,
      gstin: customer.gstin || "",
      status: invoiceStatus,
      subtotal: String(invoiceCalculation.subtotal),
      discount: "0",
      taxable: String(invoiceCalculation.taxable),
      cgst: String(invoiceCalculation.cgst),
      sgst: String(invoiceCalculation.sgst),
      igst: String(invoiceCalculation.igst),
      roundOff: String(invoiceCalculation.roundOff),
      grandTotal: String(invoiceCalculation.grandTotal),
      amountPaid: String(paid),
      balanceDue: String(invoiceCalculation.grandTotal - paid),
    });
    await s.update("Invoices", invoice.id, { number: invoice.id });
    for (const line of invoiceCalculation.lines) {
      await s.insert("InvoiceItems", {
        invoiceId: invoice.id,
        description: line.description,
        hsnSac: line.hsnSac,
        qty: "1",
        rate: String(line.rate),
        discount: "0",
        taxPercent: "18",
        taxable: String(line.taxable),
        cgst: String(line.cgst),
        sgst: String(line.sgst),
        igst: String(line.igst),
        lineTotal: String(line.lineTotal),
      });
    }
    if (paid > 0) {
      await s.insert("Payments", {
        invoiceId: invoice.id,
        customerId: customer.id,
        date,
        amount: String(paid),
        mode: "Bank Transfer",
        reference: "DEMO-REF",
      });
    }
  };
  await createInvoice(c1, "Haryana", 50000, 59000, day(-60));
  await createInvoice(c1, "Haryana", 30000, 10000, day(-20));
  await createInvoice(c2, "Maharashtra", 80000, 0, day(-5));
}
/** * Global database singleton. */ type GlobalDB = { __db?: Promise<Store> };
const g = globalThis as unknown as GlobalDB;
/** * Lazy, once-per-process initialization. */ export const db =
  (): Promise<Store> => {
    if (!g.__db) {
      g.__db = (async (): Promise<Store> => {
        const store = createStore();
        await store.init();
        await seed(store);
        if (store instanceof DemoStore) {
          await seedDemo(store);
        }
        return store;
      })().catch((error) => {
        g.__db = undefined;
        throw error;
      });
    }
    return g.__db;
  };
type Ctx = {
  db: Store;
  auth: Auth;
  req: Request;
  params: Record<string, string>;
};
/** * Authentication / authorization wrapper. * * roles === null * Public endpoint. * * roles === [] * Any authenticated user. * * roles === [...] * Only the listed roles. */ export const handler =

    (roles: readonly string[] | null, fn: (context: Ctx) => Promise<unknown>) =>
    async (
      req: Request,
      ctx: { params?: Promise<Record<string, string>> | Record<string, string> },
    ): Promise<Response> => {
      try {
        let auth: Auth | undefined;
        if (roles !== null) {
          try {
            /** * Next.js 15/16: * cookies() is asynchronous. */ const cookieStore =
              await cookies();
            const token = cookieStore.get("token")?.value;
            if (!token) {
              throw new Error("Missing authentication token.");
            }
            const decoded = jwt.verify(token, SECRET());
            if (
              typeof decoded !== "object" ||
              decoded === null ||
              typeof decoded.uid !== "string" ||
              typeof decoded.role !== "string"
            ) {
              throw new Error("Invalid authentication token.");
            }
            auth = {
              uid: decoded.uid,
              role: decoded.role,
              customerId:
                typeof decoded.customerId === "string"
                  ? decoded.customerId
                  : "",
            };
          } catch {
            return NextResponse.json(
              { message: "Please sign in." },
              { status: 401 },
            );
          }
          /** Enforce enable/disable immediately (not only at next login). Uses the store's cached Users list (~1 read / 15s). */
          const account = await (await db()).get("Users", auth.uid);
          if (!account || account.active !== "true") {
            return NextResponse.json(
              { message: "This account is disabled." },
              { status: 401 },
            );
          }
          auth = { uid: auth.uid, role: account.role, customerId: account.customerId || "" };
          if (roles.length > 0 && !roles.includes(auth.role)) {
            return NextResponse.json(
              { message: "Not permitted." },
              { status: 403 },
            );
          }
        }
        const context: Ctx = {
          db: await db(),
          auth: auth as Auth,
          req,
          params: (await ctx?.params) ?? {},
        };
        const result = await fn(context);
        return result instanceof Response ? result : NextResponse.json(result);
      } catch (error: unknown) {
        if (error instanceof ZodError) {
          return NextResponse.json(
            { message: "Validation failed.", issues: error.issues },
            { status: 400 },
          );
        }
        console.error(error);
        const err = error as { status?: number; message?: string };
        const status = typeof err.status === "number" ? err.status : 500;
        return NextResponse.json(
          {
            message:
              status === 404
                ? "Not found."
                : "Google Sheets service is temporarily unavailable.",
            detail:
              process.env.NODE_ENV !== "production"
                ? String(err.message ?? error)
                : undefined,
          },
          { status },
        );
      }
    };
/** * Audit log helper. */ export const audit = (
  c: Ctx,
  action: string,
  entity: string,
  entityId: string,
): Promise<void> =>
  c.db
    .insert("AuditLog", {
      userId: c.auth.uid,
      action,
      entity,
      entityId,
      createdAt: new Date().toISOString(),
    })
    .then(() => undefined)
    .catch(() => undefined);
export { bcrypt, jwt };
