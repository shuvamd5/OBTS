process.env.NODE_ENV = 'test';

import assert from 'node:assert/strict';
import { generateSeatMap, seatAt, seatRows } from '../src/domain/seatmap.js';

let pass = 0;
const ok = (name) => {
  pass += 1;
  console.log(`  ok - ${name}`);
};

const sizes = (rows) => rows.map((r) => r.seats.length);
const sumRows = (rows) => rows.reduce((a, r) => a + r.seats.length, 0);

try {
  const cases = {
    29: [7, 7, 1, 7, 7],
    31: [8, 8, 1, 7, 7],
    33: [8, 8, 1, 8, 8],
    35: [9, 9, 1, 8, 8],
    37: [9, 9, 1, 9, 9],
    39: [10, 10, 1, 9, 9],
    41: [10, 10, 1, 10, 10],
    43: [11, 11, 1, 10, 10],
    45: [11, 11, 1, 11, 11],
  };
  for (const [n, expected] of Object.entries(cases)) {
    const layout = generateSeatMap(Number(n));
    assert.deepEqual(sizes(layout.rows), expected);
    assert.equal(sumRows(layout.rows), Number(n));
    assert.equal(layout.rows.length, 5);
    assert.equal(layout.blockB, expected[0] + expected[1]);
  }
  ok('row splits + blockB for 29 31 33 35 37 39 41 43 45');

  const g = generateSeatMap(37);
  assert.deepEqual(g.labels, [
    '2', '4', '6', '8', '10', '12', '14', '16', '18', // row 1 (driver side, evens)
    '1', '3', '5', '7', '9', '11', '13', '15', '17', // row 2 (odds)
    '19', // corridor seat
    '1', '3', '5', '7', '9', '11', '13', '15', '17', // row 4 (odds)
    '2', '4', '6', '8', '10', '12', '14', '16', '18', // row 5 (evens)
  ]);
  assert.equal(g.labels.length, 37);
  ok('labels follow the compartment numbering (evens/odds + corridor seat)');

  for (const bad of [0, 1, 27, 28, 30, 38, 44, -5]) {
    assert.throws(() => generateSeatMap(bad));
  }
  ok('rejects even + <=28 counts');

  assert.equal(seatAt(37, -1), null);
  assert.equal(seatAt(37, 37), null);
  assert.equal(seatAt(37, 0).sno, 1);
  assert.equal(seatAt(37, 0).blc, 'B');
  assert.equal(seatAt(37, 17).blc, 'B');
  assert.equal(seatAt(37, 18).blc, 'A');
  assert.equal(seatAt(39, 19).blc, 'B');
  assert.equal(seatAt(39, 20).blc, 'A');
  ok('seatAt sno/blc block split (37/39)');

  assert.equal(seatAt(37, 0).sna, '2');
  assert.equal(seatAt(37, 8).sna, '18');
  assert.equal(seatAt(37, 17).sna, '17');
  assert.equal(seatAt(37, 18).sna, '19');
  assert.equal(seatAt(37, 19).sna, '1');
  assert.equal(seatAt(37, 36).sna, '18');
  assert.equal(seatAt(39, 0).sna, '2');
  assert.equal(seatAt(39, 20).sna, '21');
  ok('seatAt returns the compartment-oriented labels');

  assert.equal(seatRows(45).length, 5);
  ok('seatRows wraps layoutFor');

  console.log(`\nPASS: ${pass} assertions`);
} finally {
  console.log('done');
}