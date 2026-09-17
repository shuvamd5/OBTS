// K5 unit — duration parsing + arrival-time helpers. No DB. Run: node tests/route-duration.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseDurationToMinutes,
  minutesToHHMM,
  computeArrival,
} from '../src/utils/routeDuration.js';

test('parseDurationToMinutes accepts common formats', () => {
  assert.equal(parseDurationToMinutes('6 hours'), 360);
  assert.equal(parseDurationToMinutes('6 hours 30 minutes'), 390);
  assert.equal(parseDurationToMinutes('1 hr 30 min'), 90);
  assert.equal(parseDurationToMinutes('6h'), 360);
  assert.equal(parseDurationToMinutes('06:30'), 390);
  assert.equal(parseDurationToMinutes('6'), 360);
  assert.equal(parseDurationToMinutes('3.5 hours'), 210);
});

test('parseDurationToMinutes returns null for unknown values', () => {
  assert.equal(parseDurationToMinutes('TBD'), null);
  assert.equal(parseDurationToMinutes('n/a'), null);
  assert.equal(parseDurationToMinutes(''), null);
  assert.equal(parseDurationToMinutes('   '), null);
  assert.equal(parseDurationToMinutes('none'), null);
  assert.equal(parseDurationToMinutes(null), null);
  assert.equal(parseDurationToMinutes(360), null);
});

test('minutesToHHMM formats and guards', () => {
  assert.equal(minutesToHHMM(390), '06:30');
  assert.equal(minutesToHHMM(0), '00:00');
  assert.equal(minutesToHHMM(1440), '00:00');
  assert.equal(minutesToHHMM(-5), null);
  assert.equal(minutesToHHMM('60'), null);
});

test('computeArrival derives HH:MM from departure + duration', () => {
  assert.equal(computeArrival('07:30', 390), '14:00');
  assert.equal(computeArrival('23:00', 120), '01:00');
  assert.equal(computeArrival('07:30', null), null);
  assert.equal(computeArrival('07:30', -10), null);
  assert.equal(computeArrival('bad', 60), null);
  assert.equal(computeArrival('07:30', '60'), null);
});