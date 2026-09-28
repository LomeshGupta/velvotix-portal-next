const A = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const B = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
const two = (n: number) => (n < 20 ? A[n] : B[Math.floor(n / 10)] + (n % 10 ? ' ' + A[n % 10] : ''));
const three = (n: number) => (n > 99 ? A[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' : '') : '') + (n % 100 ? two(n % 100) : '');
export function rupeesInWords(n: number) {
  let x = Math.round(n); if (!x) return 'Indian Rupees Zero Only';
  let out = '';
  for (const [v, l] of [[10000000, 'Crore'], [100000, 'Lakh'], [1000, 'Thousand']] as const) if (x >= v) { out += three(Math.floor(x / v)) + ' ' + l + ' '; x %= v; }
  return 'Indian Rupees ' + (out + (x ? three(x) : '')).trim() + ' Only';
}
