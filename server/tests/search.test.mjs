// Module 6 e2e — Bus Search System (K1–K5). Run: `node tests/search.test.mjs`
process.env.NODE_ENV = 'test';

import request from 'supertest';
import assert from 'node:assert/strict';
import { app } from '../src/index.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import Bus from '../src/models/Bus.js';
import BusType from '../src/models/BusType.js';
import BusSchedule from '../src/models/BusSchedule.js';
import ScheduleRoute from '../src/models/ScheduleRoute.js';
import Sales from '../src/models/Sales.js';
import Route from '../src/models/Route.js';
import Location from '../src/models/Location.js';

const uniq = Date.now().toString(36);
const cleanup = { busIds: [], busTypeIds: [], schedIds: [], priceIds: [], routeIds: [] };
let plateNo = 10000;
const plate = () => `BA 1 KA ${(Date.now() % 90000) + plateNo++}`;
const day = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
};
const auth = (t) => ({ Authorization: `Bearer ${t}` });
const search = (qs) => request(app).get(`/api/bookings/search?${qs}`);

let pass = 0;
const ok = (name) => {
  pass += 1;
  console.log(`  ok - ${name}`);
};

let adminToken;
let routeId;
let typeA, typeB;

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

  // ---- K5 wiring: durationMinutes parsed on create, explicit, or null ----
  let cr = await request(app)
    .post('/api/routes')
    .set(auth(adminToken))
    .send({ sp: 'Butwal', fp: 'Pokhara', distance: 190, duration: '5h' });
  assert.equal(cr.status, 201, JSON.stringify(cr.body));
  routeId = cr.body.route._id;
  cleanup.routeIds.push(routeId);
  assert.equal(cr.body.route.durationMinutes, 300, 'duration "5h" parses to 300');

  const ck = await request(app)
    .post(`/api/routes/${routeId}/checkpoints`)
    .set(auth(adminToken))
    .send({ route: 'Bhaktapur', price: 150 });
  assert.equal(ck.status, 201, JSON.stringify(ck.body));
  ok('route create derives durationMinutes from "5h"');

  const extra = await Location.find({
    name: { $nin: ['Butwal', 'Pokhara', 'Bhaktapur'] },
  })
    .select('name')
    .limit(4)
    .lean();
  const [t1, t2, t3, t4] = extra.map((t) => t.name);
  assert.ok(t1 && t2 && t3 && t4, 'needs 4 spare location towns');

  cr = await request(app)
    .post('/api/routes')
    .set(auth(adminToken))
    .send({ sp: t1, fp: t2, distance: 120, duration: 'TBD', durationMinutes: 480 });
  assert.equal(cr.status, 201, JSON.stringify(cr.body));
  assert.equal(cr.body.route.durationMinutes, 480, 'explicit durationMinutes kept');
  cleanup.routeIds.push(cr.body.route._id);

  cr = await request(app)
    .post('/api/routes')
    .set(auth(adminToken))
    .send({ sp: t3, fp: t4, distance: 90, duration: 'TBD' });
  assert.equal(cr.status, 201, JSON.stringify(cr.body));
  assert.equal(cr.body.route.durationMinutes, null, 'unparseable duration -> null');
  cleanup.routeIds.push(cr.body.route._id);
  ok('route create: explicit + null durationMinutes paths');

  // ---- two bus types ----
  typeA = String(
    (await BusType.create({ name: `T37B_${uniq}`, seatCount: 37, seatStyle: 'luxury' }))._id
  );
  typeB = String(
    (await BusType.create({ name: `T29B_${uniq}`, seatCount: 29, seatStyle: 'standard' }))._id
  );
  cleanup.busTypeIds.push(typeA, typeB);

  const mkBus = async (busTypeId, bname, amenities, rating) => {
    const r = await request(app)
      .post('/api/buses')
      .set(auth(adminToken))
      .send({ plateNumber: plate(), busTypeId, bname, amenities, rating });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    const bus = r.body.bus;
    cleanup.busIds.push(bus._id);
    await request(app)
      .patch(`/api/buses/${bus._id}/status`)
      .set(auth(adminToken))
      .send({ bstatus: 'active' });
    return bus;
  };

  const mkSchedPrice = async (bid, trtime, fare) => {
    const sc = await request(app)
      .post('/api/schedules')
      .set(auth(adminToken))
      .send({ bid, trdate: day(8), trtime });
    assert.equal(sc.status, 201, JSON.stringify(sc.body));
    const sched = sc.body.schedule;
    cleanup.schedIds.push(sched._id);
    await request(app)
      .patch(`/api/schedules/${sched._id}/status`)
      .set(auth(adminToken))
      .send({ bsstatus: 'approved' });
    const pr = await request(app)
      .post('/api/prices')
      .set(auth(adminToken))
      .send({ bsid: sched._id, rid: routeId, price: fare });
    assert.equal(pr.status, 201, JSON.stringify(pr.body));
    const price = pr.body.scheduleRoute;
    cleanup.priceIds.push(price._id);
    await request(app)
      .patch(`/api/prices/${price._id}/status`)
      .set(auth(adminToken))
      .send({ arstatus: 'approved' });
    return { sched, price };
  };

  // Bus A: dep 07:30, price 1200, rating 4, 37-seater, [wifi, ac]
  // Bus B: dep 23:30, price 800, rating 2, 29-seater, [ac, charging]
  const b1 = await mkBus(typeA, 'Search Bus A', ['wifi', 'ac'], 4);
  const b2 = await mkBus(typeB, 'Search Bus B', ['ac', 'charging'], 2);
  await mkSchedPrice(b1._id, '07:30', 1200);
  await mkSchedPrice(b2._id, '23:30', 800);

  const base = `sp=Butwal&fp=Pokhara&date=${day(8)}`;

  // ---- baseline: 2 offers, K2 counts + K5 arrival/rating/stops payload ----
  let r = await search(base);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.offers.length, 2, JSON.stringify(r.body));
  for (const o of r.body.offers) {
    assert.deepEqual(Object.keys(o.counts).sort(), ['available', 'held', 'reserved']);
    assert.ok(o.counts.available + o.counts.held + o.counts.reserved > 0);
    assert.deepEqual(o.route.stops, ['Bhaktapur']);
    assert.equal(o.route.durationMinutes, 300);
  }
  const offerA = r.body.offers.find((o) => o.trtime === '07:30');
  const offerB = r.body.offers.find((o) => o.trtime === '23:30');
  assert.equal(offerA.arrival, '12:30', '07:30 + 5h = 12:30');
  assert.equal(offerB.arrival, '04:30', '23:30 + 5h wraps to 04:30');
  assert.equal(offerA.counts.available, 37);
  assert.equal(offerB.counts.available, 29);
  assert.equal(offerA.bus.rating, 4);
  assert.equal(offerB.bus.rating, 2);
  ok('baseline 2 offers with counts/arrival/stops/rating payload (K2/K5)');

  // ---- K1 intermediate-stop filter ----
  r = await search(`${base}&stops=Bhaktapur`);
  assert.equal(r.body.offers.length, 2, JSON.stringify(r.body));
  r = await search(`${base}&stops=${t1}`);
  assert.equal(r.body.offers.length, 0, 'route lacks that stop -> empty');
  ok('stops filter: matching checkpoint keeps offers, unmatched town empty');

  // ---- K3 busType filter ----
  r = await search(`${base}&busType=${typeB}`);
  assert.equal(r.body.offers.length, 1);
  assert.equal(r.body.offers[0].bus.bname, 'Search Bus B');
  r = await search(`${base}&busType=${typeA}&busType=${typeB}`);
  assert.equal(r.body.offers.length, 2, JSON.stringify(r.body));
  r = await search(`${base}&busType=zzz`);
  assert.equal(r.status, 400);
  ok('busType filter (single / multiple / bad id 400)');

  // ---- K3 amenities filter (all-required semantics) ----
  r = await search(`${base}&amenities=wifi`);
  assert.equal(r.body.offers.length, 1);
  assert.equal(r.body.offers[0].bus.bname, 'Search Bus A');
  r = await search(`${base}&amenities=ac&amenities=charging`);
  assert.equal(r.body.offers.length, 1);
  assert.equal(r.body.offers[0].bus.bname, 'Search Bus B');
  r = await search(`${base}&amenities=wifi&amenities=charging`);
  assert.equal(r.body.offers.length, 0);
  ok('amenities filter all-required');

  // ---- K3 price range ----
  r = await search(`${base}&minPrice=1100`);
  assert.equal(r.body.offers.length, 1);
  assert.equal(r.body.offers[0].bus.bname, 'Search Bus A');
  r = await search(`${base}&maxPrice=1100`);
  assert.equal(r.body.offers.length, 1);
  assert.equal(r.body.offers[0].bus.bname, 'Search Bus B');
  r = await search(`${base}&minPrice=800&maxPrice=800`);
  assert.equal(r.body.offers.length, 1);
  assert.equal(r.body.offers[0].bus.bname, 'Search Bus B');
  r = await search(`${base}&minPrice=2000&maxPrice=1000`);
  assert.equal(r.status, 400);
  ok('price range filter (min/max/both + min>max 400)');

  // ---- K3 departure-time window ----
  r = await search(`${base}&fromTime=08:00`);
  assert.equal(r.body.offers.length, 1);
  assert.equal(r.body.offers[0].trtime, '23:30');
  r = await search(`${base}&toTime=12:00`);
  assert.equal(r.body.offers.length, 1);
  assert.equal(r.body.offers[0].trtime, '07:30');
  r = await search(`${base}&fromTime=08:00&toTime=16:00`);
  assert.equal(r.body.offers.length, 0);
  r = await search(`${base}&fromTime=20:00&toTime=08:00`);
  assert.equal(r.status, 400);
  ok('departure-time window filter (inclusive + cross 400)');

  // ---- K3 sorts: each key yields a distinct order ----
  const names = (res) => res.body.offers.map((o) => o.bus.bname);

  r = await search(`${base}&order=price`);
  assert.deepEqual(names(r), ['Search Bus B', 'Search Bus A'], 'price asc');
  r = await search(`${base}&order=time`);
  assert.deepEqual(names(r), ['Search Bus A', 'Search Bus B'], 'departure time asc');
  r = await search(`${base}&order=arrival`);
  assert.deepEqual(names(r), ['Search Bus B', 'Search Bus A'], 'arrival 04:30 < 12:30');
  r = await search(`${base}&order=rating`);
  assert.deepEqual(names(r), ['Search Bus A', 'Search Bus B'], 'rating desc');
  r = await search(`${base}&order=foo`);
  assert.equal(r.status, 400);
  ok('sorts: price / time / arrival / rating + bad order 400');

  console.log(`\nPASS: ${pass} assertions`);
} finally {
  await Sales.deleteMany({ bsid: { $in: cleanup.schedIds } });
  await ScheduleRoute.deleteMany({ _id: { $in: cleanup.priceIds } });
  await BusSchedule.deleteMany({ _id: { $in: cleanup.schedIds } });
  await Bus.deleteMany({ _id: { $in: cleanup.busIds } });
  await BusType.deleteMany({ _id: { $in: cleanup.busTypeIds } });
  await Route.deleteMany({ _id: { $in: cleanup.routeIds } });
  await disconnectDB();
  console.log('cleaned up');
}