// Phase 4 e2e — Schedules & Prices. Run: `node tests/schedule-price.test.mjs`
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

const uniq = Date.now().toString(36);
const plateBase = (Date.now() % 90000) + 10000;
const cleanup = { userIds: [], busIds: [], busTypeIds: [], schedIds: [], priceIds: [], routeIds: [] };
let mobSeq = 0;
const mobile = () => `981${String((Date.now() + mobSeq++) % 10000000).padStart(7, '0')}`;
const day = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
};
const auth = (t) => ({ Authorization: `Bearer ${t}` });

const ensureType = async () => {
  const bt = await BusType.create({ name: `T37_${uniq}`, seatCount: 37, seatStyle: 'luxury' });
  cleanup.busTypeIds.push(String(bt._id));
  return String(bt._id);
};

let adminToken, userToken, mgrToken;
let adminName, routeId, route2Id;
let busA, busMgr, busCascade;
let schedA, schedMgr, schedCascade;
let priceA, priceMgr, priceCascade;

async function login(email, pass) {
  const r = await request(app).post('/api/auth/login').send({ logid: email, logpass: pass });
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

let pass = 0;
const ok = (name) => {
  pass += 1;
  console.log(`  ok - ${name}`);
};

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

  const plain = await register('SchedUser', 'Female');
  userToken = (await login(plain.uemail, 'Test@1234')).accessToken;

  const mgr = await register('SchedMgr', 'Male');
  const roleUp = await request(app)
    .patch(`/api/users/${mgr._id}/role`)
    .set(auth(adminToken))
    .send({ ustatus: 'operator' });
  assert.equal(roleUp.status, 200, JSON.stringify(roleUp.body));
  mgrToken = (await login(mgr.uemail, 'Test@1234')).accessToken;

  // Ensure a route exists.
  const list = await request(app).get('/api/routes').set(auth(adminToken));
  const found = list.body.routes?.find((r) => r.sp === 'Butwal' && r.fp === 'Pokhara');
  if (found) {
    routeId = found._id;
  } else {
    const cr = await request(app)
      .post('/api/routes')
      .set(auth(adminToken))
      .send({ sp: 'Butwal', fp: 'Pokhara', distance: 190, duration: '5h' });
    assert.equal(cr.status, 201, JSON.stringify(cr.body));
    routeId = cr.body.route._id;
    cleanup.routeIds.push(routeId);
  }

  const busTypeId = await ensureType();

  const mkBus = async (token, bno, name) => {
    const r = await request(app)
      .post('/api/buses')
      .set(auth(token))
      .send({ plateNumber: `BA 1 KA ${bno}`, busTypeId, bname: name });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    cleanup.busIds.push(r.body.bus._id);
    return r.body.bus;
  };

  // ---- auth guards ----
  let r = await request(app).get('/api/schedules');
  assert.equal(r.status, 401);
  ok('unauth schedules -> 401');
  r = await request(app).get('/api/schedules').set(auth(userToken));
  assert.equal(r.status, 200);
  ok('user schedules list 200');
  r = await request(app).get('/api/stats').set(auth(userToken));
  assert.equal(r.status, 200);
  ok('user stats 200');

  busA = await mkBus(adminToken, String(plateBase), 'sched bus A');
  busMgr = await mkBus(mgrToken, String(plateBase + 1), 'sched bus mgr');
  busCascade = await mkBus(adminToken, String(plateBase + 2), 'cascade bus');

  r = await request(app)
    .post('/api/schedules')
    .set(auth(userToken))
    .send({ bid: busA._id, trdate: day(5), trtime: '07:30' });
  assert.equal(r.status, 403);
  ok('user create schedule -> 403');

  r = await request(app)
    .post('/api/schedules')
    .set(auth(adminToken))
    .send({ bid: busA._id, trdate: day(3), trtime: '07:30' });
  assert.equal(r.status, 400);
  ok('<4 days -> 400');

  r = await request(app)
    .post('/api/schedules')
    .set(auth(adminToken))
    .send({ bid: busA._id, trdate: '3019-99-99', trtime: '07:30' });
  assert.equal(r.status, 400);
  ok('invalid date -> 400');

  r = await request(app)
    .post('/api/schedules')
    .set(auth(adminToken))
    .send({ bid: 'a'.repeat(24), trdate: day(5), trtime: '07:30' });
  assert.equal(r.status, 404);
  ok('unknown bus -> 404');

  r = await request(app)
    .post('/api/schedules')
    .set(auth(adminToken))
    .send({ bid: busA._id, trdate: day(5), trtime: '07:30' });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  schedA = r.body.schedule;
  cleanup.schedIds.push(schedA._id);
  assert.equal(schedA.bsstatus, 'pending');
  assert.equal(schedA.bssapby, 'none');
  ok('create +5d -> 201 pending/none');

  r = await request(app)
    .post('/api/schedules')
    .set(auth(mgrToken))
    .send({ bid: busA._id, trdate: day(9), trtime: '08:00' });
  assert.equal(r.status, 403);
  ok('manager schedule on other bus -> 403');

  r = await request(app)
    .post('/api/schedules')
    .set(auth(adminToken))
    .send({ bid: busA._id, trdate: day(5), trtime: '18:00' });
  assert.equal(r.status, 409);
  ok('same bus same date -> 409');

  r = await request(app)
    .post('/api/schedules')
    .set(auth(adminToken))
    .send({ bid: busA._id, trdate: day(6), trtime: '18:00' });
  assert.equal(r.status, 400);
  ok('within 2 days -> 400');

  r = await request(app)
    .post('/api/schedules')
    .set(auth(mgrToken))
    .send({ bid: busMgr._id, trdate: day(10), trtime: '09:00' });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  schedMgr = r.body.schedule;
  cleanup.schedIds.push(schedMgr._id);
  ok('manager own bus -> 201');

  r = await request(app)
    .post('/api/schedules')
    .set(auth(adminToken))
    .send({ bid: busCascade._id, trdate: day(12), trtime: '10:00' });
  assert.equal(r.status, 201);
  schedCascade = r.body.schedule;
  cleanup.schedIds.push(schedCascade._id);
  ok('cascade bus schedule -> 201');

  // ---- schedule status (Admin only) ----
  r = await request(app)
    .patch(`/api/schedules/${schedA._id}/status`)
    .set(auth(mgrToken))
    .send({ bsstatus: 'approved' });
  assert.equal(r.status, 403);
  ok('manager schedule status -> 403');
  r = await request(app)
    .patch(`/api/schedules/${schedA._id}/status`)
    .set(auth(userToken))
    .send({ bsstatus: 'approved' });
  assert.equal(r.status, 403);
  ok('user schedule status -> 403');

  r = await request(app)
    .patch(`/api/schedules/${schedA._id}/status`)
    .set(auth(adminToken))
    .send({ bsstatus: 'approved' });
  assert.equal(r.status, 200);
  assert.equal(r.body.schedule.bssapby, adminName);
  let sales = await Sales.find({ bsid: schedA._id }).lean();
  assert.equal(sales.length, 1);
  assert.equal(sales[0].sales, 0);
  assert.equal(String(sales[0].bid), String(busA._id));
  ok('admin approved -> sales row created');

  r = await request(app)
    .patch(`/api/schedules/${schedA._id}/status`)
    .set(auth(adminToken))
    .send({ bsstatus: 'approved' });
  assert.equal(r.body.message, 'No change');
  sales = await Sales.find({ bsid: schedA._id }).lean();
  assert.equal(sales.length, 1);
  ok('status no-op + sales idempotent');

  // ---- prices ----
  r = await request(app)
    .post('/api/prices')
    .set(auth(userToken))
    .send({ bsid: schedA._id, rid: routeId, price: 1000 });
  assert.equal(r.status, 403);
  ok('user assign price -> 403');
  r = await request(app)
    .post('/api/prices')
    .set(auth(mgrToken))
    .send({ bsid: schedA._id, rid: routeId, price: 1000 });
  assert.equal(r.status, 403);
  ok('manager assign others schedule -> 403');

  r = await request(app)
    .post('/api/prices')
    .set(auth(adminToken))
    .send({ bsid: schedA._id, rid: routeId, price: 1000 });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  priceA = r.body.scheduleRoute;
  cleanup.priceIds.push(priceA._id);
  assert.equal(priceA.arstatus, 'approved');
  ok('assign after schedule approved -> 201 approved');

  r = await request(app)
    .post('/api/prices')
    .set(auth(adminToken))
    .send({ bsid: schedA._id, rid: routeId, price: 1000 });
  assert.equal(r.status, 409);
  ok('second assign same bsid -> 409');

  r = await request(app)
    .patch(`/api/prices/${priceA._id}/status`)
    .set(auth(mgrToken))
    .send({ arstatus: 'approved' });
  assert.equal(r.status, 403);
  ok('manager price status -> 403');
  r = await request(app)
    .patch(`/api/prices/${priceA._id}/status`)
    .set(auth(adminToken))
    .send({ arstatus: 'approved' });
  assert.equal(r.status, 200);
  assert.equal(r.body.scheduleRoute.arstatus, 'approved');
  ok('admin price status -> 200 approved');

  // user list: only approved prices; staff list: all
  r = await request(app).get('/api/prices').set(auth(userToken));
  const userPrices = r.body.prices.filter((p) => String(p._id) === priceA._id);
  assert.equal(userPrices.length, 1);
  assert.ok(userPrices[0].schedule && userPrices[0].bus, 'price enriched with schedule+bus');
  ok('user sees approved price, enriched');

  r = await request(app).get('/api/prices').set(auth(adminToken));
  assert.ok(r.body.prices.some((p) => String(p._id) === priceA._id));
  ok('staff sees all prices');

  // route/price edits re-pend + no-op
  const route2 = await request(app)
    .post('/api/routes')
    .set(auth(adminToken))
    .send({ sp: 'Butwal', fp: 'Hetauda', distance: 160, duration: '4h' });
  assert.equal(route2.status, 201, JSON.stringify(route2.body));
  route2Id = route2.body.route._id;
  cleanup.routeIds.push(route2Id);

  r = await request(app)
    .patch(`/api/prices/${priceA._id}/route`)
    .set(auth(adminToken))
    .send({ rid: route2Id });
  assert.equal(r.status, 200);
  assert.equal(r.body.scheduleRoute.arstatus, 'pending');
  ok('route edit re-pends');
  r = await request(app)
    .patch(`/api/prices/${priceA._id}/route`)
    .set(auth(adminToken))
    .send({ rid: route2Id });
  assert.equal(r.body.message, 'No change');
  ok('route no-op');

  r = await request(app)
    .patch(`/api/prices/${priceA._id}/price`)
    .set(auth(adminToken))
    .send({ price: 1500 });
  assert.equal(r.status, 200);
  assert.equal(r.body.scheduleRoute.price, 1500);
  assert.equal(r.body.scheduleRoute.arstatus, 'pending');
  ok('price edit re-pends');
  r = await request(app)
    .patch(`/api/prices/${priceA._id}/price`)
    .set(auth(adminToken))
    .send({ price: 1500 });
  assert.equal(r.body.message, 'No change');
  ok('price no-op');
  r = await request(app)
    .patch(`/api/prices/${priceA._id}/price`)
    .set(auth(adminToken))
    .send({ price: 1000 });
  assert.equal(r.status, 200);
  ok('price back to 1000');

  // schedule non-approved re-pends the price
  r = await request(app)
    .patch(`/api/schedules/${schedA._id}/status`)
    .set(auth(adminToken))
    .send({ bsstatus: 'not_going' });
  assert.equal(r.status, 200);
  let ar = await ScheduleRoute.findById(priceA._id).lean();
  assert.equal(ar.arstatus, 'pending');
  ok('schedule non-approved re-pends price');
  r = await request(app)
    .patch(`/api/schedules/${schedA._id}/status`)
    .set(auth(adminToken))
    .send({ bsstatus: 'approved' });
  assert.equal(r.status, 200);
  ar = await ScheduleRoute.findById(priceA._id).lean();
  assert.equal(ar.arstatus, 'approved');
  ok('schedule approval auto-approves price');

  // re-approval refreshes the Sales row after a schedule time edit
  r = await request(app)
    .patch(`/api/schedules/${schedA._id}`)
    .set(auth(adminToken))
    .send({ trtime: '19:15' });
  assert.equal(r.status, 200);
  r = await request(app)
    .patch(`/api/schedules/${schedA._id}/status`)
    .set(auth(adminToken))
    .send({ bsstatus: 'approved' });
  assert.equal(r.status, 200);
  sales = await Sales.find({ bsid: schedA._id }).lean();
  assert.equal(sales[0].trtime, '19:15', 'sales trtime refreshed on re-approval');
  assert.equal(sales[0].sales, 0, 'sales counter untouched');
  ok('schedule edit + re-approval refreshes Sales trtime');

  // user schedule list: only approved
  r = await request(app).get('/api/schedules').set(auth(userToken));
  assert.ok(r.body.schedules.every((s) => s.bsstatus === 'approved'));
  ok('user schedules only approved');

  // manager schedules scoped to own bus
  r = await request(app).get('/api/schedules').set(auth(mgrToken));
  assert.ok(r.body.schedules.length > 0);
  assert.ok(r.body.schedules.every((s) => String(s.bus._id) === String(busMgr._id)));
  ok('manager schedules scoped to own');

  // manager price for own schedule
  r = await request(app)
    .post('/api/prices')
    .set(auth(mgrToken))
    .send({ bsid: schedMgr._id, rid: routeId, price: 2000 });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  priceMgr = r.body.scheduleRoute;
  cleanup.priceIds.push(priceMgr._id);
  ok('manager assign own -> 201');

  // ---- delete price (manager own ok, admin ok; user 403) ----
  r = await request(app).delete(`/api/prices/${priceMgr._id}`).set(auth(userToken));
  assert.equal(r.status, 403);
  ok('user delete price -> 403');
  r = await request(app).delete(`/api/prices/${priceMgr._id}`).set(auth(mgrToken));
  assert.equal(r.status, 200);
  const softPrice = await ScheduleRoute.findById(priceMgr._id).lean();
  assert.ok(softPrice && softPrice.deletedAt, 'price soft-deleted (kept, deletedAt set)');
  ok('manager delete own price -> 200');

  // ---- reassign after soft-delete is allowed (partial unique index) ----
  r = await request(app)
    .post('/api/prices')
    .set(auth(mgrToken))
    .send({ bsid: schedMgr._id, rid: routeId, price: 2500 });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(r.body.scheduleRoute.price, 2500);
  cleanup.priceIds.push(r.body.scheduleRoute._id);
  ok('assign again after soft-delete -> 201');

  // ---- schedule delete (manager own; admin cascade today soft) ----
  r = await request(app).delete(`/api/schedules/${schedMgr._id}`).set(auth(userToken));
  assert.equal(r.status, 403);
  ok('user delete schedule -> 403');
  r = await request(app).delete(`/api/schedules/${schedMgr._id}`).set(auth(mgrToken));
  assert.equal(r.status, 200);
  const softSched = await BusSchedule.findById(schedMgr._id).lean();
  assert.ok(softSched && softSched.deletedAt, 'schedule soft-deleted (kept, deletedAt set)');
  ok('manager delete own schedule -> 200');

  // ---- bus cascade: deactivate re-pends schedules+prices ----
  await request(app)
    .post('/api/prices')
    .set(auth(adminToken))
    .send({ bsid: schedCascade._id, rid: routeId, price: 3000 });
  priceCascade = await ScheduleRoute.findOne({ bsid: schedCascade._id }).lean();
  cleanup.priceIds.push(priceCascade._id);
  await request(app)
    .patch(`/api/schedules/${schedCascade._id}/status`)
    .set(auth(adminToken))
    .send({ bsstatus: 'approved' });
  await request(app)
    .patch(`/api/prices/${priceCascade._id}/status`)
    .set(auth(adminToken))
    .send({ arstatus: 'approved' });
  r = await request(app)
    .patch(`/api/buses/${busCascade._id}/status`)
    .set(auth(adminToken))
    .send({ bstatus: 'inactive' });
  assert.equal(r.status, 200);
  ar = await ScheduleRoute.findById(priceCascade._id).lean();
  assert.equal(ar.arstatus, 'pending');
  ok('deactivate bus re-pends price');
  const schedC = await BusSchedule.findById(schedCascade._id).lean();
  assert.equal(schedC.bsstatus, 'pending');
  ok('deactivate bus re-pends schedule');

  // ---- bus delete = soft delete: schedules/prices/sales retained ----
  r = await request(app).delete(`/api/buses/${busCascade._id}`).set(auth(adminToken));
  assert.equal(r.status, 200);
  const softBus = await Bus.findById(busCascade._id).lean();
  assert.ok(softBus && softBus.deletedAt, 'bus soft-deleted (kept, deletedAt set)');
  assert.notEqual(await BusSchedule.findById(schedCascade._id), null, 'schedule retained');
  const softAr = await ScheduleRoute.findById(priceCascade._id).lean();
  assert.ok(softAr && softAr.arstatus === 'pending', 'price retained + still pending');
  r = await request(app).get('/api/buses').set(auth(adminToken));
  assert.ok(!r.body.buses.some((b) => String(b._id) === String(busCascade._id)), 'soft-deleted bus hidden from list');
  ok('delete bus soft-deletes it and keeps schedules/prices');

  // ---- stats ----
  r = await request(app).get('/api/stats').set(auth(adminToken));
  const s0 = r.body;
  assert.ok(s0.total === s0.tickets?.pending + s0.buses + s0.schedules + s0.prices);
  assert.equal(s0.tickets?.pending, 0);
  ok('admin stats aggregate shape + tickets 0');

  // a fresh pending schedule adds exactly 1 to the schedules badge; deleting it restores the count
  const statsBus = await mkBus(adminToken, String(plateBase + 3), 'stats bus');
  const schedStats = await request(app)
    .post('/api/schedules')
    .set(auth(adminToken))
    .send({ bid: statsBus._id, trdate: day(14), trtime: '11:00' });
  assert.equal(schedStats.status, 201);
  cleanup.schedIds.push(schedStats.body.schedule._id);
  const s1 = await request(app).get('/api/stats').set(auth(adminToken));
  assert.equal(s1.body.schedules, s0.schedules + 1, 'badge +1 for pending schedule');
  ok('admin schedules badge +1 on create');

  await request(app)
    .patch(`/api/schedules/${schedStats.body.schedule._id}/status`)
    .set(auth(adminToken))
    .send({ bsstatus: 'approved' });
  const s2 = await request(app).get('/api/stats').set(auth(adminToken));
  assert.equal(s2.body.schedules, s0.schedules, 'approved is excluded from the badge');
  ok('approved schedule excluded from badge');

  r = await request(app).get('/api/stats').set(auth(mgrToken));
  assert.equal(r.status, 200);
  assert.ok(Number.isInteger(r.body.schedules));
  ok('manager stats 200');

  console.log(`\nPASS: ${pass} assertions`);
} finally {
  await User.deleteMany({ _id: { $in: cleanup.userIds } });
  await Sales.deleteMany({ bsid: { $in: cleanup.schedIds } });
  await ScheduleRoute.deleteMany({ _id: { $in: cleanup.priceIds } });
  await BusSchedule.deleteMany({ _id: { $in: cleanup.schedIds } });
  await Bus.deleteMany({ _id: { $in: cleanup.busIds } });
  await BusType.deleteMany({ _id: { $in: cleanup.busTypeIds } });
  await Route.deleteMany({ _id: { $in: cleanup.routeIds } });
  await disconnectDB();
  console.log('cleaned up');
}