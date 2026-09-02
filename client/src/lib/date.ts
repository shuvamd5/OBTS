export function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export function todayPlusDays(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return fmtDate(d.toISOString());
}