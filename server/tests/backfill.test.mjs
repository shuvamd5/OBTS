// Backfill regression: the startup status backfills must not clobber live statuses.
// (Regression for the $switch literal-string bug that forced EVERY schedule/price
// to 'pending' and every legacy ticket to 'paid' on every server boot.)
// Run with the rest of the suite via `npm test`.
process.env.NODE_ENV = 'test';

import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '../src/config/db.js';
import BusSchedule from '../src/models/BusSchedule.js';
import ScheduleRoute from '../src/models/ScheduleRoute.js';
import Ticket from '../src/models/Ticket.js';
import { backfillScheduleStatuses } from '../src/utils/backfillScheduleStatuses.js';
import { backfillPaymentStatus } from '../src/utils/backfillPaymentStatus.js';

let pass = 0;
const ok = (name) => {
  pass += 1;
  console.log(`  ok - ${name}`);
};

const clean = { sched: [], price: [], ticket: [] };

try {
  await connectDB();
  const now = Date.now().toString(36);
  const OID = () => new mongoose.Types.ObjectId();

  const schedBase = {
    bid: OID(),
    trdate: new Date(),
    trtime: '07:30',
    bssapby: 'none',
    deletedAt: null,
  };
  const sApproved = OID();
  const sGo = OID();
  const sNotApproved = OID();
  const sExpired = OID();
  const sNotGoing = OID();
  clean.sched.push(sApproved, sGo, sNotApproved, sExpired, sNotGoing);
  await BusSchedule.collection.insertMany([
    { _id: sApproved, ...schedBase, bsstatus: 'approved' },
    { _id: sGo, ...schedBase, bsstatus: 'going' },
    { _id: sNotApproved, ...schedBase, bsstatus: 'not approved' },
    { _id: sExpired, ...schedBase, bsstatus: 'Expired' },
    { _id: sNotGoing, ...schedBase, bsstatus: 'not going' },
  ]);

  // Biject bsid so the partial-unique price index does not collide.
  const priceBase = (bsid) => ({ bsid, rid: OID(), price: 100, deletedAt: null });
  const arApproved = OID();
  const arOk = OID();
  const arUnchecked = OID();
  clean.price.push(arApproved, arOk, arUnchecked);
  await ScheduleRoute.collection.insertMany([
    { _id: arApproved, ...priceBase(sGo), arstatus: 'approved' },
    { _id: arOk, ...priceBase(sNotApproved), arstatus: 'ok' },
    { _id: arUnchecked, ...priceBase(sExpired), arstatus: 'unchecked' },
  ]);

  const ticketBase = (tstatus) => ({
    arid: OID(),
    ssid: OID(),
    trdate: new Date(),
    trtime: '07:30',
    sno: 1,
    blc: 'BA 1 KA 1234',
    sna: '1',
    price: 100,
    uid: OID(),
    treby: 'backfill-test',
    tstatus,
  });
  const tPaid = OID();
  const tDue = OID();
  const tClear = OID();
  clean.ticket.push(tPaid, tDue, tClear);
  await Ticket.collection.insertMany([
    { _id: tPaid, ...ticketBase('reserved'), paymentStatus: 'paid' },
    { _id: tDue, ...ticketBase('held'), payment: 'due' },
    { _id: tClear, ...ticketBase('held'), payment: 'Clear' },
  ]);

  await backfillScheduleStatuses();

  const sched = await BusSchedule.collection
    .find({ _id: { $in: clean.sched } })
    .toArray();
  const byId = (id) => sched.find((s) => String(s._id) === String(id)).bsstatus;
  assert.equal(byId(sApproved), 'approved', 'approved schedule survives restart backfill');
  assert.equal(byId(sGo), 'approved', "legacy 'going' -> approved");
  assert.equal(byId(sNotApproved), 'pending', "legacy 'not approved' -> pending");
  assert.equal(byId(sExpired), 'expired', "legacy 'Expired' -> expired");
  assert.equal(byId(sNotGoing), 'not_going', "legacy 'not going' -> not_going");
  ok('backfillScheduleStatuses: approved survives, legacy values remapped correctly');

  const prices = await ScheduleRoute.collection
    .find({ _id: { $in: clean.price } })
    .toArray();
  const priceById = (id) =>
    prices.find((p) => String(p._id) === String(id)).arstatus;
  assert.equal(priceById(arApproved), 'approved', 'approved price survives restart backfill');
  assert.equal(priceById(arOk), 'approved', "legacy 'ok' -> approved");
  assert.equal(priceById(arUnchecked), 'pending', "legacy 'unchecked' -> pending");
  ok('backfillScheduleStatuses: approved price survives, legacy statuses remapped');

  await backfillPaymentStatus();

  const tickets = await Ticket.collection
    .find({ _id: { $in: clean.ticket } })
    .toArray();
  const tById = (id) => tickets.find((t) => String(t._id) === String(id));
  assert.equal(tById(tPaid).paymentStatus, 'paid', 'paid ticket survives restart backfill');
  assert.equal(tById(tDue).paymentStatus, 'pending', "legacy 'due' -> pending");
  assert.equal(tById(tClear).paymentStatus, 'paid', "legacy 'Clear' -> paid");
  ok('backfillPaymentStatus: paid survives, legacy payment field mapped correctly');

  console.log(`\nPASS: ${pass} assertions`);
} finally {
  await Ticket.collection.deleteMany({ _id: { $in: clean.ticket } });
  await ScheduleRoute.collection.deleteMany({ _id: { $in: clean.price } });
  await BusSchedule.collection.deleteMany({ _id: { $in: clean.sched } });
  await disconnectDB();
  console.log('cleaned up');
}