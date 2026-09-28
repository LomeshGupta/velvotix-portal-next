export type LineIn = { description: string; hsnSac?: string; qty: number; rate: number; discount?: number; taxPercent: number };
const r2 = (n: number) => Math.round(n * 100) / 100;
/** intra=true -> CGST+SGST split; false -> IGST. Rates come from input, never hard-coded. */
export function calcInvoice(items: LineIn[], intra: boolean) {
  const lines = items.map(i => {
    const taxable = r2(i.qty * i.rate - (i.discount ?? 0));
    const tax = r2((taxable * i.taxPercent) / 100);
    const cgst = intra ? r2(tax / 2) : 0, sgst = intra ? r2(tax / 2) : 0, igst = intra ? 0 : tax;
    return { ...i, discount: i.discount ?? 0, taxable, cgst, sgst, igst, lineTotal: r2(taxable + cgst + sgst + igst) };
  });
  const sum = (k: 'taxable' | 'cgst' | 'sgst' | 'igst' | 'discount') => r2(lines.reduce((a, l) => a + l[k], 0));
  const raw = r2(lines.reduce((a, l) => a + l.lineTotal, 0));
  const grandTotal = Math.round(raw);
  return { lines, subtotal: r2(lines.reduce((a, l) => a + l.qty * l.rate, 0)), discount: sum('discount'), taxable: sum('taxable'),
    cgst: sum('cgst'), sgst: sum('sgst'), igst: sum('igst'), roundOff: r2(grandTotal - raw), grandTotal };
}
