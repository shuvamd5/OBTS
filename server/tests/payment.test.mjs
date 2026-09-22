// Module 9 e2e — Payment System (cash desk, refund, mock online gateway).
// Run: `node tests/payment.test.mjs`
process.env.NODE_ENV = 'test';

import request from 'supertest';
import assert from 'node:assert/strict';
import { app } from '../src/index.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import User from '../src/models/User.js';
import Route from '../src/models/Route.js';
import Bus from '../src/models/Bus.js';
import BusType from '../src/models/BusType.js';
import BusSchedule from '../src/models/BusSchedule.js';
import ScheduleRoute from '../src/models/ScheduleRoute.js';
import Sales from '../src/models/Sales.js';
import Seat from '../src/models/Seat.js';
import Ticket from '../src/models/Ticket.js';
import Payment from '../src/models/Payment.js';
import { backfillPaidPayments } from '../src/utils/backfillPaymentStatus.js';

const uniq = Date.now().toString(36);
const cleanup = { userIds: [], busIds: [], busTypeIds: [], schedIds: [], priceIds: [], routeIds: [] };
let mobSeq = 0;
const mobile = () => `978${String((Date.now() + mobSeq++) % 10000000).padStart(7, '0')}`;
const day = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
};
const auth = (t) => ({ Authorization: `Bearer ${t}` });
const pax = { passenger: { name: 'Pay User', phone: '9800000000', age: 30, gender: 'Female' } };
const bookRefs = [];
let pass = 0;

let price;
let sched;
let bus;
const ok = (name) => {
  pass += 1;
  console.log(`  ok - ${name}`);
};

async function login(email, pass2) {
  const r = await request(app).post('/api/auth/login').send({ logid: email, logpass: pass2 });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return r.body;
}

async function register(uname) {
  const u = {
    uname,
    upass: 'Test@1234',
    ugender: 'Female',
    uemail: `${uname}_${uniq}@test.com`,
    umobile: mobile(),
  };
  const r = await request(app).post('/api/auth/register').send(u);
  assert.equal(r.status, 201, JSON.stringify(r.body));
  cleanup.userIds.push(r.body.user._id);
  return r.body.user;
}

const fetchUser = async (uid) => (await User.findById(uid).lean());
const fetchSales = async (bsid) => (await Sales.findOne({ bsid }).lean())?.sales ?? 0;

try {
  await connectDB();

  const adminLogin = await request(app)
    .post('/api/auth/login')
    .send({
      logid: process.env.DEFAULT_ADMIN_EMAIL || 'superadmin@obts.dev',
      logpass: process.env.DEFAULT_ADMIN_PASS || 'OBTSAdmin@1234',
    });
  assert.equal(adminLogin.status, 200, 'default admin login failed');
  const adminToken = adminLogin.body.accessToken;

  const cashUser = await register('CashUser');
  const cashToken = (await login(cashUser.uemail, 'Test@1234')).accessToken;
  const onlineUser = await register('OnlineUser');
  const onlineToken = (await login(onlineUser.uemail, 'Test@1234')).accessToken;
  const opUser = await register('PayOp');
  const roleR = await request(app)
    .patch(`/api/users/${opUser._id}/role`)
    .set(auth(adminToken))
    .send({ ustatus: 'operator' });
  assert.equal(roleR.status, 200, JSON.stringify(roleR.body));
  const opToken = (await login(opUser.uemail, 'Test@1234')).accessToken;

  // Real bookable pipeline (shared by both customers).
  const cr = await request(app)
    .post('/api/routes')
    .set(auth(adminToken))
    .send({ sp: 'Butwal', fp: 'Pokhara', distance: 190, duration: '5h' });
  assert.equal(cr.status, 201, JSON.stringify(cr.body));
  const routeId = cr.body.route._id;
  cleanup.routeIds.push(routeId);

  const bt = await BusType.create({ name: `T37_${uniq}`, seatCount: 37, seatStyle: 'luxury' });
  cleanup.busTypeIds.push(String(bt._id));

  const busR = await request(app)
    .post('/api/buses')
    .set(auth(adminToken))
    .send({ plateNumber: `BA 1 KA ${(Date.now() % 90000) + 10000}`, busTypeId: bt._id, bname: 'Pay Bus' });
  assert.equal(busR.status, 201, JSON.stringify(busR.body));
  bus = busR.body.bus;
  cleanup.busIds.push(bus._id);
  await request(app)
    .patch(`/api/buses/${bus._id}/status`)
    .set(auth(adminToken))
    .send({ bstatus: 'active' });

  const sc = await request(app)
    .post('/api/schedules')
    .set(auth(adminToken))
    .send({ bid: bus._id, trdate: day(8), trtime: '07:30' });
  assert.equal(sc.status, 201, JSON.stringify(sc.body));
  sched = sc.body.schedule;
  cleanup.schedIds.push(sched._id);
  await request(app)
    .patch(`/api/schedules/${sched._id}/status`)
    .set(auth(adminToken))
    .send({ bsstatus: 'approved' });

  const pr = await request(app)
    .post('/api/prices')
    .set(auth(adminToken))
    .send({ bsid: sched._id, rid: routeId, price: 1000 });
  assert.equal(pr.status, 201, JSON.stringify(pr.body));
  price = pr.body.scheduleRoute;
  cleanup.priceIds.push(price._id);
  await request(app)
    .patch(`/api/prices/${price._id}/status`)
    .set(auth(adminToken))
    .send({ arstatus: 'approved' });

  // ---- G7: booking creates Payment docs + paymentStatus pending ----
  let r = await request(app)
    .post('/api/bookings/confirm')
    .set(auth(cashToken))
    .send({ arid: price._id, sno: [1, 2], sp: 'Butwal', fp: 'Pokhara', ...pax });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  bookRefs.push(r.body.bookingRef);
  const aT1 = String(r.body.tickets[0]._id);
  const aT2 = String(r.body.tickets[1]._id);
  assert.equal(r.body.tickets[0].paymentStatus, 'pending');
  assert.ok(r.body.tickets[0].paymentId, 'ticket carries paymentId');
  assert.equal(r.body.payments.length, 2);
  assert.ok(r.body.payments.every((p) => p.status === 'pending' && p.amount === 1000));
  assert.equal(await Payment.countDocuments({ userId: cashUser._id, status: 'pending' }), 2);
  assert.equal((await fetchUser(cashUser._id)).payment, 0);
  let sales = await fetchSales(sched._id);
  assert.equal(sales, 0);
  ok('G7 confirm mints 2 pending Payments (amounts 1000) + ticket.paymentStatus=pending');

  // ---- G2 guards ----
  r = await request(app).post('/api/payments/create').send({ ticketId: aT1 });
  assert.equal(r.status, 401);
  ok('guest payments/create -> 401');

  // ---- G5 permission + cash mark-paid ----
  r = await request(app)
    .post('/api/payments/cash')
    .set(auth(cashToken))
    .send({ ticketId: aT1 });
  assert.equal(r.status, 403);
  ok('customer payments/cash -> 403');

  r = await request(app).post('/api/payments/cash').set(auth(opToken)).send({ ticketId: aT1 });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const t1 = await Ticket.findById(aT1).lean();
  assert.equal(t1.paymentStatus, 'paid');
  assert.equal(t1.tstatus, 'reserved');
  assert.equal(t1.pyreby, opUser.uname);
  const seat1 = await Seat.findById(t1.ssid).lean();
  assert.equal(seat1.status, 'reserved');
  assert.equal(seat1.lockExpiry, null);
  const pay1 = await Payment.findOne({ ticketId: aT1 }).lean();
  assert.equal(pay1.status, 'paid');
  assert.equal(pay1.method, 'cash');
  assert.equal(pay1.receivedBy, opUser.uname);
  let uCash = await fetchUser(cashUser._id);
  assert.equal(uCash.payment, 1000);
  assert.equal(uCash.due, 1000);
  assert.equal(uCash.reservedtc, 2);
  sales = await fetchSales(sched._id);
  assert.equal(sales, 1000);
  ok('G5 operator cash clears ticket (ledger + sales + ticket/seat status)');

  r = await request(app).post('/api/payments/cash').set(auth(opToken)).send({ ticketId: aT1 });
  assert.equal(r.status, 400);
  assert.equal(r.body.message, 'Payment already made');
  ok('double cash mark-paid -> 400');

  // ---- G6: refund = full cancel (admin only) ----
  r = await request(app)
    .post(`/api/payments/${pay1._id}/refund`)
    .set(auth(cashToken));
  assert.equal(r.status, 403);
  ok('customer refund -> 403');

  r = await request(app)
    .post(`/api/payments/${pay1._id}/refund`)
    .set(auth(opToken));
  assert.equal(r.status, 403);
  ok('operator refund -> 403 (admin only)');

  r = await request(app).patch(`/api/bookings/tickets/${aT1}/cancel`).set(auth(cashToken));
  assert.equal(r.status, 400);
  assert.equal(r.body.message, 'Ticket payment already made — refund it first');
  ok('paid ticket cannot be user-cancelled -> refund required');

  r = await request(app)
    .post(`/api/payments/${pay1._id}/refund`)
    .set(auth(adminToken));
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const paidSeatBefore = await Seat.findById(t1.ssid).lean();
  const paidSeatCount = await Seat.countDocuments({ _id: t1.ssid });
  if (paidSeatCount === 0) {
    ok('refund fully deletes the seat (countDocuments 0)');
  } else {
    assert.ok(paidSeatBefore.deletedAt, 'seat gone');
  }
  const t1After = await Ticket.findById(aT1).lean();
  assert.equal(t1After.tstatus, 'cancelled');
  assert.equal(t1After.paymentStatus, 'refunded');
  const pay1After = await Payment.findById(pay1._id).lean();
  assert.equal(pay1After.status, 'refunded');
  uCash = await fetchUser(cashUser._id);
  assert.equal(uCash.totaltc, 1);
  assert.equal(uCash.reservedtc, 1);
  assert.equal(uCash.payment, 0);
  assert.equal(uCash.due, 2000);
  assert.equal(uCash.points, 1);
  sales = await fetchSales(sched._id);
  assert.equal(sales, 0);
  ok('G6 admin refund fully cancels (seat deleted, ledger + sales reversed)');

  r = await request(app)
    .post(`/api/payments/${pay1._id}/refund`)
    .set(auth(adminToken));
  assert.equal(r.status, 200);
  assert.equal(r.body.message, 'No change');
  ok('double refund -> No change');

  // cash the second cash-user ticket, confirm no ledger double-count on refunds
  r = await request(app).post('/api/payments/cash').set(auth(opToken)).send({ ticketId: aT2 });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  let pay2 = await Payment.findOne({ ticketId: aT2 }).lean();
  r = await request(app)
    .post(`/api/payments/${pay2._id}/refund`)
    .set(auth(adminToken));
  assert.equal(r.status, 200, JSON.stringify(r.body));
  uCash = await fetchUser(cashUser._id);
  assert.equal(uCash.totaltc, 0);
  assert.equal(uCash.reservedtc, 0);
  assert.equal(uCash.payment, 0);
  assert.equal(uCash.due, 2000);
  assert.equal(uCash.points, 0);
  assert.equal(await Seat.countDocuments({ arid: price._id }), 0);
  assert.equal(await fetchSales(sched._id), 0);
  ok('second paid ticket refund leaves clean ledger + seats released');

  // ---- G3: online mock gateway lifecycle ----
  r = await request(app)
    .post('/api/bookings/confirm')
    .set(auth(onlineToken))
    .send({ arid: price._id, sno: [3, 4], sp: 'Butwal', fp: 'Pokhara', ...pax });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  const bRef = String(r.body.bookingRef);
  bookRefs.push(bRef);

  r = await request(app)
    .post('/api/payments/create')
    .set(auth(onlineToken))
    .send({ bookingRef: bRef });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  const txn = r.body.transactionId;
  assert.ok(txn && txn.length >= 12, 'transactionId minted');
  assert.equal(r.body.amount, 2000);
  assert.equal(r.body.payments.length, 2);
  const pPayId = String(r.body.payments[0]._id);
  ok('G2 create(bookingRef) starts online gateway txn for the group');

  r = await request(app).post('/api/payments/create').set(auth(cashToken)).send({ bookingRef: bRef });
  assert.equal(r.status, 400);
  ok('another user cannot create payment for someone else booking -> 400');

  r = await request(app).get(`/api/payments/${pPayId}`).set(auth(cashToken));
  assert.equal(r.status, 403);
  r = await request(app).get(`/api/payments/${pPayId}`).set(auth(onlineToken));
  assert.equal(r.status, 200);
  assert.equal(r.body.payment.status, 'pending');
  ok('payment callback status scoped to owner');

  r = await request(app)
    .post('/api/payments/verify')
    .set(auth(onlineToken))
    .send({ transactionId: txn });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.count, 2);
  let uOnline = await fetchUser(onlineUser._id);
  assert.equal(uOnline.payment, 2000);
  assert.equal(uOnline.due, 0);
  assert.equal(uOnline.totaltc, 2);
  assert.equal(uOnline.reservedtc, 2);
  assert.equal(uOnline.points, 2);
  const bTickets = await Ticket.find({ bookingRef: bRef }).lean();
  assert.ok(bTickets.every((t) => t.paymentStatus === 'paid' && t.tstatus === 'reserved'));
  assert.equal(
    await Payment.countDocuments({ bookingRef: bRef, status: 'paid' }),
    2
  );
  assert.equal(await fetchSales(sched._id), 2000);
  ok('G3 verify pays the group (ledger + sales + all tickets paid)');

  r = await request(app)
    .post('/api/payments/verify')
    .set(auth(onlineToken))
    .send({ transactionId: txn });
  assert.equal(r.status, 200);
  assert.equal(r.body.count, 0);
  assert.equal(r.body.message, 'No change');
  ok('double verify is idempotent (No change)');

  r = await request(app)
    .post('/api/payments/webhook')
    .send({ transactionId: txn, status: 'paid' });
  assert.equal(r.status, 200);
  assert.equal(r.body.count, 0);
  ok('G4 webhook on already-paid txn is idempotent');

  r = await request(app).post('/api/payments/create').set(auth(onlineToken)).send({ bookingRef: bRef });
  assert.equal(r.status, 400);
  assert.equal(r.body.message, 'No pending payment for this booking');
  ok('create after paid -> 400 no pending payment');

  // failed gateway callback leaves ticket pending (desk can still clear)
  r = await request(app)
    .post('/api/bookings/confirm')
    .set(auth(onlineToken))
    .send({ arid: price._id, sno: [5], sp: 'Butwal', fp: 'Pokhara', ...pax });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  bookRefs.push(r.body.bookingRef);
  const cTicket = String(r.body.tickets[0]._id);

  r = await request(app).post('/api/payments/create').set(auth(onlineToken)).send({ ticketId: cTicket });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  const cTxn = r.body.transactionId;
  const uOnlineBefore = await fetchUser(onlineUser._id);
  const salesBefore = await fetchSales(sched._id);
  r = await request(app)
    .post('/api/payments/verify')
    .set(auth(onlineToken))
    .send({ transactionId: cTxn, status: 'failed' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.count, 1);
  const cPay = await Payment.findOne({ ticketId: cTicket }).lean();
  assert.equal(cPay.status, 'failed');
  const cTicketDoc = await Ticket.findById(cTicket).lean();
  assert.equal(cTicketDoc.paymentStatus, 'pending');
  const uOnlineAfter = await fetchUser(onlineUser._id);
  assert.equal(uOnlineAfter.payment, uOnlineBefore.payment);
  assert.equal(uOnlineAfter.due, uOnlineBefore.due);
  assert.equal(await fetchSales(sched._id), salesBefore);
  ok('failed gateway callback -> Payment failed, ticket stays pending, ledger untouched');

  // G8: desk passengers list surfaces paymentStatus + paymentId
  r = await request(app).get('/api/bookings/passengers').set(auth(adminToken));
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const withRows = r.body.schedules.find((s) => s.tickets.some((t) => t.paymentStatus === 'paid'));
  assert.ok(withRows, 'desk returns paid tickets');
  const paidRow = withRows.tickets.find((t) => t.paymentStatus === 'paid');
  assert.ok(paidRow.bus, 'desk row enriched with bus');
  ok('G8 passengers list exposes paymentStatus + enrichment');

  // ---- legacy paid tickets get a minted Payment doc (desk refund support) ----
  const legacyUser = await register('LegacyPay');
  const legacyToken = (await login(legacyUser.uemail, 'Test@1234')).accessToken;
  r = await request(app)
    .post('/api/bookings/confirm')
    .set(auth(legacyToken))
    .send({ arid: price._id, sno: 6, sp: 'Butwal', fp: 'Pokhara', ...pax });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  const legacyRef = String(r.body.bookingRef);
  bookRefs.push(legacyRef);
  const legacyTicketId = String(r.body.tickets[0]._id);
  const legacySeatId = String(r.body.seats[0]._id);
  // simulate a ticket paid under the old system: paid status + consistent ledger,
  // but no Payment collection row.
  await Ticket.updateOne({ _id: legacyTicketId }, { $set: { paymentStatus: 'paid' } });
  await User.updateOne({ _id: legacyUser._id }, { $inc: { payment: 1000, due: -1000 } });
  await Payment.deleteOne({ ticketId: legacyTicketId });
  assert.equal(await Payment.countDocuments({ ticketId: legacyTicketId }), 0);

  const minted = await backfillPaidPayments();
  assert.ok(minted >= 1, 'backfill mints legacy paid payment docs');
  const legacyPay = await Payment.findOne({ ticketId: legacyTicketId }).lean();
  assert.ok(legacyPay, 'Payment doc minted for legacy paid ticket');
  assert.equal(legacyPay.status, 'paid');
  assert.equal(legacyPay.amount, 1000);
  assert.equal(String(legacyPay.bookingRef), legacyRef);

  r = await request(app).get('/api/bookings/passengers').set(auth(adminToken));
  const legacyRow = r.body.schedules
    .flatMap((s) => s.tickets)
    .find((t) => String(t._id) === legacyTicketId);
  assert.ok(legacyRow, 'legacy paid ticket listed in desk');
  assert.equal(legacyRow.paymentStatus, 'paid');
  assert.equal(String(legacyRow.paymentId), String(legacyPay._id), 'desk row carries paymentId for refund');

  r = await request(app).post(`/api/payments/${legacyPay._id}/refund`).set(auth(adminToken));
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const legacyAfter = await Ticket.findById(legacyTicketId).lean();
  assert.equal(legacyAfter.tstatus, 'cancelled');
  assert.equal(legacyAfter.paymentStatus, 'refunded');
  assert.equal(await Seat.countDocuments({ _id: legacySeatId }), 0, 'legacy refund releases seat');
  const lLegacy = await fetchUser(legacyUser._id);
  assert.equal(lLegacy.totaltc, 0);
  assert.equal(lLegacy.reservedtc, 0);
  assert.equal(lLegacy.payment, 0);
  assert.equal(lLegacy.due, 1000);
  assert.equal(lLegacy.points, 0);
  ok('legacy paid ticket: backfill mints Payment doc -> desk paymentId -> refund works');

  console.log(`\nPASS: ${pass} assertions`);
} finally {
  await User.deleteMany({ _id: { $in: cleanup.userIds } });
  if (price) {
    await Payment.deleteMany({ bookingRef: { $in: bookRefs } });
    await Ticket.deleteMany({ arid: price._id });
    await Seat.deleteMany({ arid: price._id });
  }
  await Sales.deleteMany({ bsid: { $in: cleanup.schedIds } });
  await ScheduleRoute.deleteMany({ _id: { $in: cleanup.priceIds } });
  await BusSchedule.deleteMany({ _id: { $in: cleanup.schedIds } });
  await Bus.deleteMany({ _id: { $in: cleanup.busIds } });
  await BusType.deleteMany({ _id: { $in: cleanup.busTypeIds } });
  await Route.deleteMany({ _id: { $in: cleanup.routeIds } });
  await disconnectDB();
  console.log('cleaned up');
}