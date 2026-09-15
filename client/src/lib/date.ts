export function fmtDate(iso: string): string {
  // Date-only strings (YYYY-MM-DD) are never shifted: parsing them with
  // `new Date()` reads them as UTC midnight and local getters can move the
  // day back for negative offsets.
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    return iso;
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export function todayPlusDays(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return fmtDate(d.toISOString());
}