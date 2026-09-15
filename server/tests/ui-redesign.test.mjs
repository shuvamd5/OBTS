// UI-redesign e2e — route delete, checkpoint delete, schedule edit.
// Run: `node tests/ui-redesign.test.mjs`
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
import Location from '../src/models/Location.js';

const uniq = Date.now().toString(36);
const platePick = (offset) => String((Date.now() % 90000) + 10000 + offset);
const cleanup = { userIds: [], routeIds: [], busIds: [], busTypeIds: [], schedIds: [], priceIds: [] };
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

const ensureType = async () => {
  const bt = await BusType.create({ name: `T37_${uniq}`, seatCount: 37, seatStyle: 'luxury' });
  cleanup.busTypeIds.push(String(bt._id));
  return String(bt._id);
};

let adminToken, userToken, mgrToken, adminId;

async function login(email, pass) {
  const r = await request(app).post('/api/auth/login').send({ logid: email, logpass: pass });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return r.body;
}

async function register(user) {
  const u = {
    uname: user,
    upass: 'Test@1234',
    ugender: 'Male',
    uemail: `${user}_${uniq}@test.com`,
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

  // grab two real towns for the route
  const locs = await Location.find({}).select('name').limit(4).lean();
  assert.ok(locs.length >= 2, 'need at least 2 towns in Location');
  const [t1, t2, t3, t4] = locs.map((l) => l.name);
  // remove any leftover from a previous (crashed) run using these towns so the
  // unique (sp,fp) index can't cause a 409 on this run
  await Route.deleteMany({ sp: { $in: [t1, t2, t3, t4] }, fp: { $in: [t1, t2, t3, t4] } });
  const [sp, fp] = [t1, t2];

  // --- users ---
  const admin = { email: 'superadmin@obts.dev', pass: 'OBTSAdmin@1234' };
  let body = await login(admin.email, admin.pass);
  adminToken = body.accessToken;
  adminId = body.user._id;

  const mgr = await register('MgrUiRedesign');
  const roleUp = await request(app)
    .patch(`/api/users/${mgr._id}/role`)
    .set(auth(adminToken))
    .send({ ustatus: 'operator' });
  assert.equal(roleUp.status, 200, JSON.stringify(roleUp.body));
  body = await login(mgr.uemail, 'Test@1234');
  mgrToken = body.accessToken;

  const usr = await register('UsrUiRedesign');
  body = await login(usr.uemail, 'Test@1234');
  userToken = body.accessToken;

  const busTypeId = await ensureType();

  // --- create a route with checkpoints ---
  let r = await request(app)
    .post('/api/routes')
    .set(auth(adminToken))
    .send({ sp, fp, distance: 150, duration: '4h' });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  const routeId = r.body.route._id;
  // adjust fp so checkpoint towns differ from sp/fp
  const cpTown = locs.find((l) => l.name !== sp && l.name !== fp).name;
  r = await request(app)
    .post(`/api/routes/${routeId}/checkpoints`)
    .set(auth(adminToken))
    .send({ route: cpTown, price: 150 });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  const cpId = r.body.route.checkpoints[0]._id;
  cleanup.routeIds.push(routeId);
  ok('route + checkpoint created (temp)');

  // --- 1. DELETE checkpoints/:cpid ---
  r = await request(app)
    .delete(`/api/routes/${routeId}/checkpoints/${cpId}`)
    .set(auth(adminToken));
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.message, 'Checkpoint deleted');
  assert.equal(r.body.route.checkpoints.length, 0, 'checkpoint removed');
  ok('admin delete checkpoint 200 + removed');

  // --- 2. DELETE /routes/:id (no schedule referencing it) ---
  r = await request(app).delete(`/api/routes/${routeId}`).set(auth(adminToken));
  assert.equal(r.status, 200, JSON.stringify(r.body));
  ok('admin delete route 200 when not referenced');
  cleanup.routeIds = cleanup.routeIds.filter((x) => x !== routeId);
  const vanished = await Route.findById(routeId).lean();
  assert.equal(vanished, null, 'route gone from DB');
  ok('route removed from DB');

  // --- 3. route delete BLOCKED when a schedule references it ---
  // create a fresh route + a bus + a schedule + assign price referencing route
  let route2 = await request(app)
    .post('/api/routes')
    .set(auth(adminToken))
    .send({ sp, fp: t3, distance: 150, duration: '4h' });
  assert.equal(route2.status, 201, JSON.stringify(route2.body));
  const route2Id = route2.body.route._id;
  cleanup.routeIds.push(route2Id);

  r = await request(app)
    .post('/api/buses')
    .set(auth(adminToken))
    .send({ plateNumber: `BA 1 KA ${platePick(0)}`, busTypeId, bname: 'UI' });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  const busId = r.body.bus._id;
  cleanup.busIds.push(busId);

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
    .send({ bsid: schedId, rid: route2Id, price: 500 });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  const priceId = r.body.scheduleRoute._id;
  cleanup.priceIds.push(priceId);

  r = await request(app).delete(`/api/routes/${route2Id}`).set(auth(adminToken));
  assert.equal(r.status, 400, JSON.stringify(r.body));
  assert.match(r.body.message, /assigned to one or more schedules/i);
  ok('route delete blocked (400) when referenced by a schedule');
  assert.ok(await Route.findById(route2Id), 'route still exists');

  // --- 4. schedule edit (admin) — change time only ---
  r = await request(app)
    .patch(`/api/schedules/${schedId}`)
    .set(auth(adminToken))
    .send({ trtime: '15:30' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.schedule.trtime, '15:30');
  ok('admin edit schedule time 200');

  // --- 5. schedule edit no-change ---
  r = await request(app)
    .patch(`/api/schedules/${schedId}`)
    .set(auth(adminToken))
    .send({ trtime: '15:30' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.message, 'No change');
  ok('schedule edit no-change');

  // --- 6. schedule edit date that collides with same bus → 409 ---
  // add a second schedule same bus at day(8)
  r = await request(app)
    .post('/api/schedules')
    .set(auth(adminToken))
    .send({ bid: busId, trdate: day(8), trtime: '09:00' });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  const sched2 = r.body.schedule._id;
  cleanup.schedIds.push(sched2);

  // try editing sched2's date to day(14) → same-date conflict with sched
  r = await request(app)
    .patch(`/api/schedules/${sched2}`)
    .set(auth(adminToken))
    .send({ trdate: day(14) });
  assert.equal(r.status, 409, JSON.stringify(r.body));
  assert.match(r.body.message, /already registered/i);
  ok('schedule edit date same-bus conflict → 409');

  // --- 7. user forbidden from schedule edit / route delete ---
  r = await request(app).patch(`/api/schedules/${schedId}`).set(auth(userToken)).send({ trtime: '10:00' });
  assert.equal(r.status, 403, JSON.stringify(r.body));
  ok('user schedule edit 403');

  r = await request(app).delete(`/api/routes/${route2Id}`).set(auth(userToken));
  assert.equal(r.status, 403, JSON.stringify(r.body));
  ok('user route delete 403');

  // --- 8. manager CAN edit own-bus schedule time ---
  // need a bus owned by manager; create one as manager, schedule it, edit
  r = await request(app)
    .post('/api/buses')
    .set(auth(mgrToken))
    .send({ plateNumber: `BA 2 KA ${platePick(1)}`, busTypeId, bname: 'UIM' });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  const mgrBus = r.body.bus._id;
  cleanup.busIds.push(mgrBus);

  r = await request(app)
    .post('/api/schedules')
    .set(auth(mgrToken))
    .send({ bid: mgrBus, trdate: day(20), trtime: '08:00' });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  const mgrSched = r.body.schedule._id;
  cleanup.schedIds.push(mgrSched);

  r = await request(app)
    .patch(`/api/schedules/${mgrSched}`)
    .set(auth(mgrToken))
    .send({ trtime: '19:45' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.schedule.trtime, '19:45');
  ok('manager edit own-bus schedule time 200');

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
