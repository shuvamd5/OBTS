// seat-map geometry for each bus with nseat

import type { SeatInfo, SeatLayout, SeatRow } from '../../../shared/domain.js';

const cache = new Map<number, SeatLayout>();

const evens = (count: number): string[] =>
  Array.from({ length: count }, (_, i) => String(2 + i * 2));
const odds = (count: number): string[] =>
  Array.from({ length: count }, (_, i) => String(1 + i * 2));

export function generateSeatMap(n: number): SeatLayout {
  if (!Number.isInteger(n) || n <= 28 || n % 2 === 0)
    throw new Error(`Invalid seat count: ${n}`);
  const base = Math.floor((n - 1) / 4);
  const rowSizes = [base, base, 1, base, base];
  const rem = n - rowSizes.reduce((a, b) => a + b, 0);
  if (rem >= 1) rowSizes[0] += 1;
  if (rem >= 2) rowSizes[1] += 1;

  // Labels run per compartment: the B block (rows 1-2, behind the driver) carries
  // even seats on row 1 and odd seats on row 2, closed by a single corridor seat;
  // the A block (rows 4-5) restarts with odds on row 4 and evens on row 5. This
  // mirrors the seat numbering the reference app shows in its seat map.
  const labels = [
    ...evens(rowSizes[0]), // row 1   2,4,6,8...
    ...odds(rowSizes[1]), // row 2   1,3,5,7...
    String(2 * rowSizes[0] + 1), // corridor seat, flush with the last column
    ...odds(rowSizes[3]), // row 4   1,3,5,7...
    ...evens(rowSizes[4]), // row 5   2,4,6,8...
  ];

  const names: (string | null)[] = ['Driver', null, 'Corridor', null, 'Door'];
  const rows: SeatRow[] = [];
  let iter = 0;
  rowSizes.forEach((count, i) => {
    rows.push({ left: names[i], seats: Array.from({ length: count }, () => iter++) });
  });

  return { labels, rows, blockB: rowSizes[0] + rowSizes[1] };
}

export function layoutFor(n: number): SeatLayout {
  const hit = cache.get(n);
  if (hit) return hit;
  const layout = generateSeatMap(n);
  cache.set(n, layout);
  return layout;
}

export function seatAt(n: number, iter: number): SeatInfo | null {
  if (iter < 0 || iter >= n) return null;
  const layout = layoutFor(n);
  return { sno: iter + 1, blc: iter < layout.blockB ? 'B' : 'A', sna: layout.labels[iter] };
}

export const seatRows = (n: number): SeatRow[] => layoutFor(n).rows;