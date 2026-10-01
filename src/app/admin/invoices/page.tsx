"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  MenuItem,
  Paper,
  Snackbar,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";

import { Button, CardSkeleton, EmptyRow, TableSkeleton } from "@/components/ui";

import { useRole } from "@/components/RoleContext";
import { INVOICE_WRITE } from "@/lib/roles";

// ======================================================
// TYPES
// ======================================================

type Row = Record<string, string>;

type Ent = {
  date: string;
  customerId: string;
  customerName: string;
  ref: string;
  extRef: string;
  type: string;
  debit: number;
  credit: number;
  balance: number;
};

type Sum = {
  customerId: string;
  customerName: string;
  billed: number;
  received: number;
  outstanding: number;
};

type Data = {
  customers: Row[];
  invoices: Row[];
  entries: Ent[];
  summary: Sum[];
  totals: {
    billed: number;
    received: number;
    outstanding: number;
  };
};

type Product = {
  id: string;
  name: string;
  rate: number;
  hsnSac: string;
  gstPercent: number;
  active: boolean;
};

type Contract = {
  id: string;
  contractNumber: string;
  amount: string;
  total: string;
  remainingPercent: string;
  remainingAmount: string;
  status: string;
  products: string;
};

// ======================================================
// INVOICE LINE TYPE
// ======================================================

type InvoiceLine = {
  description: string;
  hsnSac: string;
  qty: number | string;
  rate: number | string;
  discount: number | string;
  discountPct: string;
  taxPercent: number | string;
  productId: string;
};

// ======================================================
// CONSTANTS
// ======================================================

const blank: InvoiceLine = {
  description: "",
  hsnSac: "",
  qty: 1,
  rate: 0,
  discount: 0,
  discountPct: "",
  taxPercent: 18,
  productId: "",
};

const today = () => new Date().toISOString().slice(0, 10);

const inr = (n: number | string) =>
  Number(n || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const send = (m: string, u: string, b?: unknown) =>
  fetch(u, {
    method: m,
    headers: {
      "Content-Type": "application/json",
    },
    body: b ? JSON.stringify(b) : undefined,
  });

const STATUSES = ["Issued", "Partially Paid", "Paid", "Cancelled"];

// ======================================================
// KPI
// ======================================================

const KPI = ({ l, v, g }: { l: string; v: string; g: string }) => (
  <Card
    sx={{
      color: "#fff",
      background: g,
      position: "relative",
      overflow: "hidden",
      transition: "transform .2s",
      "&:hover": {
        transform: "translateY(-2px)",
      },
    }}
  >
    <Box
      sx={{
        position: "absolute",
        right: -24,
        top: -24,
        width: 100,
        height: 100,
        borderRadius: "50%",
        bgcolor: "rgba(255,255,255,.14)",
      }}
    />

    <CardContent>
      <Typography variant="body2" sx={{ opacity: 0.85 }}>
        {l}
      </Typography>

      <Typography variant="h5" fontWeight={800}>
        {v}
      </Typography>
    </CardContent>
  </Card>
);

// ======================================================
// PAYMENT STATUS HELPER
// ======================================================

const paid = (i: Row) =>
  Number(i.amountPaid) > 0 || ["Paid", "Partially Paid"].includes(i.status);

// ======================================================
// COMPONENT
// ======================================================

export default function Invoices() {
  const canWrite = (INVOICE_WRITE as readonly string[]).includes(useRole());

  // ====================================================
  // MAIN DATA
  // ====================================================

  const [d, setD] = useState<Data | null>(null);

  const [cid, setCid] = useState("");
  const [st, setSt] = useState("");
  const [q, setQ] = useState("");
  const [tab, setTab] = useState(0);

  // ====================================================
  // INVOICE FORM
  // ====================================================

  const [open, setOpen] = useState(false);

  const [h, setH] = useState({
    customerId: "",
    externalDocNo: "",
    orderDate: "",
    date: today(),
    dueDate: today(),
    placeOfSupply: "",
    billingAddress: "",
  });

  const [lines, setLines] = useState<InvoiceLine[]>([{ ...blank }]);

  // ====================================================
  // PAYMENT
  // ====================================================

  const [pay, setPay] = useState<Row | null>(null);
  const [amt, setAmt] = useState(0);
  const [mode, setMode] = useState("Bank Transfer");

  // ====================================================
  // DELETE
  // ====================================================

  const [del, setDel] = useState<Row | null>(null);

  // ====================================================
  // MESSAGES / FORM
  // ====================================================

  const [msg, setMsg] = useState("");
  const [formErr, setFormErr] = useState("");
  const [editId, setEditId] = useState("");

  // ====================================================
  // PRODUCTS / CONTRACTS
  // ====================================================

  const [products, setProducts] = useState<Product[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);

  const [milestone, setMilestone] = useState({
    contractId: "",
    milestonePercent: "",
  });

  // ====================================================
  // LOAD LEDGER
  // ====================================================

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/ledger${cid ? `?customerId=${cid}` : ""}`);

      if (r.ok) {
        setD(await r.json());
      } else {
        setMsg("Unable to load invoices.");
      }
    } catch {
      setMsg("Unable to load invoices.");
    }
  }, [cid]);

  useEffect(() => {
    load();
  }, [load]);

  // ====================================================
  // LOAD PRODUCTS
  // ====================================================

  useEffect(() => {
    fetch("/api/products")
      .then(async (r) => {
        if (!r.ok) return;

        const json = await r.json();

        setProducts((json.rows || []).filter((p: Product) => p.active));
      })
      .catch(() => {
        setProducts([]);
      });
  }, []);

  // ====================================================
  // FILTERS
  // ====================================================

  const term = q.trim().toLowerCase();

  const invs = useMemo(
    () =>
      (d?.invoices || []).filter(
        (i) =>
          (!st || i.status === st) &&
          (!term ||
            `${i.id} ${i.externalDocNo} ${i.customerName}`
              .toLowerCase()
              .includes(term)),
      ),
    [d, st, term],
  );

  const ents = useMemo(
    () =>
      (d?.entries || []).filter((e) =>
        `${e.ref} ${e.extRef} ${e.customerName}`.toLowerCase().includes(term),
      ),
    [d, term],
  );

  // ====================================================
  // OPEN CREATE FORM
  // ====================================================

  const openForm = () => {
    setEditId("");

    setLines([{ ...blank }]);

    setMilestone({
      contractId: "",
      milestonePercent: "",
    });

    setContracts([]);

    const c = d?.customers.find((x) => x.id === cid);

    setH({
      customerId: cid,
      externalDocNo: "",
      orderDate: "",
      date: today(),
      dueDate: today(),
      placeOfSupply: c?.state || "",
      billingAddress: c?.billingAddress || "",
    });

    setFormErr("");
    setOpen(true);

    if (cid) {
      fetch(`/api/contracts?customerId=${cid}`)
        .then(async (r) => {
          if (!r.ok) return;

          const json = await r.json();

          setContracts(
            (json.rows || []).filter((x: Contract) => x.status === "Active"),
          );
        })
        .catch(() => {
          setContracts([]);
        });
    }
  };

  // ====================================================
  // OPEN EDIT FORM
  // ====================================================

  const openEdit = async (i: Row) => {
    try {
      const r = await fetch(`/api/invoices/${i.id}`);

      if (!r.ok) {
        const json = await r.json().catch(() => ({}));

        setMsg(json.message || "Could not load the invoice.");

        return;
      }

      const { invoice: v, items } = (await r.json()) as {
        invoice: Row;
        items: Row[];
      };

      setEditId(v.id);
      setFormErr("");

      setH({
        customerId: v.customerId,
        externalDocNo: v.externalDocNo || "",
        orderDate: v.orderDate || "",
        date: v.date,
        dueDate: v.dueDate,
        placeOfSupply: v.placeOfSupply || "",
        billingAddress: v.billingAddress || "",
      });

      // IMPORTANT:
      // Every InvoiceLine property is populated here.
      setLines(
        items.map((x) => ({
          description: x.description || "",

          hsnSac: x.hsnSac || "",

          qty: Number(x.qty),

          rate: Number(x.rate),

          discount: Number(x.discount || 0),

          discountPct: "",

          taxPercent: Number(x.taxPercent),

          productId: x.productId || "",
        })),
      );

      setMilestone({
        contractId: "",
        milestonePercent: "",
      });

      setOpen(true);
    } catch {
      setMsg("Could not load the invoice.");
    }
  };

  // ====================================================
  // CUSTOMER SELECTION
  // ====================================================

  const pickCustomer = (id: string) => {
    const c = d?.customers.find((x) => x.id === id);

    setH({
      ...h,
      customerId: id,
      placeOfSupply: c?.state || "",
      billingAddress: c?.billingAddress || "",
    });

    setMilestone({
      contractId: "",
      milestonePercent: "",
    });

    fetch(`/api/contracts?customerId=${id}`)
      .then(async (r) => {
        if (!r.ok) return;

        const json = await r.json();

        setContracts(
          (json.rows || []).filter((c: Contract) => c.status === "Active"),
        );
      })
      .catch(() => {
        setContracts([]);
      });
  };

  // ====================================================
  // ACTIVE CONTRACT
  // ====================================================

  const activeContract = contracts.find((c) => c.id === milestone.contractId);

  // ====================================================
  // AUTO FILL FROM CONTRACT
  // ====================================================

  const autoFillFromContract = () => {
    if (!activeContract || !milestone.milestonePercent) {
      return;
    }

    const pct = Number(milestone.milestonePercent) / 100;

    const tagged = products.filter((p) =>
      (activeContract.products || "").split(",").includes(p.id),
    );

    const base = Number(activeContract.amount || 0) * pct;

    if (tagged.length) {
      const share = Math.round((base / tagged.length) * 100) / 100;

      setLines(
        tagged.map((p) => ({
          ...blank,
          description: p.name,
          hsnSac: p.hsnSac,
          rate: share,
          taxPercent: p.gstPercent,
          productId: p.id,
        })),
      );
    } else {
      setLines([
        {
          ...blank,
          description: `${activeContract.contractNumber} - ${milestone.milestonePercent}% milestone`,
          rate: Math.round(base * 100) / 100,
        },
      ]);
    }
  };

  // ====================================================
  // APPLY PRODUCT
  // ====================================================

  const applyProduct = (i: number, productId: string) => {
    const p = products.find((x) => x.id === productId);

    setLines(
      lines.map((l, j) =>
        j === i
          ? {
              ...l,
              productId,
              description: p ? p.name : l.description,
              hsnSac: p ? p.hsnSac : l.hsnSac,
              rate: p ? p.rate : l.rate,
              taxPercent: p ? p.gstPercent : l.taxPercent,
            }
          : l,
      ),
    );
  };

  // ====================================================
  // DISCOUNT %
  // ====================================================

  const applyDiscountPct = (i: number, pct: string) => {
    const l = lines[i];

    const amount = pct
      ? Math.round(Number(l.qty) * Number(l.rate) * (Number(pct) / 100) * 100) /
        100
      : 0;

    setLines(
      lines.map((x, j) =>
        j === i
          ? {
              ...x,
              discountPct: pct,
              discount: amount,
            }
          : x,
      ),
    );
  };

  // ====================================================
  // SET LINE
  // ====================================================

  const setLine = (i: number, k: keyof InvoiceLine, v: string) => {
    setLines(
      lines.map((l, j) =>
        j === i
          ? {
              ...l,
              [k]: v,
            }
          : l,
      ),
    );
  };

  // ====================================================
  // CREATE / UPDATE INVOICE
  // ====================================================

  const create = async () => {
    if (!h.customerId) {
      setFormErr("Select a customer.");
      return;
    }

    if (!h.externalDocNo.trim()) {
      setFormErr("External document no. is required.");
      return;
    }

    const items = lines.map((l) => ({
      description: l.description,

      hsnSac: l.hsnSac,

      qty: Number(l.qty),

      rate: Number(l.rate),

      discount: Number(l.discount) || 0,

      taxPercent: Number(l.taxPercent),
    }));

    const milestoneFields =
      !editId && milestone.contractId
        ? {
            contractId: milestone.contractId,

            milestonePercent: Number(milestone.milestonePercent),
          }
        : {};

    try {
      const res = editId
        ? await send("PUT", `/api/invoices/${editId}`, {
            ...h,
            items,
          })
        : await send("POST", "/api/invoices", {
            ...h,
            ...milestoneFields,
            items,
          });

      if (res.ok) {
        setOpen(false);

        setLines([{ ...blank }]);

        setMilestone({
          contractId: "",
          milestonePercent: "",
        });

        setMsg(editId ? "Invoice updated." : "Invoice raised.");

        setEditId("");

        await load();
      } else {
        const j = await res.json().catch(() => ({}));

        setFormErr(
          j.issues?.[0]?.message || j.message || "Invoice could not be saved.",
        );
      }
    } catch {
      setFormErr("Invoice could not be saved.");
    }
  };

  // ====================================================
  // RECORD PAYMENT
  // ====================================================

  const record = async () => {
    if (!pay) return;

    if (amt <= 0) {
      setMsg("Payment amount must be greater than zero.");
      return;
    }

    try {
      const res = await send("POST", `/api/invoices/${pay.id}/payments`, {
        date: today(),
        amount: Number(amt),
        mode,
      });

      if (res.ok) {
        setPay(null);
        await load();
      } else {
        const json = await res.json().catch(() => ({}));

        setMsg(json.message || "Payment failed.");
      }
    } catch {
      setMsg("Payment failed.");
    }
  };

  // ====================================================
  // DELETE
  // ====================================================

  const remove = async () => {
    if (!del) return;

    try {
      const res = await send("DELETE", `/api/invoices/${del.id}`);

      const json = await res.json().catch(() => ({}));

      setMsg(
        res.ok
          ? `Invoice ${del.id} deleted.`
          : json.message || "Delete failed.",
      );

      setDel(null);

      if (res.ok) {
        await load();
      }
    } catch {
      setMsg("Delete failed.");

      setDel(null);
    }
  };

  // ====================================================
  // TOTALS
  // ====================================================

  const t = d?.totals;

  // ====================================================
  // RENDER
  // ====================================================

  return (
    <Box
      sx={{
        p: 3,
        maxWidth: 1300,
        mx: "auto",
        display: "grid",
        gap: 3,
      }}
    >
      {/* ==================================================
          HEADER
      ================================================== */}

      <Box
        sx={{
          display: "flex",
          gap: 2,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <Typography variant="h5" fontWeight={700} sx={{ flexGrow: 1 }}>
          Invoices & Ledger
        </Typography>

        <TextField
          select
          size="small"
          label="Customer"
          value={cid}
          onChange={(e) => setCid(e.target.value)}
          sx={{ minWidth: 240 }}
        >
          <MenuItem value="">All customers</MenuItem>

          {d?.customers.map((c) => (
            <MenuItem key={c.id} value={c.id}>
              {c.companyName}
            </MenuItem>
          ))}
        </TextField>

        {canWrite && (
          <Button variant="contained" color="secondary" onClick={openForm}>
            Raise Invoice
          </Button>
        )}
      </Box>

      {/* ==================================================
          KPI
      ================================================== */}

      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: {
            xs: "1fr",
            md: "repeat(3,1fr)",
          },
        }}
      >
        {d ? (
          <>
            <KPI
              l="Total billed (INR)"
              v={inr(t?.billed ?? 0)}
              g="linear-gradient(135deg,#1565c0,#0d47a1)"
            />

            <KPI
              l="Received (INR)"
              v={inr(t?.received ?? 0)}
              g="linear-gradient(135deg,#2e7d32,#1b5e20)"
            />

            <KPI
              l="Outstanding (INR)"
              v={inr(t?.outstanding ?? 0)}
              g="linear-gradient(135deg,#ef6c00,#e65100)"
            />
          </>
        ) : (
          <>
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </>
        )}
      </Box>

      {/* ==================================================
          TABS / SEARCH
      ================================================== */}

      <Box
        sx={{
          display: "flex",
          gap: 2,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ flexGrow: 1 }}>
          <Tab label={`Invoices (${invs.length})`} />

          <Tab label="Ledger" />
        </Tabs>

        <TextField
          size="small"
          placeholder="Search invoice, ext. doc no, customer"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          sx={{ minWidth: 280 }}
        />

        {tab === 0 && (
          <TextField
            select
            size="small"
            label="Status"
            value={st}
            onChange={(e) => setSt(e.target.value)}
            sx={{ minWidth: 150 }}
          >
            <MenuItem value="">All</MenuItem>

            {STATUSES.map((s) => (
              <MenuItem key={s} value={s}>
                {s}
              </MenuItem>
            ))}
          </TextField>
        )}
      </Box>

      {/* ==================================================
          INVOICES TABLE
      ================================================== */}

      {tab === 0 && (
        <Paper
          sx={{
            overflowX: "auto",
          }}
        >
          <Table size="small">
            <TableHead>
              <TableRow>
                {[
                  "Invoice",
                  "Ext. doc no.",
                  "Order date",
                  "Customer",
                  "Date",
                  "Due",
                  "Total",
                  "Paid",
                  "Balance",
                  "Status",
                  "",
                ].map((x) => (
                  <TableCell key={x}>{x}</TableCell>
                ))}
              </TableRow>
            </TableHead>

            <TableBody>
              {!d && <TableSkeleton rows={6} cols={11} />}

              {invs.map((i) => (
                <TableRow key={i.id} hover>
                  <TableCell>
                    <Link
                      href={`/admin/invoices/${i.id}`}
                      style={{
                        color: "inherit",
                        fontWeight: 600,
                      }}
                    >
                      {i.id}
                    </Link>
                  </TableCell>

                  <TableCell>{i.externalDocNo || "-"}</TableCell>

                  <TableCell>{i.orderDate || "-"}</TableCell>

                  <TableCell>{i.customerName}</TableCell>

                  <TableCell>{i.date}</TableCell>

                  <TableCell>{i.dueDate}</TableCell>

                  <TableCell align="right">{inr(i.grandTotal)}</TableCell>

                  <TableCell align="right">{inr(i.amountPaid)}</TableCell>

                  <TableCell align="right">{inr(i.balanceDue)}</TableCell>

                  <TableCell>
                    <Chip
                      size="small"
                      label={i.status}
                      color={
                        i.status === "Paid"
                          ? "success"
                          : i.status === "Cancelled"
                            ? "error"
                            : "default"
                      }
                    />
                  </TableCell>

                  <TableCell
                    sx={{
                      whiteSpace: "nowrap",
                    }}
                  >
                    <Button
                      size="small"
                      component={Link}
                      href={`/admin/invoices/${i.id}?print=1`}
                      target="_blank"
                    >
                      PDF
                    </Button>

                    {canWrite &&
                      Number(i.balanceDue) > 0 &&
                      i.status !== "Cancelled" && (
                        <Button
                          size="small"
                          onClick={() => {
                            setPay(i);
                            setAmt(Number(i.balanceDue));
                          }}
                        >
                          Record payment
                        </Button>
                      )}

                    {canWrite && !paid(i) && i.status !== "Cancelled" && (
                      <Button size="small" onClick={() => openEdit(i)}>
                        Edit
                      </Button>
                    )}

                    {canWrite && !paid(i) && (
                      <Button
                        size="small"
                        color="error"
                        onClick={() => setDel(i)}
                      >
                        Delete
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}

              {d && !invs.length && (
                <EmptyRow
                  cols={11}
                  title="No invoices found"
                  hint="Raise an invoice or change the filters."
                />
              )}
            </TableBody>
          </Table>
        </Paper>
      )}

      {/* ==================================================
          LEDGER
      ================================================== */}

      {tab === 1 && (
        <>
          {!cid && (
            <Paper
              sx={{
                overflowX: "auto",
              }}
            >
              <Typography sx={{ p: 2 }} fontWeight={600}>
                Customer-wise summary
              </Typography>

              <Table size="small">
                <TableHead>
                  <TableRow>
                    {["Customer", "Billed", "Received", "Outstanding"].map(
                      (x) => (
                        <TableCell
                          key={x}
                          align={x === "Customer" ? "left" : "right"}
                        >
                          {x}
                        </TableCell>
                      ),
                    )}
                  </TableRow>
                </TableHead>

                <TableBody>
                  {d?.summary.map((s) => (
                    <TableRow
                      key={s.customerId}
                      hover
                      sx={{
                        cursor: "pointer",
                      }}
                      onClick={() => setCid(s.customerId)}
                    >
                      <TableCell>{s.customerName}</TableCell>

                      <TableCell align="right">{inr(s.billed)}</TableCell>

                      <TableCell align="right">{inr(s.received)}</TableCell>

                      <TableCell
                        align="right"
                        sx={{
                          fontWeight: 700,
                        }}
                      >
                        {inr(s.outstanding)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Paper>
          )}

          <Paper
            sx={{
              overflowX: "auto",
            }}
          >
            <Typography sx={{ p: 2 }} fontWeight={600}>
              Ledger entries{" "}
              {cid
                ? `- outstanding ${inr(t?.outstanding ?? 0)}`
                : "(running balance is per customer)"}
            </Typography>

            <Table size="small">
              <TableHead>
                <TableRow>
                  {[
                    "Date",
                    ...(cid ? [] : ["Customer"]),
                    "Invoice",
                    "Ext. doc / reference",
                    "Type",
                    "Debit",
                    "Credit",
                    "Balance",
                  ].map((x) => (
                    <TableCell key={x}>{x}</TableCell>
                  ))}
                </TableRow>
              </TableHead>

              <TableBody>
                {ents.map((e, k) => (
                  <TableRow key={k}>
                    <TableCell>{e.date}</TableCell>

                    {!cid && <TableCell>{e.customerName}</TableCell>}

                    <TableCell>{e.ref}</TableCell>

                    <TableCell>{e.extRef}</TableCell>

                    <TableCell>{e.type}</TableCell>

                    <TableCell align="right">
                      {e.debit ? inr(e.debit) : ""}
                    </TableCell>

                    <TableCell align="right">
                      {e.credit ? inr(e.credit) : ""}
                    </TableCell>

                    <TableCell align="right">{inr(e.balance)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        </>
      )}

      {/* ==================================================
          CREATE / EDIT INVOICE DIALOG
      ================================================== */}

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>
          {editId ? `Edit invoice ${editId}` : "Raise Invoice"}
        </DialogTitle>

        <DialogContent
          sx={{
            display: "grid",
            gap: 2,
            pt: "8px !important",
          }}
        >
          {formErr && <Alert severity="error">{formErr}</Alert>}

          {/* Customer / external reference */}

          <Box
            sx={{
              display: "flex",
              gap: 2,
              flexWrap: "wrap",
            }}
          >
            <TextField
              select
              label="Customer"
              disabled={!!editId}
              value={h.customerId}
              onChange={(e) => pickCustomer(e.target.value)}
              sx={{
                minWidth: 260,
                flex: 1,
              }}
            >
              {d?.customers.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.companyName}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              required
              label="External document no."
              helperText="Customer PO / reference number"
              value={h.externalDocNo}
              onChange={(e) =>
                setH({
                  ...h,
                  externalDocNo: e.target.value,
                })
              }
              sx={{
                minWidth: 220,
              }}
            />

            <TextField
              type="date"
              label="Order date"
              helperText="Date of the external document"
              InputLabelProps={{
                shrink: true,
              }}
              value={h.orderDate}
              onChange={(e) =>
                setH({
                  ...h,
                  orderDate: e.target.value,
                })
              }
              sx={{
                minWidth: 180,
              }}
            />
          </Box>

          {/* Dates / Place of supply */}

          <Box
            sx={{
              display: "flex",
              gap: 2,
              flexWrap: "wrap",
            }}
          >
            <TextField
              type="date"
              label="Date"
              InputLabelProps={{
                shrink: true,
              }}
              value={h.date}
              onChange={(e) =>
                setH({
                  ...h,
                  date: e.target.value,
                })
              }
            />

            <TextField
              type="date"
              label="Due"
              InputLabelProps={{
                shrink: true,
              }}
              value={h.dueDate}
              onChange={(e) =>
                setH({
                  ...h,
                  dueDate: e.target.value,
                })
              }
            />

            <TextField
              label="Place of supply (state)"
              value={h.placeOfSupply}
              onChange={(e) =>
                setH({
                  ...h,
                  placeOfSupply: e.target.value,
                })
              }
            />
          </Box>

          {/* Billing address */}

          <TextField
            multiline
            minRows={2}
            label="Billing address (editable for this invoice)"
            value={h.billingAddress}
            onChange={(e) =>
              setH({
                ...h,
                billingAddress: e.target.value,
              })
            }
          />

          {/* ==================================================
              CONTRACT MILESTONE
          ================================================== */}

          {!editId && contracts.length > 0 && (
            <Box
              sx={{
                display: "flex",
                gap: 2,
                flexWrap: "wrap",
                alignItems: "center",
                p: 1.5,
                borderRadius: 2,
                bgcolor: "action.hover",
              }}
            >
              <TextField
                select
                size="small"
                label="Link to contract (optional, for milestone invoicing)"
                value={milestone.contractId}
                onChange={(e) =>
                  setMilestone({
                    contractId: e.target.value,
                    milestonePercent: "",
                  })
                }
                sx={{
                  minWidth: 260,
                }}
              >
                <MenuItem value="">Not linked - standalone invoice</MenuItem>

                {contracts.map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.contractNumber} (remaining {c.remainingPercent}
                    %)
                  </MenuItem>
                ))}
              </TextField>

              {activeContract && (
                <>
                  <TextField
                    size="small"
                    label="Milestone %"
                    value={milestone.milestonePercent}
                    onChange={(e) =>
                      setMilestone({
                        ...milestone,
                        milestonePercent: e.target.value,
                      })
                    }
                    sx={{
                      width: 120,
                    }}
                  />

                  <Typography variant="body2" color="text.secondary">
                    Remaining: {activeContract.remainingPercent}% (INR{" "}
                    {inr(activeContract.remainingAmount)})
                  </Typography>

                  <Button
                    size="small"
                    variant="outlined"
                    disabled={!milestone.milestonePercent}
                    onClick={autoFillFromContract}
                  >
                    Auto-fill lines from contract
                  </Button>
                </>
              )}
            </Box>
          )}

          {/* ==================================================
              INVOICE LINES
          ================================================== */}

          {lines.map((l, i) => (
            <Box
              key={i}
              sx={{
                display: "flex",
                gap: 1,
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              {products.length > 0 && (
                <TextField
                  size="small"
                  select
                  label="Product"
                  value={l.productId}
                  onChange={(e) => applyProduct(i, e.target.value)}
                  sx={{
                    width: 160,
                  }}
                >
                  <MenuItem value="">Custom line</MenuItem>

                  {products.map((p) => (
                    <MenuItem key={p.id} value={p.id}>
                      {p.name}
                    </MenuItem>
                  ))}
                </TextField>
              )}

              <TextField
                size="small"
                label="Description"
                value={l.description}
                onChange={(e) => setLine(i, "description", e.target.value)}
                sx={{
                  flex: 2,
                  minWidth: 200,
                }}
              />

              <TextField
                size="small"
                label="SAC/HSN"
                value={l.hsnSac}
                onChange={(e) => setLine(i, "hsnSac", e.target.value)}
                sx={{
                  width: 100,
                }}
              />

              <TextField
                size="small"
                label="Qty"
                value={l.qty}
                onChange={(e) => setLine(i, "qty", e.target.value)}
                sx={{
                  width: 70,
                }}
              />

              <TextField
                size="small"
                label="Rate"
                value={l.rate}
                onChange={(e) => setLine(i, "rate", e.target.value)}
                sx={{
                  width: 110,
                }}
              />

              <TextField
                size="small"
                label="Disc %"
                value={l.discountPct}
                onChange={(e) => applyDiscountPct(i, e.target.value)}
                sx={{
                  width: 80,
                }}
              />

              <TextField
                size="small"
                label="Discount"
                value={l.discount}
                onChange={(e) => setLine(i, "discount", e.target.value)}
                sx={{
                  width: 90,
                }}
              />

              <TextField
                size="small"
                label="GST %"
                value={l.taxPercent}
                onChange={(e) => setLine(i, "taxPercent", e.target.value)}
                sx={{
                  width: 80,
                }}
              />

              {lines.length > 1 && (
                <Button
                  size="small"
                  color="error"
                  onClick={() => setLines(lines.filter((_, j) => j !== i))}
                >
                  Remove
                </Button>
              )}
            </Box>
          ))}

          <Button onClick={() => setLines([...lines, { ...blank }])}>
            Add line
          </Button>
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>

          <Button variant="contained" onClick={create}>
            {editId ? "Save changes" : "Create"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ==================================================
          PAYMENT DIALOG
      ================================================== */}

      <Dialog open={!!pay} onClose={() => setPay(null)}>
        <DialogTitle>Record payment {pay?.id}</DialogTitle>

        <DialogContent
          sx={{
            display: "grid",
            gap: 2,
            pt: "8px !important",
          }}
        >
          <TextField
            label="Amount"
            value={amt}
            onChange={(e) => setAmt(Number(e.target.value))}
          />

          <TextField
            select
            label="Mode"
            value={mode}
            onChange={(e) => setMode(e.target.value)}
          >
            {["Bank Transfer", "UPI", "Cash", "Cheque", "Card", "Other"].map(
              (m) => (
                <MenuItem key={m} value={m}>
                  {m}
                </MenuItem>
              ),
            )}
          </TextField>
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setPay(null)}>Cancel</Button>

          <Button variant="contained" onClick={record}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* ==================================================
          DELETE DIALOG
      ================================================== */}

      <Dialog open={!!del} onClose={() => setDel(null)}>
        <DialogTitle>Delete invoice {del?.id}?</DialogTitle>

        <DialogContent>
          <DialogContentText>
            This permanently removes the invoice
            {del?.externalDocNo ? ` (ext. doc ${del.externalDocNo})` : ""} and
            its line items. It can only be done while no payment is recorded.
          </DialogContentText>
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setDel(null)}>Keep</Button>

          <Button color="error" variant="contained" onClick={remove}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* ==================================================
          SNACKBAR
      ================================================== */}

      <Snackbar
        open={!!msg}
        autoHideDuration={4000}
        onClose={() => setMsg("")}
        message={msg}
      />
    </Box>
  );
}
