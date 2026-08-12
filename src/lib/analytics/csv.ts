// Minimal, correct CSV (RFC-4180-ish): quotes fields containing comma/quote/
// newline and doubles embedded quotes. Kept pure + tested.
//
// Also neutralizes spreadsheet formula injection: a TEXT cell beginning with
// = + - @ (or tab/CR) is interpreted as a formula by Excel/Sheets, and these
// exports include advertiser-controlled strings (creative/campaign names). We
// prefix such a cell with a single quote so it's shown literally. Numeric cells
// are never touched, so real negative numbers stay numbers.
export function toCsv(headers: string[], rows: (string | number)[][]): string {
  const esc = (v: string | number) => {
    let s = String(v ?? '');
    if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  return [headers.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))].join('\r\n');
}
