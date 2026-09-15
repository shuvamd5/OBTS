export interface SeatLayout {
  count: number;
  blockB: number;
  rows: number[];
}

export function generateSeatMap(n: number): SeatLayout {
  if (n <= 28 || n % 2 === 0) throw new Error("Seat count must be an odd integer > 28");

  const base = Math.floor((n - 1) / 4);
  const rows = [base, base, 1, base, base];
  const rem = n - rows.reduce((a, b) => a + b, 0);
  if (rem >= 1) rows[0] += 1;
  if (rem >= 2) rows[1] += 1;

  return { count: n, blockB: rows[0] + rows[1], rows };
}