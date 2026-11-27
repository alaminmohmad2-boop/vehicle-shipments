// CSV that Excel opens correctly (UTF-8 with a byte order mark, so Arabic shows).

/** Quotes a cell; a leading = + - @ is neutralised so a spreadsheet never runs it as a formula. */
export function cell(value: string | number | null | undefined): string {
  let text = value == null ? "" : String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(
  header: string[],
  rows: (string | number | null | undefined)[][],
): string {
  return (
    "\uFEFF" +
    [header, ...rows].map((row) => row.map(cell).join(",")).join("\r\n") +
    "\r\n"
  );
}

/** 125050 → "1250.50" (plain number, no thousands separators, for spreadsheets). */
export function minorToDecimal(minor: number): string {
  const sign = minor < 0 ? "-" : "";
  const abs = Math.abs(minor);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}
