// Card UI e2e — route status toggle + status-reset-on-edit (bus/schedule).
// Run: `node tests/card-ui.test.mjs`
process.env.NODE_ENV = 'test';

import request from 'supertest';
import assert from 'node:assert/strict';
import { app } from '../src/index.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import User from '../src/models/User.js';
import Bus from '../src/models/Bus.js';
import Route from '../src/models/Route.js';
import Location from '../src/models/Location.js';
import BusType from '../src/models/BusType.js';
import BusSchedule from '../src/models/BusSchedule.js';
import ScheduleRoute from '../src/models/ScheduleRoute.js';
import Sales from '../src/models/Sales.js';

const uniq = Date.now().toString(36);
const cleanup = { userIds: [], busIds: [], routeIds: [], busTypeIds: [], schedIds: [], priceIds: [] };
const auth = (t) => ({ Authorization: `Bearer ${t}` });
const day = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
};

let pass = 0;
const ok = (name) => { pass += 1; console.log(`  ok - ${name}`); };

async function adminLogin() {
  const r = await request(app)
    .post('/api/auth/login')
    .send({ logid: 'superadmin@obts.dev', logpass: 'OBTSAdmin@1234' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return r.body;
}

async function register(tag) {
  let seq = 0;
  const u = {
    uname: tag,
    upass: 'Test@1234',
    ugender: 'Male',
    uemail: `${tag}_${uniq}_${seq++}@test.com`,
    umobile: `985${String(Date.now() % 10000000).padStart(7, '0')}`,
  };
  const r = await request(app).post('/api/auth/register').send(u);
  assert.equal(r.status, 201, JSON.stringify(r.body));
  cleanup.userIds.push(r.body.user._id);
  const l = await request(app).post('/api/auth/login').send({ logid: u.uemail, logpass: 'Test@1234' });
  return l.body;
}

try {
  await connectDB();
  const { accessToken: adminToken, user: { uname: adminUname } } = await adminLogin();
  const user = await register('CardUiUsr');

  const locs = await Location.find({}).select('name').limit(6).lean();
  assert.ok(locs.length >= 4, 'need at least 4 towns in Location');
  const [t1, t2, t3, t4] = locs.map((l) => l.name);
  await Route.deleteMany({ sp: { $in: [t1, t2, t3, t4] }, fp: { $in: [t1, t2, t3, t4] } });

  const bt = await BusType.create({ name: `CardT_${uniq}`, seatCount: 37, seatStyle: 'luxury' });
  cleanup.busTypeIds.push(String(bt._id));

  // === ROUTE STATUS ===
  let r = await request(app)
    .post('/api/routes')
    .set(auth(adminToken))
    .send({ sp: t1, fp: t2, distance: 200, duration: '5h 30m' });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  const routeId = r.body.route._id;
  cleanup.routeIds.push(routeId);
  assert.equal(r.body.route.rstatus, 'pending', 'route defaults to pending');
  ok('route create defaults rstatus=pending');

  // listRoutes returns rstatus for customers too
  r = await request(app).get('/api/routes').set(auth(user.accessToken));
  const listed = r.body.routes.find((x) => String(x._id) === String(routeId));
  assert.equal(listed?.rstatus, 'pending');
  ok('route list exposes rstatus');

  // admin toggle pending -> active
  r = await request(app)
    .patch(`/api/routes/${routeId}/status`)
    .set(auth(adminToken))
    .send({ rstatus: 'active' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.route.rstatus, 'active');
  assert.equal(r.body.route.rsapby, adminUname, 'rsapby set from JWT user');
  assert.equal(r.body.message, 'Status updated');
  ok('admin route status pending->active 200');

  // no-change -> 200 "No change"
  r = await request(app)
    .patch(`/api/routes/${routeId}/status`)
    .set(auth(adminToken))
    .send({ rstatus: 'active' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.message, 'No change');
  ok('route status no-change');

  // invalid value -> 400
  r = await request(app)
    .patch(`/api/routes/${routeId}/status`)
    .set(auth(adminToken))
    .send({ rstatus: 'stale' });
  assert.equal(r.status, 400, JSON.stringify(r.body));
  ok('route status invalid value 400');

  // user forbidden -> 403
  r = await request(app)
    .patch(`/api/routes/${routeId}/status`)
    .set(auth(user.accessToken))
    .send({ rstatus: 'inactive' });
  assert.equal(r.status, 403, JSON.stringify(r.body));
  ok('user route status 403');

  // editing a referenced-route sp IS blocked, but no-chex still "No change"
  // change sp while active -> resets to pending
  r = await request(app)
    .patch(`/api/routes/${routeId}`)
    .set(auth(adminToken))
    .send({ sp: t3 });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.route.sp, t3);
  assert.equal(r.body.route.rstatus, 'pending', 'active route edit resets to pending');
  ok('route edit while active resets rstatus=pending');

  // no-change edit keeps active
  r = await request(app)
    .patch(`/api/routes/${routeId}/status`)
    .set(auth(adminToken))
    .send({ rstatus: 'active' });
  assert.equal(r.status, 200);
  r = await request(app)
    .patch(`/api/routes/${routeId}`)
    .set(auth(adminToken))
    .send({ fp: t2 });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.route.message ?? '', '', 'fp t2 equals current fp');
  assert.equal(r.body.route.rstatus, 'active', 'no-change edit keeps status');
  ok('route no-change edit keeps rstatus');

  // === BUS STATUS RESET ON EDIT ===
  r = await request(app)
    .post('/api/buses')
    .set(auth(adminToken))
    .send({ plateNumber: `CB 1 KA ${Date.now().toString().slice(-6)}`, busTypeId: String(bt._id), bname: 'Card Bus' });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  const busId = r.body.bus._id;
  cleanup.busIds.push(busId);

  r = await request(app).patch(`/api/buses/${busId}/status`).set(auth(adminToken)).send({ bstatus: 'active' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.bus.bstatus, 'active');
  ok('bus status set to active');

  r = await request(app).patch(`/api/buses/${busId}`).set(auth(adminToken)).send({ bname: 'Card Bus Renamed', amenities: ['wifi'] });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.bus.bstatus, 'pending', 'bus info edit resets to pending');
  assert.equal(r.body.bus.bsapby, 'none', 'bsapby reset to none');
  ok('bus info edit resets bstatus=pending + bsapby=none');

  // === SCHEDULE STATUS RESET ON EDIT ===
  r = await request(app)
    .post('/api/schedules')
    .set(auth(adminToken))
    .send({ bid: busId, trdate: day(14), trtime: '12:00' });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  const schedId = r.body.schedule._id;
  cleanup.schedIds.push(schedId);

  r = await request(app)
    .post('/api/prices')
    .set(auth(adminToken))
    .send({ bsid: schedId, rid: routeId, price: 500 });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  const priceId = r.body.scheduleRoute._id;
  cleanup.priceIds.push(priceId);

  r = await request(app).patch(`/api/schedules/${schedId}/status`).set(auth(adminToken)).send({ bsstatus: 'approved' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const arDerived = await ScheduleRoute.findById(priceId).lean();
  assert.equal(arDerived.arstatus, 'approved', 'schedule approval auto-approves the price');
  ok('schedule approval auto-approves price');

  r = await request(app).patch(`/api/schedules/${schedId}`).set(auth(adminToken)).send({ trtime: '18:45' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.schedule.trtime, '18:45');
  assert.equal(r.body.schedule.bsstatus, 'pending', 'schedule info edit resets to pending');
  assert.equal(r.body.schedule.bssapby, 'none', 'bssapby reset to none');
  const arAfter = await ScheduleRoute.findById(priceId).lean();
  assert.equal(arAfter.arstatus, 'pending', 'price pending on schedule edit');
  ok('schedule info edit resets bsstatus=pending + price pending');

  console.log(`\nPASS: ${pass} assertions`);
} finally {
  await User.deleteMany({ _id: { $in: cleanup.userIds } });
  await ScheduleRoute.deleteMany({ _id: { $in: cleanup.priceIds } });
  await Sales.deleteMany({ bsid: { $in: cleanup.schedIds } });
  await BusSchedule.deleteMany({ _id: { $in: cleanup.schedIds } });
  await Bus.deleteMany({ _id: { $in: cleanup.busIds } });
  await Route.deleteMany({ _id: { $in: cleanup.routeIds } });
  await BusType.deleteMany({ _id: { $in: cleanup.busTypeIds } });
  await disconnectDB();
  console.log('cleaned up');
}