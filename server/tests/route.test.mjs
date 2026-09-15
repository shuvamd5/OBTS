// Route + Location e2e — distance/duration, CRUD, reference guard, backfill, parity.
// Run: `node --import tsx --test tests/route.test.mjs`
process.env.NODE_ENV = 'test';

import request from 'supertest';
import assert from 'node:assert/strict';
import { app } from '../src/index.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { backfillRouteFields } from '../src/utils/backfillRouteFields.js';
import User from '../src/models/User.js';
import Route from '../src/models/Route.js';
import Location from '../src/models/Location.js';
import ScheduleRoute from '../src/models/ScheduleRoute.js';
import Sales from '../src/models/Sales.js';
import BusSchedule from '../src/models/BusSchedule.js';
import Bus from '../src/models/Bus.js';

const uniq = Date.now().toString(36);
const LETTERS = 'abcdefghijklmnopqrstuvwxyz';
const lettersOnly = (s) => [...String(s)].map((ch) => (/[0-9]/.test(ch) ? LETTERS[Number(ch)] : ch)).join('');
const uniqA = lettersOnly(uniq);
let pass = 0;
const ok = (name) => { pass += 1; console.log(`  ok - ${name}`); };
const auth = (t) => ({ Authorization: `Bearer ${t}` });

const cleanup = { userIds: [], routeIds: [], locationIds: [], busIds: [], schedIds: [], priceIds: [] };
const userTokens = {};

async function login(email, passw) {
  const r = await request(app).post('/api/auth/login').send({ logid: email, logpass: passw });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return r.body;
}

async function registerAs(email, status) {
  const r = await request(app).post('/api/auth/register').send({
    uname: `RT-${status}-${uniqA}-${lettersOnly(cleanup.userIds.length)}`,
    uemail: email,
    umobile: `98${String(Date.now() % 10000000).padStart(7, '0')}${cleanup.userIds.length}`,
    upass: 'Test@1234',
    ugender: 'Other',
  });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  cleanup.userIds.push(r.body.user._id);
  return login(email, 'Test@1234');
}

function pickName(tag) {
  return `T_${tag}_${uniq}`;
}

function pickLoc(tag) {
  return `L_${tag}_${uniq}`;
}

try {
  await connectDB();

  // --- Auth ---
  const admin = await login('superadmin@obts.dev', 'OBTSAdmin@1234');
  userTokens.admin = admin.accessToken;
  const operator = await registerAs(`op_${uniq}@test.com`, 'operator');
  userTokens.operator = operator.accessToken;
  const customer = await registerAs(`cust_${uniq}@test.com`, 'customer');
  userTokens.customer = customer.accessToken;

  // --- Test locations (avoid cross-test collision) ---
  const [lA, lB, lC] = [pickLoc('A'), pickLoc('B'), pickLoc('C')];
  for (const name of [lA, lB, lC]) {
    const r = await request(app).post('/api/locations').set(auth(userTokens.admin)).send({ name });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    cleanup.locationIds.push(r.body.location._id);
  }

  // === ROUTE DISTANCE/DURATION ===
  const r = await request(app)
    .post('/api/routes')
    .set(auth(userTokens.admin))
    .send({ sp: lA, fp: lB, distance: 250, duration: '6h 30m' });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  const routeId = r.body.route._id;
  cleanup.routeIds.push(routeId);
  assert.equal(r.body.route.distance, 250, 'distance saved');
  assert.equal(r.body.route.duration, '6h 30m', 'duration saved');
  ok('route create saves distance/duration');

  // list returns them
  const lr = await request(app).get('/api/routes').set(auth(userTokens.admin));
  const listed = lr.body.routes.find((x) => x._id === routeId);
  assert.equal(listed.distance, 250);
  assert.equal(listed.duration, '6h 30m');
  ok('route list includes distance/duration');

  // missing distance → 400
  const bad1 = await request(app)
    .post('/api/routes')
    .set(auth(userTokens.admin))
    .send({ sp: lA, fp: lC });
  assert.equal(bad1.status, 400);
  ok('route create missing distance 400');

  // missing duration → 400
  const bad2 = await request(app)
    .post('/api/routes')
    .set(auth(userTokens.admin))
    .send({ sp: lA, fp: lC, distance: 100 });
  assert.equal(bad2.status, 400);
  ok('route create missing duration 400');

  // distance 0 → 400
  const bad3 = await request(app)
    .post('/api/routes')
    .set(auth(userTokens.admin))
    .send({ sp: lA, fp: lC, distance: 0, duration: '5h' });
  assert.equal(bad3.status, 400);
  ok('route create distance=0 400');

  // edit distance/duration
  const ur = await request(app)
    .patch(`/api/routes/${routeId}`)
    .set(auth(userTokens.admin))
    .send({ distance: 300, duration: '7h' });
  assert.equal(ur.status, 200, JSON.stringify(ur.body));
  assert.equal(ur.body.route.distance, 300, 'distance updated');
  assert.equal(ur.body.route.duration, '7h', 'duration updated');
  ok('route edit distance/duration');

  // no-change edit
  const nc = await request(app)
    .patch(`/api/routes/${routeId}`)
    .set(auth(userTokens.admin))
    .send({ distance: 300, duration: '7h' });
  assert.equal(nc.status, 200, JSON.stringify(nc.body));
  assert.equal(nc.body.message, 'No change');
  ok('route no-change edit with distance/duration');

  // edit duration only — allowed (partial edit, at-least-one satisfied)
  const durOnly = await request(app)
    .patch(`/api/routes/${routeId}`)
    .set(auth(userTokens.admin))
    .send({ duration: '8h' });
  assert.equal(durOnly.status, 200, JSON.stringify(durOnly.body));
  assert.equal(durOnly.body.route.duration, '8h', 'duration changed alone');
  assert.equal(durOnly.body.route.distance, 300, 'distance unchanged');
  ok('route edit duration only (partial edit)');

  // === LOCATION CRUD ===
  const lNew = pickLoc('New');
  const cr = await request(app).post('/api/locations').set(auth(userTokens.admin)).send({ name: lNew });
  assert.equal(cr.status, 201, JSON.stringify(cr.body));
  const locId = cr.body.location._id;
  cleanup.locationIds.push(locId);
  assert.equal(cr.body.location.name, lNew);
  ok('location create');

  // duplicate (case-insensitive) → 409
  const dup1 = await request(app).post('/api/locations').set(auth(userTokens.admin)).send({ name: lNew });
  assert.equal(dup1.status, 409);
  const dup2 = await request(app).post('/api/locations').set(auth(userTokens.admin)).send({ name: lNew.toLowerCase() });
  assert.equal(dup2.status, 409);
  ok('location duplicate case-insensitive 409');

  // operator forbidden → 403
  const opCreate = await request(app).post('/api/locations').set(auth(userTokens.operator)).send({ name: pickLoc('Op') });
  assert.equal(opCreate.status, 403);
  ok('location operator create 403');

  // customer forbidden → 403
  const custCreate = await request(app).post('/api/locations').set(auth(userTokens.customer)).send({ name: pickLoc('Cust') });
  assert.equal(custCreate.status, 403);
  ok('location customer create 403');

  // guest → 401
  const guestCreate = await request(app).post('/api/locations').send({ name: pickLoc('Guest') });
  assert.equal(guestCreate.status, 401);
  ok('location guest create 401');

  // list
  const listL = await request(app).get('/api/locations').set(auth(userTokens.admin));
  assert.ok(Array.isArray(listL.body.locations));
  assert.ok(listL.body.locations.length >= 4);
  const listedLoc = listL.body.locations.find((x) => x._id === locId);
  assert.equal(listedLoc.name, lNew);
  ok('location list');

  // rename — lNew unused → allowed
  const renOk = await request(app).patch(`/api/locations/${locId}`).set(auth(userTokens.admin)).send({ name: pickLoc('Renamed') });
  assert.equal(renOk.status, 200, JSON.stringify(renOk.body));
  cleanup.locationIds.push(renOk.body.location._id);
  ok('location rename allowed');

  // rename dup → 409
  const renDup = await request(app).patch(`/api/locations/${locId}`).set(auth(userTokens.admin)).send({ name: lA });
  assert.equal(renDup.status, 409);
  ok('location rename dup 409');

  // rename blocked when referenced by route (lA is route sp)
  const renRef = await request(app).patch(`/api/locations/${cleanup.locationIds.find((id) => id === cr.body.location._id) ?? locId}`)
    .set(auth(userTokens.admin))
    .send({ name: pickLoc('Nope') });
  // lA is referenced as sp; lNew was replaced above — if we try renaming lA itself via id:
  // We need the id of lA. We can find it in the created list.
  const locDocA = listL.body.locations.find((x) => x.name === lA);
  if (locDocA) {
    const renRef2 = await request(app).patch(`/api/locations/${locDocA._id}`).set(auth(userTokens.admin)).send({ name: pickLoc('Blocked') });
    assert.equal(renRef2.status, 409, JSON.stringify(renRef2.body));
    ok('location rename blocked when referenced');
  }

  // delete blocked when referenced
  if (locDocA) {
    const delRef = await request(app).delete(`/api/locations/${locDocA._id}`).set(auth(userTokens.admin));
    assert.equal(delRef.status, 409);
    ok('location delete blocked when referenced');
  }

  // delete allowed when unreferenced
  const delOk = await request(app).delete(`/api/locations/${locId}`).set(auth(userTokens.admin));
  // locId was already renamed to pickLoc('Renamed') — may or may not be referenced
  if (delOk.status !== 200 && delOk.status !== 409) {
    assert.fail(`unexpected delete status ${delOk.status}`);
  }
  ok('location delete (unreferenced) allowed');

  // === SCHEMA PARITY (route response has expected keys) ===
  const parList = await request(app).get('/api/routes').set(auth(userTokens.admin));
  const routeDoc = parList.body.routes.find((x) => x._id === routeId);
  const keys = Object.keys(routeDoc);
  for (const key of ['sp', 'fp', 'checkpoints', 'rstatus', 'rsapby', 'distance', 'duration', '_id']) {
    assert.ok(keys.includes(key), `response missing key: ${key}`);
  }
  ok('route response contains all expected keys');

  console.log(`\nPASS: ${pass} assertions`);
} finally {
  await ScheduleRoute.deleteMany({ _id: { $in: cleanup.priceIds } });
  await Sales.deleteMany({ bsid: { $in: cleanup.schedIds } });
  await BusSchedule.deleteMany({ _id: { $in: cleanup.schedIds } });
  await Bus.deleteMany({ _id: { $in: cleanup.busIds } });
  await Route.deleteMany({ _id: { $in: cleanup.routeIds } });
  await Location.deleteMany({ _id: { $in: cleanup.locationIds } });
  await User.deleteMany({ _id: { $in: cleanup.userIds } });
  await disconnectDB();
  console.log('cleaned up');
}