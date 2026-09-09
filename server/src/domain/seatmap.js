// seat-map geometry for each bus with nseat 

const LABELS_37 = [
  'H', '2', '4', '6', '8', '10', '12', '14', '16',
  'G', '1', '3', '5', '7', '9', '11', '13', '15',
  '17',
  '\u0915', '2', '4', '6', '8', '10', '12', '14', '16',
  '\u0916', '1', '3', '5', '7', '9', '11', '13', '15',
];

const LABELS_39 = [
  '2', '4', '6', '8', '10', '12', '14', '16', '18', '20',
  '1', '3', '5', '7', '9', '11', '13', '15', '17', '19',
  '19',
  '2', '4', '6', '8', '10', '12', '14', '16', '18',
  '1', '3', '5', '7', '9', '11', '13', '15', '17',
];

const BLOCK_B_37 = 18;
const BLOCK_B_39 = 20;

const ROWS_37 = [
  { left: 'Driver', seats: [0, 1, 2, 3, 4, 5, 6, 7, 8] },
  { left: null, seats: [9, 10, 11, 12, 13, 14, 15, 16, 17] },
  { left: 'Corridor', seats: [18] },
  { left: null, seats: [19, 20, 21, 22, 23, 24, 25, 26, 27] },
  { left: 'Door', seats: [28, 29, 30, 31, 32, 33, 34, 35, 36] },
];

const ROWS_39 = [
  { left: 'Driver', seats: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] },
  { left: null, seats: [10, 11, 12, 13, 14, 15, 16, 17, 18, 19] },
  { left: 'Corridor', seats: [20] },
  { left: null, seats: [21, 22, 23, 24, 25, 26, 27, 28, 29] },
  { left: null, seats: [30, 31, 32, 33, 34, 35, 36, 37, 38] },
];

const LAYOUTS = {
  37: { labels: LABELS_37, rows: ROWS_37, blockB: BLOCK_B_37 },
  39: { labels: LABELS_39, rows: ROWS_39, blockB: BLOCK_B_39 },
};

export function layoutFor(nseat) {
  return LAYOUTS[nseat] ?? LAYOUTS[37];
}


export function seatAt(nseat, iter) {
  const layout = layoutFor(nseat);
  if (!layout.labels[iter]) return null;
  return {
    sno: iter + 1,
    blc: iter < layout.blockB ? 'B' : 'A',
    sna: layout.labels[iter],
  };
}

export const seatRows = (nseat) => layoutFor(nseat).rows;