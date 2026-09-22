// Phase 5 e2e — Seats & Booking. Run: `node tests/booking.test.mjs`
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
import Location from '../src/models/Location.js';

const uniq = Date.now().toString(36);
const cleanup = { userIds: [], busIds: [], busTypeIds: [], schedIds: [], priceIds: [], routeIds: [] };
let mobSeq = 0;
const mobile = () => `982${String((Date.now() + mobSeq++) % 10000000).padStart(7, '0')}`;
const day = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
};
const auth = (t) => ({ Authorization: `Bearer ${t}` });
const pax = { passenger: { name: 'Book User', phone: '9800000000', age: 30, gender: 'Female' } };

const ensureType = async () => {
  const bt = await BusType.create({ name: `T37_${uniq}`, seatCount: 37, seatStyle: 'luxury' });
  cleanup.busTypeIds.push(String(bt._id));
  return String(bt._id);
};

let adminToken, userToken, userB;
let adminName;
let routeId;
let bus;
let sched;
let price;

let pass = 0;
const ok = (name) => {
  pass += 1;
  console.log(`  ok - ${name}`);
};

async function login(email, pass2) {
  const r = await request(app).post('/api/auth/login').send({ logid: email, logpass: pass2 });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return r.body;
}

async function register(uname, gender) {
  const u = {
    uname,
    upass: 'Test@1234',
    ugender: gender,
    uemail: `${uname}_${uniq}@test.com`,
    umobile: mobile(),
  };
  const r = await request(app).post('/api/auth/register').send(u);
  assert.equal(r.status, 201, JSON.stringify(r.body));
  cleanup.userIds.push(r.body.user._id);
  return r.body.user;
}

try {
  await connectDB();

  const adminLogin = await request(app)
    .post('/api/auth/login')
    .send({
      logid: process.env.DEFAULT_ADMIN_EMAIL || 'superadmin@obts.dev',
      logpass: process.env.DEFAULT_ADMIN_PASS || 'OBTSAdmin@1234',
    });
  assert.equal(adminLogin.status, 200, 'default admin login failed');
  adminToken = adminLogin.body.accessToken;
  adminName = adminLogin.body.user.uname;

  const plain = await register('BookUser', 'Female');
  userB = plain;
  userToken = (await login(plain.uemail, 'Test@1234')).accessToken;

  // Build a real bookable pipeline: route(sp=Butwal, fp=Pokhara) with a
  // checkpoint Bhaktapur @150, bus(37) active, going schedule, ok price 1000.
  const cr = await request(app)
    .post('/api/routes')
    .set(auth(adminToken))
    .send({ sp: 'Butwal', fp: 'Pokhara', distance: 190, duration: '5h' });
  assert.equal(cr.status, 201, JSON.stringify(cr.body));
  routeId = cr.body.route._id;
  cleanup.routeIds.push(routeId);

  const cc = await request(app)
    .post(`/api/routes/${routeId}/checkpoints`)
    .set(auth(adminToken))
    .send({ route: 'Bhaktapur', price: 150 });
  assert.equal(cc.status, 201, JSON.stringify(cc.body));

  const busTypeId = await ensureType();
  const busR = await request(app)
    .post('/api/buses')
    .set(auth(adminToken))
    .send({ plateNumber: `BA 1 KA ${(Date.now() % 90000) + 10000}`, busTypeId, bname: 'Book Bus' });
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

  // ---- search: public + guards ----
  let r = await request(app).get(
    `/api/bookings/search?sp=NoSuchTown&fp=Pokhara&date=${day(8)}`
  );
  assert.equal(r.status, 400);
  ok('bad sp town -> 400');

  r = await request(app).get(`/api/bookings/search?sp=Butwal&fp=Pokehara&date=${day(8)}`);
  assert.equal(r.status, 400);
  assert.equal(r.body.message, 'Error in final point selection');
  ok('bad fp town -> 400');

  r = await request(app).get(`/api/bookings/search?sp=Butwal&fp=Pokhara&date=2020-01-01`);
  assert.equal(r.status, 400);
  assert.equal(r.body.message, 'Travel date cannot be in the past');
  ok('past travel date -> 400');

  r = await request(app).get(`/api/bookings/search?sp=Butwal&fp=Pokhara&date=${day(8)}`);
  assert.equal(r.status, 200);
  assert.ok(r.body.offers.length === 1, JSON.stringify(r.body));
  const offer = r.body.offers[0];
  assert.equal(offer.price, 1000);
  assert.equal(offer.counts.available, 37);
  assert.equal(offer.counts.reserved, 0);
  assert.equal(offer.counts.held, 0);
  assert.equal(offer.seats.length, 37);
  assert.equal(offer.rows.length, 5);
  ok('guest search returns full-route offer E37');

  // segment: Bhaktapur -> Pokhara = 1000 - 150 = 850 (checkpoint -> final)
  r = await request(app).get(
    `/api/bookings/search?sp=Bhaktapur&fp=Pokhara&date=${day(8)}`
  );
  assert.equal(r.body.offers[0].price, 850);
  ok('cp -> final segment price 850');

  // segment: Butwal -> Bhaktapur = 150 (origin -> checkpoint)
  r = await request(app).get(
    `/api/bookings/search?sp=Butwal&fp=Bhaktapur&date=${day(8)}`
  );
  assert.equal(r.body.offers[0].price, 150);
  ok('origin -> cp segment price 150');

  // no-match segment
  r = await request(app).get(`/api/bookings/search?sp=Pokhara&fp=Butwal&date=${day(8)}`);
  assert.equal(r.status, 200);
  assert.equal(r.body.offers.length, 0);
  ok('reverse segment -> empty offers');

  // ---- booking guards ----
  r = await request(app)
    .post('/api/bookings/pending')
    .send({ arid: price._id, sno: 3, sp: 'Butwal', fp: 'Pokhara' });
  assert.equal(r.status, 401);
  ok('guest pending -> 401');

  // ---- passenger validation ----
  r = await request(app)
    .post('/api/bookings/pending')
    .set(auth(userToken))
    .send({ arid: price._id, sno: 30, sp: 'Butwal', fp: 'Pokhara' });
  assert.equal(r.status, 400);
  assert.equal(r.body.message, 'Validation failed');
  ok('booking without passenger -> 400');

  r = await request(app)
    .post('/api/bookings/pending')
    .set(auth(userToken))
    .send({
      arid: price._id,
      sno: 30,
      sp: 'Butwal',
      fp: 'Pokhara',
      passenger: { name: 'X', phone: '9800000000', age: 200, gender: 'Female' },
    });
  assert.equal(r.status, 400);
  ok('booking with invalid passenger age -> 400');

  r = await request(app)
    .post('/api/bookings/pending')
    .set(auth(userToken))
    .send({
      arid: price._id,
      sno: 30,
      sp: 'Butwal',
      fp: 'Pokhara',
      passenger: { name: 'X', age: 30, gender: 'Female' },
    });
  assert.equal(r.status, 400);
  ok('booking without passenger phone -> 400');

  r = await request(app)
    .post('/api/bookings/pending')
    .set(auth(userToken))
    .send({
      arid: price._id,
      sno: 30,
      sp: 'Butwal',
      fp: 'Pokhara',
      passenger: { name: 'X', phone: '12345', age: 30, gender: 'Female' },
    });
  assert.equal(r.status, 400);
  ok('booking with invalid passenger phone -> 400');

  // ---- pending booking + ledger ----
  r = await request(app)
    .post('/api/bookings/pending')
    .set(auth(userToken))
    .send({ arid: price._id, sno: 3, sp: 'Butwal', fp: 'Pokhara', ...pax });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(r.body.message, 'registration complete');
  assert.equal(r.body.seat.status, 'held');
  assert.equal(r.body.seat.price, 1000);
  assert.equal(r.body.ticket.passengerName, 'Book User');
  assert.equal(r.body.ticket.passengerPhone, '9800000000');
  assert.equal(r.body.ticket.passengerAge, 30);
  assert.equal(r.body.ticket.passengerGender, 'Female');
  assert.ok(r.body.bookingRef, 'bookingRef returned');
  assert.equal(String(r.body.ticket.bookingRef), String(r.body.bookingRef));
  const uLedger = await User.findById(userB._id).lean();
  assert.equal(uLedger.totaltc, 1);
  assert.equal(uLedger.pendingtc, 1);
  assert.equal(uLedger.reservedtc, 0);
  assert.equal(uLedger.due, 1000);
  assert.equal(uLedger.points, 1);
  ok('pending 201 + ledger inc (totaltc/pendingtc/due/points)');

  // ---- occupancy reflects after booking ----
  r = await request(app).get(`/api/bookings/search?sp=Butwal&fp=Pokhara&date=${day(8)}`);
  const offer1 = r.body.offers[0];
  assert.equal(offer1.counts.available, 36);
  assert.equal(offer1.counts.held, 1);
  const seat3 = offer1.seats.find((s) => s.sno === 3);
  assert.equal(seat3.status, 'held');
  assert.ok(seat3.lockExpiry && new Date(seat3.lockExpiry).getTime() > Date.now());
  ok('re-search reflects P occupancy E36/P1');

  // ---- duplicate exact segment -> 409 ----
  r = await request(app)
    .post('/api/bookings/pending')
    .set(auth(userToken))
    .send({ arid: price._id, sno: 3, sp: 'Butwal', fp: 'Pokhara', ...pax });
  assert.equal(r.status, 409);
  assert.equal(r.body.message, 'the selected seat is on-hold');
  ok('duplicate exact segment -> 409 on-hold');

  // ---- confirm on a P seat -> 409 ----
  r = await request(app)
    .post('/api/bookings/confirm')
    .set(auth(userToken))
    .send({ arid: price._id, sno: 3, sp: 'Butwal', fp: 'Pokhara', ...pax });
  assert.equal(r.status, 409);
  assert.equal(r.body.message, 'the selected seat is kept on-hold');
  ok('confirm on P seat -> 409 on-hold');

  // ---- overlapping sub-segment on the SAME booked seat -> 409 ----
  r = await request(app)
    .post('/api/bookings/pending')
    .set(auth(userToken))
    .send({ arid: price._id, sno: 3, sp: 'Butwal', fp: 'Bhaktapur', ...pax });
  assert.equal(r.status, 409);
  assert.equal(r.body.message, 'the selected seat is on-hold');
  ok('overlapping sub-segment same sno -> 409 on-hold');

  // ---- confirm fresh seat -> 201 + reservedtc ----
  r = await request(app)
    .post('/api/bookings/confirm')
    .set(auth(userToken))
    .send({ arid: price._id, sno: 19, sp: 'Butwal', fp: 'Pokhara', ...pax });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(r.body.seat.status, 'reserved');
  const uLedger2 = await User.findById(userB._id).lean();
  assert.equal(uLedger2.totaltc, 2);
  assert.equal(uLedger2.reservedtc, 1);
  assert.equal(uLedger2.pendingtc, 1);
  assert.equal(uLedger2.due, 1000 + 1000);
  assert.equal(uLedger2.points, 2);
  ok('confirm fresh seat 201 + reservedtc inc');

  // ---- checkpoint guard: seats exist on the route -> 400 ----
  const extraTown = await Location.find({
    name: { $nin: ['Butwal', 'Pokhara', 'Bhaktapur'] },
  })
    .select('name')
    .limit(1)
    .lean();
  if (extraTown[0]) {
    r = await request(app)
      .post(`/api/routes/${routeId}/checkpoints`)
      .set(auth(adminToken))
      .send({ route: extraTown[0].name, price: 400 });
    assert.equal(r.status, 400, JSON.stringify(r.body));
    assert.match(r.body.message, /Cannot modify checkpoints/i);
    ok('checkpoint add blocked while seats booked (400)');
  }

  // ---- pending on R seat -> 409 reserved ----
  r = await request(app)
    .post('/api/bookings/pending')
    .set(auth(userToken))
    .send({ arid: price._id, sno: 19, sp: 'Butwal', fp: 'Pokhara', ...pax });
  assert.equal(r.status, 409);
  assert.equal(r.body.message, 'the selected seat has been reserved');
  ok('pending on R seat -> 409 reserved');

  // ---- non-overlapping disjoint segments on the SAME seat are allowed (legacy) ----
  r = await request(app)
    .post('/api/bookings/pending')
    .set(auth(userToken))
    .send({ arid: price._id, sno: 20, sp: 'Butwal', fp: 'Bhaktapur', ...pax });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  r = await request(app)
    .post('/api/bookings/pending')
    .set(auth(userToken))
    .send({ arid: price._id, sno: 20, sp: 'Bhaktapur', fp: 'Pokhara', ...pax });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  const uLedger3 = await User.findById(userB._id).lean();
  assert.equal(uLedger3.totaltc, 4);
  assert.equal(uLedger3.pendingtc, 3);
  assert.equal(uLedger3.reservedtc, 1);
  assert.equal(uLedger3.due, 1000 + 1000 + 150 + 850);
  assert.equal(uLedger3.points, 4);
  ok('same seat disjoint segments allowed + ledger');

  // ---- invalid seat number -> 400 ----
  r = await request(app)
    .post('/api/bookings/pending')
    .set(auth(userToken))
    .send({ arid: price._id, sno: 999, sp: 'Butwal', fp: 'Pokhara', ...pax });
  assert.equal(r.status, 400);
  assert.equal(r.body.message, 'Invalid seat number');
  ok('invalid sno -> 400');

  // ---- invalid segment ----
  r = await request(app)
    .post('/api/bookings/pending')
    .set(auth(userToken))
    .send({ arid: price._id, sno: 2, sp: 'Pokhara', fp: 'Butwal', ...pax });
  assert.equal(r.status, 400);
  assert.equal(r.body.message, 'Invalid travel segment');
  ok('reverse segment booking -> 400');

  // ---- stats pending tickets per role ----
  r = await request(app).get('/api/stats').set(auth(userToken));
  assert.equal(r.body.tickets.pending, 3);
  ok('user stats pending = 3');
  r = await request(app).get('/api/stats').set(auth(adminToken));
  assert.equal(r.body.tickets.pending, 3);
  ok('admin stats pending = 3');

  // ---- /api/seats/hold + /api/seats/release (F11/F12) ----
  r = await request(app).post('/api/seats/hold').send({ arid: price._id, sno: 5, sp: 'Butwal', fp: 'Pokhara' });
  assert.equal(r.status, 401);
  ok('guest hold -> 401');

  r = await request(app)
    .post('/api/seats/hold')
    .set(auth(userToken))
    .send({ arid: price._id, sno: 5, sp: 'Butwal', fp: 'Pokhara' });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(r.body.seat.status, 'held');
  assert.ok(r.body.seat.lockExpiry);
  assert.ok(new Date(r.body.seat.lockExpiry).getTime() > Date.now());
  ok('hold 201 + held + lockExpiry in future');

  r = await request(app)
    .post('/api/seats/hold')
    .set(auth(userToken))
    .send({ arid: price._id, sno: 5, sp: 'Butwal', fp: 'Pokhara' });
  assert.equal(r.status, 409);
  assert.equal(r.body.message, 'the selected seat is on-hold');
  ok('duplicate hold overlap -> 409');

  r = await request(app)
    .post('/api/seats/release')
    .set(auth(adminToken))
    .send({ arid: price._id, sno: 5, sp: 'Butwal', fp: 'Pokhara' });
  assert.equal(r.status, 404);
  assert.equal(r.body.message, 'Held seat not found');
  ok('wrong-user release -> 404');

  r = await request(app)
    .post('/api/seats/release')
    .set(auth(userToken))
    .send({ arid: price._id, sno: 5, sp: 'Butwal', fp: 'Pokhara' });
  assert.equal(r.status, 200);
  r = await request(app).get(`/api/bookings/search?sp=Butwal&fp=Pokhara&date=${day(8)}`);
  assert.equal(r.body.offers[0].seats.find((s) => s.sno === 5).status, 'available');
  ok('release own -> 200 + seat available on re-search');

  r = await request(app)
    .post('/api/seats/hold')
    .set(auth(userToken))
    .send({ arid: price._id, sno: 6, sp: 'Butwal', fp: 'Pokhara' });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  await Seat.updateOne({ _id: r.body.seat._id }, { lockExpiry: new Date(Date.now() - 5000) });
  r = await request(app).get(`/api/bookings/search?sp=Butwal&fp=Pokhara&date=${day(8)}`);
  assert.equal(r.body.offers[0].seats.find((s) => s.sno === 6).status, 'available');
  assert.equal(await Seat.countDocuments({ sno: 6, status: 'held' }), 0);
  ok('past-lockExpiry held seat auto-released on re-search');

  // ---- expired pending booking reverses the user ledger ----
  r = await request(app)
    .post('/api/bookings/pending')
    .set(auth(userToken))
    .send({ arid: price._id, sno: 7, sp: 'Butwal', fp: 'Pokhara', ...pax });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  let uL = await User.findById(userB._id).lean();
  assert.equal(uL.totaltc, 5);
  assert.equal(uL.pendingtc, 4);
  assert.equal(uL.due, 4000);
  assert.equal(uL.points, 5);
  await Seat.updateOne({ _id: r.body.seat._id }, { lockExpiry: new Date(Date.now() - 5000) });
  await request(app).get(`/api/bookings/search?sp=Butwal&fp=Pokhara&date=${day(8)}`);
  uL = await User.findById(userB._id).lean();
  assert.equal(uL.totaltc, 4);
  assert.equal(uL.pendingtc, 3);
  assert.equal(uL.due, 3000);
  assert.equal(uL.points, 4);
  ok('expired pending booking reverses ledger (totaltc/pendingtc/due/points)');

  // ---- multi-seat booking: array sno ----
  r = await request(app)
    .post('/api/bookings/pending')
    .set(auth(userToken))
    .send({ arid: price._id, sno: [8, 9], sp: 'Butwal', fp: 'Pokhara', ...pax });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(r.body.tickets.length, 2);
  assert.equal(r.body.seats.length, 2);
  assert.equal(String(r.body.ticket._id), String(r.body.tickets[0]._id));
  assert.equal(r.body.seat.sno, 8);
  assert.equal(r.body.price, 2000);
  assert.ok(r.body.bookingRef, 'multi-seat bookingRef');
  assert.equal(String(r.body.tickets[0].bookingRef), String(r.body.bookingRef));
  assert.equal(String(r.body.tickets[1].bookingRef), String(r.body.bookingRef));
  assert.equal(r.body.tickets[1].passengerName, 'Book User');
  assert.equal(r.body.tickets[1].passengerPhone, '9800000000');
  uL = await User.findById(userB._id).lean();
  assert.equal(uL.totaltc, 6);
  assert.equal(uL.pendingtc, 5);
  assert.equal(uL.reservedtc, 1);
  assert.equal(uL.due, 5000);
  assert.equal(uL.points, 6);
  ok('multi-seat pending 201 -> 2 tickets, total price, ledger x2');

  // duplicate snos in one request collapse to a single seat
  r = await request(app)
    .post('/api/bookings/pending')
    .set(auth(userToken))
    .send({ arid: price._id, sno: [10, 10], sp: 'Butwal', fp: 'Pokhara', ...pax });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(r.body.tickets.length, 1);
  uL = await User.findById(userB._id).lean();
  assert.equal(uL.totaltc, 7);
  assert.equal(uL.pendingtc, 6);
  ok('duplicate sno array collapsed to 1 ticket');

  // any invalid sno in the array -> 400 before any write
  r = await request(app)
    .post('/api/bookings/pending')
    .set(auth(userToken))
    .send({ arid: price._id, sno: [3, 999], sp: 'Butwal', fp: 'Pokhara', ...pax });
  assert.equal(r.status, 400);
  assert.equal(r.body.message, 'Invalid seat number');
  ok('array with invalid sno -> 400');

  // ---- F29/F30 my bookings + detail + F31/F27 cancel ----
  const userC = await register('MyBookUser', 'Male');
  const userCToken = (await login(userC.uemail, 'Test@1234')).accessToken;

  let mc = await request(app)
    .post('/api/bookings/confirm')
    .set(auth(userCToken))
    .send({ arid: price._id, sno: [21, 22], sp: 'Butwal', fp: 'Pokhara', ...pax });
  assert.equal(mc.status, 201, JSON.stringify(mc.body));
  const cRef = String(mc.body.bookingRef);
  const cSeat1 = String(mc.body.seats[0]._id);
  const cSeat2 = String(mc.body.seats[1]._id);
  const cTicket1 = String(mc.body.tickets[0]._id);
  const cTicket2 = String(mc.body.tickets[1]._id);

  r = await request(app).get('/api/bookings/my');
  assert.equal(r.status, 401);
  ok('guest my-bookings -> 401');

  r = await request(app).get('/api/bookings/my').set(auth(userCToken));
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.bookings.length, 1);
  const mine = r.body.bookings[0];
  assert.equal(mine.bookingRef, cRef);
  assert.equal(mine.status, 'reserved');
  assert.equal(mine.payment, 'pending');
  assert.equal(mine.seats.length, 2);
  assert.equal(mine.totalPrice, 2000);
  assert.ok(mine.bus && mine.bus.bname, 'booking enriched with bus');
  assert.equal(mine.route.fp, 'Pokhara');
  ok('my-bookings groups multi-seat booking with bus/route + total');

  r = await request(app).get(`/api/bookings/${cRef}`).set(auth(userCToken));
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.booking.bookingRef, cRef);
  assert.equal(r.body.booking.tickets.length, 2);
  ok('booking detail by ref -> owner sees group');

  r = await request(app).get(`/api/bookings/${cRef}`).set(auth(userToken));
  assert.equal(r.status, 404);
  ok('booking detail by other user -> 404');

  r = await request(app).get('/api/bookings/not-an-id').set(auth(userCToken));
  assert.equal(r.status, 400);
  ok('booking detail bad id -> 400');

  // individual cancel: releases one seat + reverses one ticket of the ledger
  let cBefore = await User.findById(userC._id).lean();
  r = await request(app)
    .patch(`/api/bookings/tickets/${cTicket1}/cancel`)
    .set(auth(userCToken));
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.message, 'Ticket cancelled');
  let cAfter = await User.findById(userC._id).lean();
  assert.equal(cAfter.totaltc, cBefore.totaltc - 1);
  assert.equal(cAfter.reservedtc, cBefore.reservedtc - 1);
  assert.equal(cAfter.due, cBefore.due - 1000);
  assert.equal(cAfter.points, cBefore.points - 1);
  assert.equal(await Seat.countDocuments({ _id: cSeat1 }), 0, 'cancelled seat released');
  assert.equal((await Ticket.findById(cTicket1)).tstatus, 'cancelled');
  ok('individual cancel reverses ledger + releases seat');

  // cancelled tickets: payment record removed, hidden from desk, cannot be marked paid
  assert.equal(await Payment.countDocuments({ ticketId: cTicket1 }), 0, 'cancel drops the Payment doc');
  r = await request(app)
    .post('/api/payments/cash')
    .set(auth(adminToken))
    .send({ ticketId: cTicket1 });
  assert.equal(r.status, 400, JSON.stringify(r.body));
  assert.equal(r.body.message, 'Ticket already cancelled');
  assert.equal((await Ticket.findById(cTicket1)).paymentStatus, 'pending', 'paymentStatus untouched');
  r = await request(app).get('/api/bookings/passengers').set(auth(adminToken));
  assert.equal(
    r.body.schedules.flatMap((s) => s.tickets).find((t) => String(t._id) === String(cTicket1)),
    undefined,
    'cancelled ticket excluded from payment desk'
  );
  ok('cancelled ticket: payment dropped + hidden from desk + pay rejected');

  r = await request(app).get(`/api/bookings/search?sp=Butwal&fp=Pokhara&date=${day(8)}`);
  assert.equal(r.body.offers[0].seats.find((s) => s.sno === 21).status, 'available');
  ok('cancelled seat shows available on re-search');

  r = await request(app)
    .patch(`/api/bookings/tickets/${cTicket1}/cancel`)
    .set(auth(userCToken));
  assert.equal(r.status, 200);
  assert.equal(r.body.message, 'No change');
  ok('double individual cancel -> No change');

  r = await request(app)
    .patch(`/api/bookings/tickets/${cTicket2}/cancel`)
    .set(auth(userToken));
  assert.equal(r.status, 403);
  ok('cancel another user ticket -> 403');

  // group cancel: cancels the remaining seat
  cBefore = await User.findById(userC._id).lean();
  r = await request(app).patch(`/api/bookings/${cRef}/cancel`).set(auth(userCToken));
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.message, 'Booking cancelled');
  cAfter = await User.findById(userC._id).lean();
  assert.equal(cAfter.totaltc, cBefore.totaltc - 1);
  assert.equal(cAfter.reservedtc, cBefore.reservedtc - 1);
  assert.equal(cAfter.due, cBefore.due - 1000);
  assert.equal(cAfter.points, cBefore.points - 1);
  assert.equal(await Seat.countDocuments({ _id: cSeat2 }), 0, 'group cancel releases seat');
  ok('group cancel reverses remaining ledger + releases seat');

  r = await request(app).get('/api/bookings/my').set(auth(userCToken));
  assert.equal(r.body.bookings[0].status, 'cancelled');
  ok('cancelled booking surfaces in my-bookings');

  r = await request(app).patch(`/api/bookings/${cRef}/cancel`).set(auth(userToken));
  assert.equal(r.status, 404);
  ok('cancel another user booking -> 404');

  // ---- F32 staff passengers list ----
  r = await request(app).get('/api/bookings/passengers');
  assert.equal(r.status, 401);
  ok('guest passengers -> 401');

  r = await request(app).get('/api/bookings/passengers').set(auth(userToken));
  assert.equal(r.status, 403);
  ok('customer passengers -> 403');

  r = await request(app).get('/api/bookings/passengers').set(auth(adminToken));
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const bookSched = r.body.schedules.find((s) => s.bus?.bname === 'Book Bus');
  assert.ok(bookSched, 'admin passengers lists the Book Bus schedule');
  const paxRow = bookSched.tickets.find((t) => t.passengerName);
  assert.ok(paxRow, 'passenger row carries name');
  assert.equal(paxRow.passengerPhone, '9800000000');
  assert.equal(paxRow.bus.bname, 'Book Bus');
  ok('admin passengers lists schedules with passenger rows');

  const opUser = await register('OpUser', 'Male');
  await User.updateOne({ _id: opUser._id }, { ustatus: 'operator' });
  const opToken = (await login(opUser.uemail, 'Test@1234')).accessToken;
  r = await request(app).get('/api/bookings/passengers').set(auth(opToken));
  assert.equal(r.status, 200);
  assert.equal(r.body.schedules.length, 0);
  ok('operator with no buses -> scoped empty passengers');

  // ---- reserve a held booking -> reserved (ticket + seat + ledger) ----
  const holdUser = await register('HoldReserve', 'Male');
  const holdToken = (await login(holdUser.uemail, 'Test@1234')).accessToken;
  r = await request(app)
    .post('/api/bookings/pending')
    .set(auth(holdToken))
    .send({ arid: price._id, sno: 35, sp: 'Butwal', fp: 'Pokhara', ...pax });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  const holdRef = String(r.body.bookingRef);
  const holdTicketId = String(r.body.ticket._id);
  const holdSeatId = String(r.body.seat._id);
  r = await request(app).post(`/api/bookings/${holdRef}/reserve`).set(auth(holdToken));
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.count, 1);
  assert.equal(r.body.bookingRef, holdRef);
  const hT = await Ticket.findById(holdTicketId).lean();
  assert.equal(hT.tstatus, 'reserved');
  const hS = await Seat.findById(holdSeatId).lean();
  assert.equal(hS.status, 'reserved');
  assert.equal(hS.lockExpiry, null);
  const hL = await User.findById(holdUser._id).lean();
  assert.equal(hL.totaltc, 1);
  assert.equal(hL.pendingtc, 0);
  assert.equal(hL.reservedtc, 1);
  assert.equal(hL.due, 1000);
  r = await request(app).post(`/api/bookings/${holdRef}/reserve`).set(auth(holdToken));
  assert.equal(r.status, 400);
  assert.equal(r.body.message, 'No held tickets to reserve');
  ok('reserve held booking -> reserved (ticket/seat/ledger) + double reserve 400');

  // ---- schedule delete = soft delete: seats + tickets retained ----
  r = await request(app).delete(`/api/schedules/${sched._id}`).set(auth(adminToken));
  assert.equal(r.status, 200);
  assert.ok((await BusSchedule.findById(sched._id)).deletedAt, 'schedule soft-deleted');
  assert.ok(await ScheduleRoute.findById(price._id), 'price retained');
  assert.ok((await Seat.countDocuments({ arid: price._id })) >= 1, 'seats retained');
  assert.ok((await Ticket.countDocuments({ arid: price._id })) >= 1, 'tickets retained');
  ok('delete schedule soft-deletes it, seats + tickets retained');

  console.log(`\nPASS: ${pass} assertions`);
} finally {
  await User.deleteMany({ _id: { $in: cleanup.userIds } });
  if (price) {
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
