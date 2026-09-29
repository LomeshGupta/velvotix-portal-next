"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Box, Button, Typography } from "@mui/material";
import { rupeesInWords } from "@/lib/words";

type R = Record<string, string>;

type InvoiceData = {
  invoice: R;
  items: R[];
  payments: R[];
  company: R | null;
  customer: R;
};

type InvoicePrintProps = {
  params: {
    id: string;
  };
};

/* ============================================================
   HELPERS
============================================================ */

const money = (value: string | number | null | undefined): string => {
  const amount = Number(value || 0);

  return amount.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const numberValue = (value: string | number | null | undefined): number =>
  Number(value || 0);

const valueOrDash = (value: string | number | null | undefined): string => {
  if (value === undefined || value === null || String(value).trim() === "") {
    return "-";
  }

  return String(value);
};

const joinAddress = (...values: Array<string | undefined | null>): string => {
  return values
    .filter((x) => x !== undefined && x !== null && String(x).trim() !== "")
    .map((x) => String(x).trim())
    .join(", ");
};

const isTruthy = (value: string | number | undefined | null): boolean => {
  if (value === undefined || value === null) {
    return false;
  }

  return ["true", "yes", "y", "1"].includes(String(value).trim().toLowerCase());
};

const formatDate = (value: string | undefined | null): string => {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

/* ============================================================
   SMALL COMPONENTS
============================================================ */

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: "90px 1fr",
        columnGap: 1,
        mb: 0.4,
      }}
    >
      <Typography
        sx={{
          fontSize: "9px",
          color: "#9ca3af",
          lineHeight: 1.4,
        }}
      >
        {label}
      </Typography>

      <Typography
        sx={{
          fontSize: "9px",
          color: "#111827",
          lineHeight: 1.4,
          fontWeight: 500,
        }}
      >
        {value}
      </Typography>
    </Box>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <Typography
      sx={{
        fontSize: "10px",
        fontWeight: 800,
        color: "#111827",
        mb: 0.7,
      }}
    >
      {children}
    </Typography>
  );
}

function TotalRow({
  label,
  value,
  bold = false,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        py: 0.35,
      }}
    >
      <Typography
        sx={{
          fontSize: "9px",
          color: bold ? "#111827" : "#4b5563",
          fontWeight: bold ? 700 : 400,
        }}
      >
        {label}
      </Typography>

      <Typography
        sx={{
          fontSize: "9px",
          color: "#111827",
          fontWeight: bold ? 700 : 500,
          textAlign: "right",
        }}
      >
        {value}
      </Typography>
    </Box>
  );
}

/* ============================================================
   MAIN COMPONENT
============================================================ */

export default function InvoicePrint({ params }: InvoicePrintProps) {
  const [data, setData] = useState<InvoiceData | null>(null);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState(false);

  /* ============================================================
     LOAD INVOICE
  ============================================================ */

  useEffect(() => {
    let mounted = true;

    const loadInvoice = async () => {
      try {
        setLoading(true);
        setError(false);

        const response = await fetch(`/api/invoices/${params.id}`, {
          method: "GET",
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(`Failed to load invoice: ${response.status}`);
        }

        const result = (await response.json()) as InvoiceData;

        if (mounted) {
          setData(result);
        }
      } catch (err) {
        console.error("Invoice loading error:", err);

        if (mounted) {
          setError(true);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadInvoice();

    return () => {
      mounted = false;
    };
  }, [params.id]);

  /* ============================================================
     LOADING
  ============================================================ */

  if (loading) {
    return (
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          bgcolor: "#f5f6f8",
        }}
      >
        <Typography
          sx={{
            fontSize: 14,
            color: "#6b7280",
          }}
        >
          Loading invoice...
        </Typography>
      </Box>
    );
  }

  /* ============================================================
     ERROR
  ============================================================ */

  if (error || !data) {
    return (
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 2,
          bgcolor: "#f5f6f8",
        }}
      >
        <Typography
          sx={{
            fontSize: 16,
            fontWeight: 700,
          }}
        >
          Unable to load invoice
        </Typography>

        <Button component={Link} href="/admin/invoices" variant="outlined">
          Back to Invoices
        </Button>
      </Box>
    );
  }

  /* ============================================================
     DATA
  ============================================================ */

  const { invoice: i, items = [], payments = [], company, customer } = data;

  const c = company || {};
  const u = customer || {};

  /* ============================================================
     COMPANY
  ============================================================ */

  const companyName = valueOrDash(c.name || "Velvotix Solutions");

  const companyAddress = joinAddress(
    c.address,
    c.city,
    c.state,
    c.pin,
    c.country,
  );

  const companyContact = [c.email, c.phone, c.website]
    .filter(Boolean)
    .join(" | ");

  /* ============================================================
     CUSTOMER
  ============================================================ */

  const customerName = valueOrDash(u.companyName || u.name || i.customerName);

  const billingAddress =
    i.billingAddress ||
    u.billingAddress ||
    joinAddress(u.address, u.city, u.state, u.pin, u.country);

  const shippingAddress =
    i.shippingAddress || u.shippingAddress || billingAddress;

  /* ============================================================
     INVOICE VALUES
  ============================================================ */

  const customerCin = i.customerCin || u.cin;

  const invoiceNumber = valueOrDash(i.number || i.invoiceNumber || i.id);

  const invoiceDate = formatDate(i.date || i.invoiceDate);

  const dueDate = formatDate(i.dueDate);

  const placeOfSupply = valueOrDash(i.placeOfSupply || u.state || c.state);

  const reverseCharge = isTruthy(i.reverseCharge) ? "YES" : "NO";

  /* ============================================================
     FINANCIAL VALUES
  ============================================================ */

  const subtotal = numberValue(i.subtotal);

  const discount = numberValue(i.discount);

  const shippingCost = numberValue(i.shippingCost || i.shipping || i.freight);

  const taxableAmount = numberValue(i.taxable);

  const cgst = numberValue(i.cgst);

  const sgst = numberValue(i.sgst);

  const igst = numberValue(i.igst);

  const totalTax = cgst + sgst + igst;

  const roundOff = numberValue(i.roundOff);

  const grandTotal = numberValue(i.grandTotal);

  const amountPaid = numberValue(i.amountPaid);

  const balanceDue = numberValue(i.balanceDue);

  /* ============================================================
     TAX MODE
  ============================================================ */

  const isInterState = igst > 0 || (cgst === 0 && sgst === 0 && igst > 0);

  /* ============================================================
     STATUS
  ============================================================ */

  const status = String(i.status || "UNPAID").toUpperCase();

  const statusIsPaid = status === "PAID";

  /* ============================================================
     AMOUNT IN WORDS
  ============================================================ */

  let amountWords = "";

  try {
    amountWords = rupeesInWords(grandTotal);
  } catch {
    amountWords = "";
  }

  /* ============================================================
     TABLE STYLES
  ============================================================ */

  const tableHeader: React.CSSProperties = {
    background: "#0878f9",
    color: "#ffffff",
    padding: "7px 7px",
    fontSize: "8px",
    fontWeight: 700,
    textTransform: "uppercase",
    textAlign: "left",
    whiteSpace: "nowrap",
  };

  const tableCell: React.CSSProperties = {
    padding: "8px 7px",
    fontSize: "9px",
    color: "#111827",
    verticalAlign: "top",
  };

  /* ============================================================
     RENDER
  ============================================================ */

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "#eef0f3",
        p: 2,

        "@media print": {
          p: 0,
          bgcolor: "#ffffff",
        },
      }}
    >
      {/* ======================================================
          PRINT CSS
      ====================================================== */}

      <style>{`
        @page {
          size: A4;
          margin: 8mm;
        }

        * {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }

        html,
        body {
          margin: 0;
          padding: 0;
          background: #eef0f3;
        }

        body {
          font-family:
            Arial,
            Helvetica,
            sans-serif;
        }

        @media print {
          html,
          body {
            background: #ffffff !important;
          }

          .no-print {
            display: none !important;
          }

          .invoice-paper {
            width: 100% !important;
            min-height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
          }
        }
      `}</style>

      {/* ======================================================
          ACTION BAR
      ====================================================== */}

      <Box
        className="no-print"
        sx={{
          width: "210mm",
          maxWidth: "100%",
          mx: "auto",
          mb: 2,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Button
          component={Link}
          href="/admin/invoices"
          variant="outlined"
          sx={{
            bgcolor: "#fff",
          }}
        >
          Back
        </Button>

        <Button
          variant="contained"
          onClick={() => window.print()}
          sx={{
            bgcolor: "#0878f9",
            px: 3,
            fontWeight: 700,
            "&:hover": {
              bgcolor: "#0668d9",
            },
          }}
        >
          Print / Save as PDF
        </Button>
      </Box>

      {/* ======================================================
          A4 INVOICE
      ====================================================== */}

      <Box
        className="invoice-paper"
        sx={{
          width: "210mm",
          minHeight: "297mm",
          mx: "auto",
          bgcolor: "#ffffff",
          color: "#111827",
          boxSizing: "border-box",
          p: "10mm",
          boxShadow: "0 10px 40px rgba(0,0,0,0.10)",
          fontFamily: "Arial, Helvetica, sans-serif",
        }}
      >
        {/* ====================================================
            TOP HEADER
        ==================================================== */}

        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            minHeight: 115,
          }}
        >
          {/* LOGO / COMPANY */}

          <Box
            sx={{
              width: "52%",
            }}
          >
            {c.logo ? (
              <Box
                component="img"
                src={c.logo}
                alt={companyName}
                sx={{
                  display: "block",
                  maxWidth: 130,
                  maxHeight: 80,
                  objectFit: "contain",
                  objectPosition: "left center",
                  mb: 1,
                }}
              />
            ) : (
              <Box
                sx={{
                  width: 82,
                  height: 82,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  mb: 1,
                }}
              >
                <Typography
                  sx={{
                    fontSize: 30,
                    fontWeight: 900,
                    color: "#0878f9",
                    letterSpacing: "-3px",
                  }}
                >
                  VS
                </Typography>
              </Box>
            )}

            <Typography
              sx={{
                fontSize: 11,
                fontWeight: 800,
                color: "#111827",
                mb: 0.4,
              }}
            >
              {companyName}
            </Typography>

            {companyAddress && (
              <Typography
                sx={{
                  fontSize: 8.5,
                  lineHeight: 1.5,
                  color: "#374151",
                  maxWidth: 310,
                }}
              >
                {companyAddress}
              </Typography>
            )}

            {c.gstin && (
              <Typography
                sx={{
                  fontSize: 8.5,
                  lineHeight: 1.5,
                  color: "#374151",
                }}
              >
                <b>GSTIN:</b> {c.gstin}
              </Typography>
            )}

            {c.pan && (
              <Typography
                sx={{
                  fontSize: 8.5,
                  lineHeight: 1.5,
                  color: "#374151",
                }}
              >
                <b>PAN:</b> {c.pan}
              </Typography>
            )}

            {c.cin && (
              <Typography
                sx={{
                  fontSize: 8.5,
                  lineHeight: 1.5,
                  color: "#374151",
                }}
              >
                <b>CIN:</b> {c.cin}
              </Typography>
            )}

            {companyContact && (
              <Typography
                sx={{
                  fontSize: 8.5,
                  lineHeight: 1.5,
                  color: "#374151",
                }}
              >
                {companyContact}
              </Typography>
            )}
          </Box>

          {/* INVOICE TITLE */}

          <Box
            sx={{
              width: "40%",
              textAlign: "right",
              pt: 2,
            }}
          >
            <Typography
              sx={{
                fontSize: 25,
                fontWeight: 800,
                color: "#111111",
                letterSpacing: "-0.7px",
                lineHeight: 1.1,
                mb: 2.5,
              }}
            >
              TAX INVOICE
            </Typography>

            <MetaRow label="Invoice no:" value={invoiceNumber} />
            <MetaRow label="Ext. doc no:" value={valueOrDash(i.externalDocNo)} />

            <MetaRow label="Order date:" value={formatDate(i.orderDate)} />

            <MetaRow label="Invoice date:" value={invoiceDate} />

            <MetaRow label="Due:" value={dueDate} />
          </Box>
        </Box>

        {/* ====================================================
            BILL TO / FROM
        ==================================================== */}

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            columnGap: 5,
            mt: 2,
            minHeight: 125,
          }}
        >
          {/* FROM */}

          <Box>
            <SectionTitle>From</SectionTitle>

            <Typography
              sx={{
                fontSize: 12,
                fontWeight: 800,
                color: "#111827",
                mb: 0.9,
              }}
            >
              {companyName}
            </Typography>

            {c.contactPerson && (
              <Typography
                sx={{
                  fontSize: 8.8,
                  color: "#374151",
                  lineHeight: 1.5,
                }}
              >
                {c.contactPerson}
              </Typography>
            )}

            {companyContact && (
              <Typography
                sx={{
                  fontSize: 8.8,
                  color: "#374151",
                  lineHeight: 1.5,
                }}
              >
                {c.email}
              </Typography>
            )}

            {c.phone && (
              <Typography
                sx={{
                  fontSize: 8.8,
                  color: "#374151",
                  lineHeight: 1.5,
                }}
              >
                {c.phone}
              </Typography>
            )}

            {companyAddress && (
              <Typography
                sx={{
                  fontSize: 8.8,
                  color: "#374151",
                  lineHeight: 1.5,
                  maxWidth: 250,
                }}
              >
                {companyAddress}
              </Typography>
            )}

            {c.gstin && (
              <Typography
                sx={{
                  fontSize: 8.8,
                  color: "#374151",
                  lineHeight: 1.5,
                  mt: 0.5,
                }}
              >
                GSTIN: {c.gstin}
              </Typography>
            )}

            {c.cin && (
              <Typography
                sx={{
                  fontSize: 8.8,
                  lineHeight: 1.5,
                  color: "#374151",
                  mt: 0.2,
                }}
              >
                <b>CIN:</b> {c.cin}
              </Typography>
            )}
          </Box>

          {/* BILL TO / SHIP TO */}

          <Box
            sx={{
              textAlign: "right",
            }}
          >
            <SectionTitle>Bill to</SectionTitle>

            <Typography
              sx={{
                fontSize: 12,
                fontWeight: 800,
                color: "#111827",
                mb: 0.9,
              }}
            >
              {customerName}
            </Typography>

            {u.contactPerson && (
              <Typography
                sx={{
                  fontSize: 8.8,
                  color: "#374151",
                  lineHeight: 1.5,
                }}
              >
                {u.contactPerson}
              </Typography>
            )}

            {u.email && (
              <Typography
                sx={{
                  fontSize: 8.8,
                  color: "#374151",
                  lineHeight: 1.5,
                }}
              >
                {u.email}
              </Typography>
            )}

            {u.phone && (
              <Typography
                sx={{
                  fontSize: 8.8,
                  color: "#374151",
                  lineHeight: 1.5,
                }}
              >
                {u.phone}
              </Typography>
            )}

            <Typography
              sx={{
                fontSize: 8.8,
                color: "#374151",
                lineHeight: 1.5,
              }}
            >
              {billingAddress}
            </Typography>

            {u.gstin && (
              <Typography
                sx={{
                  fontSize: 8.8,
                  color: "#374151",
                  lineHeight: 1.5,
                  mt: 0.5,
                }}
              >
                GSTIN: {u.gstin}
              </Typography>
            )}

            {customerCin && (
              <Typography
                sx={{
                  fontSize: 8.8,
                  lineHeight: 1.5,
                  color: "#374151",
                  mt: 0.2,
                }}
              >
                <b>CIN:</b> {customerCin}
              </Typography>
            )}

            {/* SHIP TO */}

            <Box
              sx={{
                mt: 2,
              }}
            >
              <SectionTitle>Ship to</SectionTitle>

              <Typography
                sx={{
                  fontSize: 8.8,
                  color: "#374151",
                  lineHeight: 1.5,
                }}
              >
                {shippingAddress}
              </Typography>

              {i.shippingPin && (
                <Typography
                  sx={{
                    fontSize: 8.8,
                    color: "#374151",
                    lineHeight: 1.5,
                  }}
                >
                  {i.shippingPin}
                </Typography>
              )}
            </Box>
          </Box>
        </Box>

        {/* ====================================================
            GST META LINE
        ==================================================== */}

        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderTop: "1px solid #edf0f3",
            borderBottom: "1px solid #edf0f3",
            py: 0.8,
            mb: 1.8,
          }}
        >
          <Typography
            sx={{
              fontSize: 8.5,
              color: "#4b5563",
            }}
          >
            <b>Place of Supply:</b> {placeOfSupply}
          </Typography>

          <Typography
            sx={{
              fontSize: 8.5,
              color: "#4b5563",
            }}
          >
            <b>Reverse Charge:</b> {reverseCharge}
          </Typography>

          {i.paymentTerms && (
            <Typography
              sx={{
                fontSize: 8.5,
                color: "#4b5563",
              }}
            >
              <b>Payment Terms:</b> {i.paymentTerms}
            </Typography>
          )}
        </Box>

        {/* ====================================================
            ITEMS TABLE
        ==================================================== */}

        <Box
          sx={{
            width: "100%",
            overflow: "hidden",
          }}
        >
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              tableLayout: "fixed",
            }}
          >
            <thead>
              <tr>
                <th
                  style={{
                    ...tableHeader,
                    width: "28%",
                  }}
                >
                  DESCRIPTION
                </th>

                <th
                  style={{
                    ...tableHeader,
                    width: "9%",
                  }}
                >
                  HSN/SAC
                </th>

                <th
                  style={{
                    ...tableHeader,
                    width: "7%",
                    textAlign: "right",
                  }}
                >
                  QTY
                </th>

                <th
                  style={{
                    ...tableHeader,
                    width: "12%",
                    textAlign: "right",
                  }}
                >
                  RATE
                </th>

                <th
                  style={{
                    ...tableHeader,
                    width: "10%",
                    textAlign: "right",
                  }}
                >
                  DISCOUNT
                </th>

                <th
                  style={{
                    ...tableHeader,
                    width: "12%",
                    textAlign: "right",
                  }}
                >
                  TAXABLE
                </th>

                <th
                  style={{
                    ...tableHeader,
                    width: "10%",
                    textAlign: "right",
                  }}
                >
                  TAX
                </th>

                <th
                  style={{
                    ...tableHeader,
                    width: "12%",
                    textAlign: "right",
                  }}
                >
                  AMOUNT
                </th>
              </tr>
            </thead>

            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    style={{
                      ...tableCell,
                      textAlign: "center",
                      padding: 20,
                      color: "#9ca3af",
                    }}
                  >
                    No invoice items
                  </td>
                </tr>
              ) : (
                items.map((item, index) => {
                  const lineCgst = numberValue(item.cgst);

                  const lineSgst = numberValue(item.sgst);

                  const lineIgst = numberValue(item.igst);

                  const lineTax = lineCgst + lineSgst + lineIgst;

                  return (
                    <tr
                      key={item.id || `${index}`}
                      style={{
                        background: index % 2 === 1 ? "#f3f8fd" : "#ffffff",
                      }}
                    >
                      {/* DESCRIPTION */}

                      <td
                        style={{
                          ...tableCell,
                          width: "28%",
                        }}
                      >
                        <div
                          style={{
                            fontWeight: 600,
                            fontSize: "9px",
                            lineHeight: 1.35,
                          }}
                        >
                          {valueOrDash(item.description)}
                        </div>

                        {item.details && (
                          <div
                            style={{
                              marginTop: 3,
                              fontSize: "8px",
                              color: "#6b7280",
                              lineHeight: 1.35,
                            }}
                          >
                            {item.details}
                          </div>
                        )}
                      </td>

                      {/* HSN */}

                      <td
                        style={{
                          ...tableCell,
                        }}
                      >
                        {valueOrDash(item.hsnSac)}
                      </td>

                      {/* QTY */}

                      <td
                        style={{
                          ...tableCell,
                          textAlign: "right",
                        }}
                      >
                        {valueOrDash(item.qty)}
                        {item.uom ? ` ${item.uom}` : ""}
                      </td>

                      {/* RATE */}

                      <td
                        style={{
                          ...tableCell,
                          textAlign: "right",
                        }}
                      >
                        {money(item.rate)}
                      </td>

                      {/* DISCOUNT */}

                      <td
                        style={{
                          ...tableCell,
                          textAlign: "right",
                        }}
                      >
                        {money(item.discount)}
                      </td>

                      {/* TAXABLE */}

                      <td
                        style={{
                          ...tableCell,
                          textAlign: "right",
                          fontWeight: 600,
                        }}
                      >
                        {money(item.taxable)}
                      </td>

                      {/* TAX */}

                      <td
                        style={{
                          ...tableCell,
                          textAlign: "right",
                        }}
                      >
                        <div
                          style={{
                            fontWeight: 600,
                          }}
                        >
                          {money(lineTax)}
                        </div>

                        {lineCgst > 0 && (
                          <div
                            style={{
                              fontSize: "7px",
                              color: "#6b7280",
                            }}
                          >
                            CGST {money(lineCgst)}
                          </div>
                        )}

                        {lineSgst > 0 && (
                          <div
                            style={{
                              fontSize: "7px",
                              color: "#6b7280",
                            }}
                          >
                            SGST {money(lineSgst)}
                          </div>
                        )}

                        {lineIgst > 0 && (
                          <div
                            style={{
                              fontSize: "7px",
                              color: "#6b7280",
                            }}
                          >
                            IGST {money(lineIgst)}
                          </div>
                        )}
                      </td>

                      {/* AMOUNT */}

                      <td
                        style={{
                          ...tableCell,
                          textAlign: "right",
                          fontWeight: 700,
                        }}
                      >
                        {money(item.lineTotal)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </Box>

        {/* ====================================================
            LOWER CONTENT
        ==================================================== */}

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "1fr 235px",
            gap: 5,
            mt: 2.5,
          }}
        >
          {/* ==================================================
              LEFT
          ================================================== */}

          <Box>
            {/* PAYMENT INSTRUCTION */}

            <SectionTitle>Payment instruction</SectionTitle>

            {c.paymentEmail && (
              <Typography
                sx={{
                  fontSize: 8.8,
                  lineHeight: 1.6,
                }}
              >
                Payment email
              </Typography>
            )}

            {c.paymentEmail && (
              <Typography
                sx={{
                  fontSize: 8.8,
                  lineHeight: 1.6,
                  mb: 1.2,
                }}
              >
                {c.paymentEmail}
              </Typography>
            )}

            {c.bankName && (
              <Typography
                sx={{
                  fontSize: 8.8,
                  lineHeight: 1.6,
                }}
              >
                Bank Transfer
              </Typography>
            )}

            {c.bankName && (
              <Typography
                sx={{
                  fontSize: 8.8,
                  lineHeight: 1.6,
                }}
              >
                {c.bankName}
              </Typography>
            )}

            {c.accountName && (
              <Typography
                sx={{
                  fontSize: 8.8,
                  lineHeight: 1.6,
                }}
              >
                Account Name: {c.accountName}
              </Typography>
            )}

            {c.accountNumber && (
              <Typography
                sx={{
                  fontSize: 8.8,
                  lineHeight: 1.6,
                }}
              >
                A/c: {c.accountNumber}
              </Typography>
            )}

            {c.ifsc && (
              <Typography
                sx={{
                  fontSize: 8.8,
                  lineHeight: 1.6,
                }}
              >
                IFSC: {c.ifsc}
              </Typography>
            )}

            {c.branch && (
              <Typography
                sx={{
                  fontSize: 8.8,
                  lineHeight: 1.6,
                }}
              >
                Branch: {c.branch}
              </Typography>
            )}

            {/* PAYMENT HISTORY */}

            {payments.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <SectionTitle>Payment history</SectionTitle>

                {payments.map((payment, index) => (
                  <Box
                    key={payment.id || index}
                    sx={{
                      display: "flex",
                      gap: 2,
                      mb: 0.4,
                    }}
                  >
                    <Typography
                      sx={{
                        fontSize: "8.5px",
                        color: "#6b7280",
                      }}
                    >
                      {formatDate(payment.date)}
                    </Typography>

                    <Typography
                      sx={{
                        fontSize: "8.5px",
                        fontWeight: 600,
                      }}
                    >
                      {money(payment.amount)}
                    </Typography>

                    {payment.method && (
                      <Typography
                        sx={{
                          fontSize: "8.5px",
                          color: "#6b7280",
                        }}
                      >
                        {payment.method}
                      </Typography>
                    )}
                  </Box>
                ))}
              </Box>
            )}

            {/* NOTES */}

            {(c.notes || i.notes) && (
              <Box sx={{ mt: 2 }}>
                <SectionTitle>Notes</SectionTitle>

                <Typography
                  sx={{
                    fontSize: "8.5px",
                    lineHeight: 1.5,
                    color: "#374151",
                    whiteSpace: "pre-wrap",
                    maxWidth: 300,
                  }}
                >
                  {i.notes || c.notes}
                </Typography>
              </Box>
            )}

            {/* TERMS */}

            {c.terms && (
              <Box sx={{ mt: 2 }}>
                <SectionTitle>Terms & Conditions</SectionTitle>

                <Typography
                  sx={{
                    fontSize: "8px",
                    lineHeight: 1.5,
                    color: "#6b7280",
                    whiteSpace: "pre-wrap",
                    maxWidth: 330,
                  }}
                >
                  {c.terms}
                </Typography>
              </Box>
            )}
          </Box>

          {/* ==================================================
              RIGHT TOTALS
          ================================================== */}

          <Box>
            <TotalRow
              label="Subtotal:"
              value={`${i.currency || "₹"} ${money(subtotal)}`}
            />

            {discount > 0 && (
              <TotalRow
                label="Discount:"
                value={`- ${i.currency || "₹"} ${money(discount)}`}
              />
            )}

            {shippingCost > 0 && (
              <TotalRow
                label="Shipping Cost:"
                value={`${i.currency || "₹"} ${money(shippingCost)}`}
              />
            )}

            <TotalRow
              label="Taxable Amount:"
              value={`${i.currency || "₹"} ${money(taxableAmount)}`}
            />

            {/* GST */}

            {cgst > 0 && (
              <TotalRow
                label="CGST:"
                value={`${i.currency || "₹"} ${money(cgst)}`}
              />
            )}

            {sgst > 0 && (
              <TotalRow
                label="SGST:"
                value={`${i.currency || "₹"} ${money(sgst)}`}
              />
            )}

            {igst > 0 && (
              <TotalRow
                label="IGST:"
                value={`${i.currency || "₹"} ${money(igst)}`}
              />
            )}

            {roundOff !== 0 && (
              <TotalRow
                label="Round Off:"
                value={`${i.currency || "₹"} ${money(roundOff)}`}
              />
            )}

            <Box
              sx={{
                borderTop: "1px solid #111827",
                mt: 0.8,
                pt: 0.7,
              }}
            >
              <TotalRow
                label="Total:"
                value={`${i.currency || "₹"} ${money(grandTotal)}`}
                bold
              />
            </Box>

            <TotalRow
              label="Amount paid:"
              value={`${i.currency || "₹"} ${money(amountPaid)}`}
            />

            {/* BALANCE DUE */}

            <Box
              sx={{
                mt: 0.7,
                px: 1.2,
                py: 1,
                bgcolor: "#edf6ff",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Typography
                sx={{
                  fontSize: "10px",
                  fontWeight: 800,
                  color: "#111827",
                }}
              >
                Balance Due:
              </Typography>

              <Typography
                sx={{
                  fontSize: "11px",
                  fontWeight: 800,
                  color: "#111827",
                }}
              >
                {i.currency || "₹"} {money(balanceDue)}
              </Typography>
            </Box>

            {/* PAYMENT STATUS */}

            <Box
              sx={{
                mt: 1,
                textAlign: "right",
              }}
            >
              <Typography
                sx={{
                  fontSize: 8,
                  fontWeight: 800,
                  letterSpacing: 0.5,
                  color: statusIsPaid ? "#15803d" : "#b45309",
                }}
              >
                {status}
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* ====================================================
            AMOUNT IN WORDS
        ==================================================== */}

        {amountWords && (
          <Box
            sx={{
              mt: 2.5,
              pt: 1,
              borderTop: "1px solid #edf0f3",
            }}
          >
            <Typography
              sx={{
                fontSize: "8.5px",
                color: "#374151",
                lineHeight: 1.5,
              }}
            >
              <b>Amount in words:</b> {amountWords}
            </Typography>
          </Box>
        )}

        {/* ====================================================
            SIGNATURE / QR
        ==================================================== */}

        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            mt: 4,
            minHeight: 90,
          }}
        >
          {/* E-INVOICE INFO */}

          <Box
            sx={{
              maxWidth: "65%",
            }}
          >
            {i.irn && (
              <Typography
                sx={{
                  fontSize: "7.5px",
                  color: "#6b7280",
                  lineHeight: 1.5,
                  wordBreak: "break-all",
                }}
              >
                <b>IRN:</b> {i.irn}
              </Typography>
            )}

            {i.ackNo && (
              <Typography
                sx={{
                  fontSize: "7.5px",
                  color: "#6b7280",
                  lineHeight: 1.5,
                }}
              >
                <b>Ack No:</b> {i.ackNo}
              </Typography>
            )}

            {i.ackDate && (
              <Typography
                sx={{
                  fontSize: "7.5px",
                  color: "#6b7280",
                  lineHeight: 1.5,
                }}
              >
                <b>Ack Date:</b> {formatDate(i.ackDate)}
              </Typography>
            )}

            {i.qrCode && (
              <Box
                component="img"
                src={i.qrCode}
                alt="Invoice QR Code"
                sx={{
                  width: 75,
                  height: 75,
                  objectFit: "contain",
                  mt: 0.7,
                }}
              />
            )}
          </Box>

          {/* SIGNATURE */}

          <Box
            sx={{
              minWidth: 180,
              textAlign: "center",
            }}
          >
            {c.signature && (
              <Box
                component="img"
                src={c.signature}
                alt="Authorized Signature"
                sx={{
                  maxWidth: 130,
                  maxHeight: 55,
                  objectFit: "contain",
                  mb: 0.5,
                }}
              />
            )}

            {!c.signature && (
              <Box
                sx={{
                  height: 50,
                }}
              />
            )}

            <Box
              sx={{
                borderTop: "1px solid #111827",
                pt: 0.7,
              }}
            >
              <Typography
                sx={{
                  fontSize: "8.5px",
                  fontWeight: 700,
                }}
              >
                Authorized Signatory
              </Typography>

              <Typography
                sx={{
                  fontSize: "8px",
                  color: "#6b7280",
                  mt: 0.2,
                }}
              >
                For {companyName}
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* ====================================================
            FOOTER
        ==================================================== */}

        <Box
          sx={{
            mt: 3,
            pt: 1,
            borderTop: "1px solid #edf0f3",
            textAlign: "center",
          }}
        >
          <Typography
            sx={{
              fontSize: "7.5px",
              color: "#9ca3af",
            }}
          >
            {c.footer || "Thank you for your business."}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
