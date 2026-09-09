// Phase 5 e2e — Seats & Booking. Run: `node tests/booking.test.mjs`
process.env.NODE_ENV = 'test';

import request from 'supertest';
import assert from 'node:assert/strict';
import { app } from '../src/index.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import User from '../src/models/User.js';
import Route from '../src/models/Route.js';
import Bus from '../src/models/Bus.js';
import BusSchedule from '../src/models/BusSchedule.js';
import Addroute from '../src/models/Addroute.js';
import Sales from '../src/models/Sales.js';
import Seat from '../src/models/Seat.js';
import Ticket from '../src/models/Ticket.js';

const uniq = Date.now().toString(36);
const cleanup = { userIds: [], busIds: [], schedIds: [], priceIds: [], routeIds: [] };
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
    .send({ sp: 'Butwal', fp: 'Pokhara' });
  assert.equal(cr.status, 201, JSON.stringify(cr.body));
  routeId = cr.body.route._id;
  cleanup.routeIds.push(routeId);

  const cc = await request(app)
    .post(`/api/routes/${routeId}/checkpoints`)
    .set(auth(adminToken))
    .send({ route: 'Bhaktapur', price: 150 });
  assert.equal(cc.status, 201, JSON.stringify(cc.body));

  const busR = await request(app)
    .post('/api/buses')
    .set(auth(adminToken))
    .send({ bcd0: 'BA', bcd1: '1', bcd2: 'KA', bno: '1234', bname: 'Book Bus', btype: 'A/C', nseat: 37, stype: 'foldable' });
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
    .send({ bsstatus: 'going' });

  const pr = await request(app)
    .post('/api/prices')
    .set(auth(adminToken))
    .send({ bsid: sched._id, rid: routeId, price: 1000 });
  assert.equal(pr.status, 201, JSON.stringify(pr.body));
  price = pr.body.addroute;
  cleanup.priceIds.push(price._id);
  await request(app)
    .patch(`/api/prices/${price._id}/status`)
    .set(auth(adminToken))
    .send({ arstatus: 'ok' });

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
  assert.equal(offer.counts.E, 37);
  assert.equal(offer.counts.R, 0);
  assert.equal(offer.counts.P, 0);
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

  // ---- pending booking + ledger ----
  r = await request(app)
    .post('/api/bookings/pending')
    .set(auth(userToken))
    .send({ arid: price._id, sno: 3, sp: 'Butwal', fp: 'Pokhara' });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(r.body.message, 'registration complete');
  assert.equal(r.body.seat.status, 'P');
  assert.equal(r.body.seat.price, 1000);
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
  assert.equal(offer1.counts.E, 36);
  assert.equal(offer1.counts.P, 1);
  const seat3 = offer1.seats.find((s) => s.sno === 3);
  assert.equal(seat3.status, 'P');
  ok('re-search reflects P occupancy E36/P1');

  // ---- duplicate exact segment -> 409 ----
  r = await request(app)
    .post('/api/bookings/pending')
    .set(auth(userToken))
    .send({ arid: price._id, sno: 3, sp: 'Butwal', fp: 'Pokhara' });
  assert.equal(r.status, 409);
  assert.equal(r.body.message, 'the selected seat is on-hold');
  ok('duplicate exact segment -> 409 on-hold');

  // ---- confirm on a P seat -> 409 ----
  r = await request(app)
    .post('/api/bookings/confirm')
    .set(auth(userToken))
    .send({ arid: price._id, sno: 3, sp: 'Butwal', fp: 'Pokhara' });
  assert.equal(r.status, 409);
  assert.equal(r.body.message, 'the selected seat is kept on-hold');
  ok('confirm on P seat -> 409 on-hold');

  // ---- overlapping sub-segment on the SAME booked seat -> 409 ----
  r = await request(app)
    .post('/api/bookings/pending')
    .set(auth(userToken))
    .send({ arid: price._id, sno: 3, sp: 'Butwal', fp: 'Bhaktapur' });
  assert.equal(r.status, 409);
  assert.equal(r.body.message, 'the selected seat is on-hold');
  ok('overlapping sub-segment same sno -> 409 on-hold');

  // ---- confirm fresh seat -> 201 + reservedtc ----
  r = await request(app)
    .post('/api/bookings/confirm')
    .set(auth(userToken))
    .send({ arid: price._id, sno: 19, sp: 'Butwal', fp: 'Pokhara' });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(r.body.seat.status, 'R');
  const uLedger2 = await User.findById(userB._id).lean();
  assert.equal(uLedger2.totaltc, 2);
  assert.equal(uLedger2.reservedtc, 1);
  assert.equal(uLedger2.pendingtc, 1);
  assert.equal(uLedger2.due, 1000 + 1000);
  assert.equal(uLedger2.points, 2);
  ok('confirm fresh seat 201 + reservedtc inc');

  // ---- pending on R seat -> 409 reserved ----
  r = await request(app)
    .post('/api/bookings/pending')
    .set(auth(userToken))
    .send({ arid: price._id, sno: 19, sp: 'Butwal', fp: 'Pokhara' });
  assert.equal(r.status, 409);
  assert.equal(r.body.message, 'the selected seat has been reserved');
  ok('pending on R seat -> 409 reserved');

  // ---- non-overlapping disjoint segments on the SAME seat are allowed (legacy) ----
  r = await request(app)
    .post('/api/bookings/pending')
    .set(auth(userToken))
    .send({ arid: price._id, sno: 20, sp: 'Butwal', fp: 'Bhaktapur' });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  r = await request(app)
    .post('/api/bookings/pending')
    .set(auth(userToken))
    .send({ arid: price._id, sno: 20, sp: 'Bhaktapur', fp: 'Pokhara' });
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
    .send({ arid: price._id, sno: 999, sp: 'Butwal', fp: 'Pokhara' });
  assert.equal(r.status, 400);
  assert.equal(r.body.message, 'Invalid seat number');
  ok('invalid sno -> 400');

  // ---- invalid segment ----
  r = await request(app)
    .post('/api/bookings/pending')
    .set(auth(userToken))
    .send({ arid: price._id, sno: 2, sp: 'Pokhara', fp: 'Butwal' });
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

  // ---- schedule delete cascades seats + tickets ----
  r = await request(app).delete(`/api/schedules/${sched._id}`).set(auth(adminToken));
  assert.equal(r.status, 200);
  assert.equal(await BusSchedule.findById(sched._id), null);
  assert.equal(await Addroute.findById(price._id), null);
  assert.equal(await Seat.countDocuments({ arid: price._id }), 0);
  assert.equal(await Ticket.countDocuments({ arid: price._id }), 0);
  ok('delete schedule cascades seats + tickets');

  console.log(`\nPASS: ${pass} assertions`);
} finally {
  await User.deleteMany({ _id: { $in: cleanup.userIds } });
  await Ticket.deleteMany({});
  await Seat.deleteMany({});
  await Sales.deleteMany({ bsid: { $in: cleanup.schedIds } });
  await Addroute.deleteMany({ _id: { $in: cleanup.priceIds } });
  await BusSchedule.deleteMany({ _id: { $in: cleanup.schedIds } });
  await Bus.deleteMany({ _id: { $in: cleanup.busIds } });
  await Route.deleteMany({ _id: { $in: cleanup.routeIds } });
  await disconnectDB();
  console.log('cleaned up');
}
