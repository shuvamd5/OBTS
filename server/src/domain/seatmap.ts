// seat-map geometry for each bus with nseat

import type { SeatInfo, SeatLayout, SeatRow } from '../../../shared/domain.js';

const cache = new Map<number, SeatLayout>();

export function generateSeatMap(n: number): SeatLayout {
  if (!Number.isInteger(n) || n <= 28 || n % 2 === 0)
    throw new Error(`Invalid seat count: ${n}`);
  const base = Math.floor((n - 1) / 4);
  const rowSizes = [base, base, 1, base, base];
  const rem = n - rowSizes.reduce((a, b) => a + b, 0);
  if (rem >= 1) rowSizes[0] += 1;
  if (rem >= 2) rowSizes[1] += 1;

  const labels = Array.from({ length: n }, (_, i) => `${i + 1}`);
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