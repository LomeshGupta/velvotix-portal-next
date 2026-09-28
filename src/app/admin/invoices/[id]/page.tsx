'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Box, Button, Typography } from '@mui/material';
import { rupeesInWords } from '@/lib/words';
type R = Record<string, string>;
const n = (v: string) => Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export default function InvoicePrint({ params }: { params: { id: string } }) {
  const [d, setD] = useState<{ invoice: R; items: R[]; payments: R[]; company: R | null; customer: R } | null>(null);
  useEffect(() => { fetch(`/api/invoices/${params.id}`).then(async r => r.ok && setD(await r.json())); }, [params.id]);
  if (!d) return <Box p={3}>Loading...</Box>;
  const { invoice: i, items, company: c, customer: u } = d, co = c || {};
  const cell = { border: '1px solid #999', padding: '4px 6px', fontSize: 12 } as const;
  const th = { ...cell, background: '#eef3fb', textAlign: 'left' } as const;
  const tot: [string, string][] = [['Subtotal', i.subtotal], ['Discount', i.discount], ['Taxable Amount', i.taxable], ['CGST', i.cgst], ['SGST', i.sgst], ['IGST', i.igst], ['Round Off', i.roundOff]];
  return (
    <Box sx={{ p: 2, bgcolor: '#f3f4f6', minHeight: '100vh', '@media print': { p: 0, bgcolor: '#fff' } }}>
      <style>{'@page{size:A4;margin:10mm} @media print{body{background:#fff!important}}'}</style>
      <Box className="no-print" sx={{ maxWidth: '210mm', mx: 'auto', mb: 2, display: 'flex', gap: 1 }}>
        <Button component={Link} href="/admin/invoices">Back</Button><Button variant="contained" onClick={() => window.print()}>Print / Save as PDF</Button></Box>
      <Box sx={{ width: '210mm', minHeight: '297mm', mx: 'auto', bgcolor: '#fff', color: '#000', p: '12mm', boxSizing: 'border-box', boxShadow: 3, '@media print': { boxShadow: 'none', width: '100%', p: 0 } }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #1565c0', pb: 1 }}>
          <Box>{co.logo && <img src={co.logo} alt="logo" height={44} />}<Typography variant="h6" fontWeight={800} color="#1565c0">{(co.name || 'Velvotix Solutions').toUpperCase()}</Typography>
            <Typography variant="caption" display="block">{[co.address, co.city, co.state, co.pin, co.country].filter(Boolean).join(', ')}</Typography>
            <Typography variant="caption" display="block">GSTIN: {co.gstin || '-'} | PAN: {co.pan || '-'}</Typography>
            <Typography variant="caption" display="block">{[co.email, co.phone, co.website].filter(Boolean).join(' | ')}</Typography></Box>
          <Box textAlign="right"><Typography variant="h5" fontWeight={800} color="#ef6c00">TAX INVOICE</Typography>
            <Typography variant="body2">No: <b>{i.number || i.id}</b></Typography><Typography variant="body2">Date: {i.date}</Typography><Typography variant="body2">Due: {i.dueDate}</Typography><Typography variant="body2">Status: {i.status}</Typography></Box>
        </Box>
        <Box sx={{ my: 1.5 }}><Typography variant="caption" fontWeight={700}>BILL TO</Typography><Typography fontWeight={700}>{u?.companyName}</Typography>
          <Typography variant="body2">{i.billingAddress || u?.billingAddress}</Typography><Typography variant="body2">GSTIN: {u?.gstin || '-'} | State: {u?.state || '-'}</Typography><Typography variant="body2">Place of Supply: {i.placeOfSupply}</Typography></Box>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr>{['Sr.', 'Description', 'HSN/SAC', 'Qty', 'Rate', 'Discount', 'Taxable', 'CGST', 'SGST', 'IGST', 'Amount'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
          <tbody>{items.map((x, k) => <tr key={x.id}><td style={cell}>{k + 1}</td><td style={cell}>{x.description}</td><td style={cell}>{x.hsnSac}</td><td style={cell}>{x.qty}</td><td style={cell}>{n(x.rate)}</td><td style={cell}>{n(x.discount)}</td><td style={cell}>{n(x.taxable)}</td><td style={cell}>{n(x.cgst)}</td><td style={cell}>{n(x.sgst)}</td><td style={cell}>{n(x.igst)}</td><td style={cell}>{n(x.lineTotal)}</td></tr>)}</tbody></table>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}><table style={{ borderCollapse: 'collapse', minWidth: 260 }}><tbody>
          {tot.map(([l, v]) => <tr key={l}><td style={cell}>{l}</td><td style={{ ...cell, textAlign: 'right' }}>{n(v)}</td></tr>)}
          <tr><td style={{ ...cell, fontWeight: 700 }}>Grand Total</td><td style={{ ...cell, textAlign: 'right', fontWeight: 700 }}>{n(i.grandTotal)}</td></tr>
          <tr><td style={cell}>Paid</td><td style={{ ...cell, textAlign: 'right' }}>{n(i.amountPaid)}</td></tr><tr><td style={cell}>Balance Due</td><td style={{ ...cell, textAlign: 'right' }}>{n(i.balanceDue)}</td></tr></tbody></table></Box>
        <Typography variant="body2" sx={{ mt: 1 }}><b>Amount in words:</b> {rupeesInWords(Number(i.grandTotal))}</Typography>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3, gap: 2 }}>
          <Box><Typography variant="caption" fontWeight={700}>BANK DETAILS</Typography><Typography variant="caption" display="block">{co.bankName} {co.accountName}</Typography>
            <Typography variant="caption" display="block">A/c: {co.accountNumber} IFSC: {co.ifsc} {co.branch}</Typography>
            <Typography variant="caption" fontWeight={700} display="block" mt={1}>TERMS & CONDITIONS</Typography><Typography variant="caption" display="block" sx={{ whiteSpace: 'pre-wrap' }}>{co.terms || 'Payment due as per terms.'}</Typography></Box>
          <Box textAlign="center" sx={{ alignSelf: 'flex-end' }}><Box sx={{ height: 50 }} /><Typography variant="caption">Authorized Signatory<br />{co.name || 'Velvotix Solutions'}</Typography></Box></Box>
        {co.footer && <Typography variant="caption" display="block" textAlign="center" mt={2}>{co.footer}</Typography>}
      </Box>
    </Box>);
}
