process.env.NODE_ENV = 'test';

import request from 'supertest';
import assert from 'node:assert/strict';
import { app } from '../src/index.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import User from '../src/models/User.js';
import BusType from '../src/models/BusType.js';

const uniq = Date.now().toString(36);
const cleanup = { userIds: [], busTypeNames: [] };
const typeName = (tag) => `${tag}_${uniq}`;
const email = (tag) => `${tag}_${uniq}@test.com`;
const auth = (t) => ({ Authorization: `Bearer ${t}` });
let mobSeq = 0;
const mobile = () => `982${String((Date.now() + mobSeq++) % 10000000).padStart(7, '0')}`;

let pass = 0;
const ok = (name) => {
  pass += 1;
  console.log(`  ok - ${name}`);
};

const ADMIN = { logid: 'superadmin@obts.dev', logpass: 'OBTSAdmin@1234' };

async function register(tag) {
  let r = await request(app).post('/api/auth/register').send({
    uname: tag, uemail: email(tag), umobile: mobile(),
    upass: 'Test@1234', ugender: 'Male',
  });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  cleanup.userIds.push(r.body.user._id);
  return r.body;
}

try {
  await connectDB();

  let r = await request(app).post('/api/auth/login').send(ADMIN);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const adminToken = r.body.accessToken;

  // --- 1. no token → 401
  r = await request(app).get('/api/bus-types');
  assert.equal(r.status, 401);
  ok('unauth GET /api/bus-types 401');

  // --- 2. public reference list, no token (BT3)
  r = await request(app).get('/api/reference/bus-types');
  assert.equal(r.status, 200);
  assert.ok(Array.isArray(r.body.busTypes) && r.body.busTypes.length > 0);
  ok('public GET /api/reference/bus-types 200 + non-empty');

  // --- 3. admin list w/ busCount + no deletedAt
  r = await request(app).get('/api/bus-types').set(auth(adminToken));
  assert.equal(r.status, 200);
  assert.ok(r.body.busTypes.every((t) => typeof t.busCount === 'number' && t.deletedAt === null));
  ok('admin list 200 + every type has busCount + not soft-deleted');

  // --- 4. valid create → 201
  const name = typeName('Express');
  r = await request(app).post('/api/bus-types').set(auth(adminToken)).send({ name, seatCount: 37, seatStyle: 'luxury' });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(r.body.busType.seatCount, 37);
  assert.equal(r.body.busType.seatStyle, 'luxury');
  cleanup.busTypeNames.push(name);
  ok('valid create 201 + fields echoed');

  // --- 5. even seat count → 400
  r = await request(app).post('/api/bus-types').set(auth(adminToken)).send({ name: typeName('Even'), seatCount: 38, seatStyle: 'standard' });
  assert.equal(r.status, 400);
  ok('even seatCount 400');

  // --- 6. 28 → 400
  r = await request(app).post('/api/bus-types').set(auth(adminToken)).send({ name: typeName('Seat28'), seatCount: 28, seatStyle: 'standard' });
  assert.equal(r.status, 400);
  ok('seatCount 28 400');

  // --- 7. 27 → 400
  r = await request(app).post('/api/bus-types').set(auth(adminToken)).send({ name: typeName('Seat27'), seatCount: 27, seatStyle: 'standard' });
  assert.equal(r.status, 400);
  ok('seatCount 27 400');

  // --- 8. duplicate name → 409
  r = await request(app).post('/api/bus-types').set(auth(adminToken)).send({ name, seatCount: 41, seatStyle: 'semi-luxury' });
  assert.equal(r.status, 409);
  ok('duplicate name 409');

  // --- 9. operator cannot create → 403 (BT6)
  const op = await register('BtOperator');
  r = await request(app).patch(`/api/users/${op.user._id}/role`).set(auth(adminToken)).send({ ustatus: 'operator' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  r = await request(app).post('/api/auth/login').send({ logid: op.user.uemail, logpass: 'Test@1234' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  r = await request(app).post('/api/bus-types').set(auth(r.body.accessToken)).send({ name: typeName('OpBusType'), seatCount: 33, seatStyle: 'standard' });
  assert.equal(r.status, 403);
  ok('operator create 403');

  // --- 10. PATCH valid rename → 200
  const renamed = `${name}_renamed`;
  r = await request(app).patch(`/api/bus-types/${cleanup.busTypeNames.length ? await getTypeId(name) : ''}`).set(auth(adminToken)).send({ name: renamed });
  // (id resolved above so the patch targets the created type)
  assert.equal(r.status, 200, JSON.stringify(r.body));

  ok('PATCH rename 200');
  cleanup.busTypeNames[0] = renamed;

  // --- 11. PATCH even seatCount → 400
  r = await request(app).patch(`/api/bus-types/${await getTypeId(renamed)}`).set(auth(adminToken)).send({ seatCount: 40 });
  assert.equal(r.status, 400);
  ok('PATCH even seatCount 400');

  // --- 12. PATCH unknown id → 404
  r = await request(app).patch(`/api/bus-types/${'0'.repeat(24)}`).set(auth(adminToken)).send({ name: 'nobody' });
  assert.equal(r.status, 404);
  ok('PATCH unknown 404');

  // --- 13. soft delete → 200, gone from list
  r = await request(app).delete(`/api/bus-types/${await getTypeId(renamed)}`).set(auth(adminToken));
  assert.equal(r.status, 200, JSON.stringify(r.body));
  r = await request(app).get('/api/bus-types').set(auth(adminToken));
  assert.ok(!r.body.busTypes.some((t) => t.name === renamed));
  ok('soft delete 200 + absent from list');

  // --- 14. recreate deleted name → 409 (name stays reserved on the unique index)
  r = await request(app).post('/api/bus-types').set(auth(adminToken)).send({ name: renamed, seatCount: 45, seatStyle: 'luxury' });
  assert.equal(r.status, 409);
  ok('recreate soft-deleted name 409');

  // --- 15. delete deleted id again → 404
  r = await request(app).delete(`/api/bus-types/${await getTypeId(renamed)}`).set(auth(adminToken));
  assert.equal(r.status, 404);
  ok('delete already-deleted id 404');

  console.log(`\nPASS: ${pass} assertions`);
} finally {
  if (cleanup.busTypeNames.length) await BusType.deleteMany({ name: { $in: cleanup.busTypeNames } });
  await User.deleteMany({ _id: { $in: cleanup.userIds } });
  await disconnectDB();
  console.log('cleaned up');
}

// helper — resolve type id from an active name (so the renaming test stays in sync)
async function getTypeId(name) {
  const t = await BusType.findOne({ name }).lean();
  return t?._id.toString();
}