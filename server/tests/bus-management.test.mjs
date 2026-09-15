// Bus Management e2e — B6/B7/B8/B9 + BusType reference-block.
// Run: `node tests/bus-management.test.mjs`
process.env.NODE_ENV = 'test';

import request from 'supertest';
import assert from 'node:assert/strict';
import { app } from '../src/index.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import User from '../src/models/User.js';
import Bus from '../src/models/Bus.js';
import BusType from '../src/models/BusType.js';

const uniq = Date.now().toString(36);
const cleanup = { userIds: [], busIds: [], typeIds: [] };
const email = (tag) => `${tag}_${uniq}@test.com`;
const auth = (t) => ({ Authorization: `Bearer ${t}` });
const plate = (suffix) => `XB ${suffix} XP ${Date.now().toString().slice(-6)}`;
let mobSeq = 0;
const mobile = () => `984${String((Date.now() + mobSeq++) % 10000000).padStart(7, '0')}`;

let pass = 0;
const ok = (name) => { pass += 1; console.log(`  ok - ${name}`); };

async function register(tag) {
  const r = await request(app).post('/api/auth/register').send({
    uname: tag, uemail: email(tag), umobile: mobile(), upass: 'Test@1234', ugender: 'Male',
  });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  cleanup.userIds.push(r.body.user._id);
  return r.body;
}
const login = async (uemail) =>
  (await request(app).post('/api/auth/login').send({ logid: uemail, logpass: 'Test@1234' })).body;
async function promote(adminToken, userId) {
  const r = await request(app).patch(`/api/users/${userId}/role`).set(auth(adminToken)).send({ ustatus: 'operator' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
}
const adminLogin = async () => {
  const r = await request(app).post('/api/auth/login').send({ logid: 'superadmin@obts.dev', logpass: 'OBTSAdmin@1234' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return r.body.accessToken;
};

try {
  await connectDB();
  const adminToken = await adminLogin();

  const type = await BusType.create({ name: `BusT_${uniq}`, seatCount: 37, seatStyle: 'luxury' });
  cleanup.typeIds.push(String(type._id));

  const opA = await register('BMngA');
  await promote(adminToken, opA.user._id);
  const opB = await register('BMngB');
  await promote(adminToken, opB.user._id);
  const cus = await register('BusCust');
  const opAToken = (await login(opA.user.uemail)).accessToken;
  const opBToken = (await login(opB.user.uemail)).accessToken;
  const cusToken = (await login(cus.user.uemail)).accessToken;

  const base = { plateNumber: plate('1'), busTypeId: String(type._id), bname: 'Bus One' };

  // --- 1. admin create → 201 pending + busType populated
  let r = await request(app).post('/api/buses').set(auth(adminToken)).send(base);
  assert.equal(r.status, 201, JSON.stringify(r.body));
  const b1 = r.body.bus;
  assert.equal(b1.bstatus, 'pending');
  assert.equal(b1.busType.seatCount, 37);
  assert.equal(b1.ownerName, null);
  cleanup.busIds.push(b1._id);
  ok('admin create 201 + default pending + populated busType');

  // --- 2. unknown busTypeId → 404
  r = await request(app).post('/api/buses').set(auth(adminToken)).send({ ...base, plateNumber: plate('2'), busTypeId: 'ffffffffffffffffffffffff' });
  assert.equal(r.status, 404);
  ok('unknown busTypeId 404');

  // --- 3. duplicate plate → 409
  r = await request(app).post('/api/buses').set(auth(adminToken)).send(base);
  assert.equal(r.status, 409);
  ok('duplicate plate 409');

  // --- 4. malformed busTypeId → 400
  r = await request(app).post('/api/buses').set(auth(adminToken)).send({ ...base, plateNumber: plate('3'), busTypeId: 'nope' });
  assert.equal(r.status, 400);
  ok('malformed busTypeId 400');

  // --- 5. GET /:id → 200 with busType (B7)
  r = await request(app).get(`/api/buses/${b1._id}`).set(auth(adminToken));
  assert.equal(r.status, 200);
  assert.equal(r.body.bus.busType.name, type.name);
  ok('GET /buses/:id 200 + busType populated');

  // --- 6. GET unknown → 404
  r = await request(app).get(`/api/buses/${'0'.repeat(24)}`).set(auth(adminToken));
  assert.equal(r.status, 404);
  ok('GET unknown bus 404');

  // --- 7. operator create → 201 auto-owned
  r = await request(app).post('/api/buses').set(auth(opAToken)).send({ plateNumber: plate('4'), busTypeId: String(type._id), bname: 'Op Bus' });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  const opBus = r.body.bus;
  assert.equal(opBus.uid, opA.user._id);
  cleanup.busIds.push(opBus._id);
  ok('operator create 201 + auto-owned');

  // --- 8. operator list scoped to own + admin sees all
  r = await request(app).get('/api/buses').set(auth(opAToken));
  assert.ok(r.body.buses.length === 1 && String(r.body.buses[0]._id) === String(opBus._id));
  r = await request(app).get('/api/buses').set(auth(adminToken));
  assert.ok(r.body.buses.some((b) => String(b._id) === String(b1._id)));
  ok('operator list scoped, admin list all');

  // --- 9. operator edit own 200 / other 403
  r = await request(app).patch(`/api/buses/${opBus._id}`).set(auth(opAToken)).send({ bname: 'Op Bus Renamed', amenities: ['wifi', 'ac'] });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual(r.body.bus.amenities, ['wifi', 'ac']);
  r = await request(app).patch(`/api/buses/${b1._id}`).set(auth(opAToken)).send({ bname: 'Hack' });
  assert.equal(r.status, 403);
  ok('operator edits own 200 + other 403');

  // --- 10. admin edit 200 + plate dup 409
  r = await request(app).patch(`/api/buses/${b1._id}`).set(auth(adminToken)).send({ bname: 'Bus One Prime' });
  assert.equal(r.status, 200);
  assert.equal(r.body.bus.bname, 'Bus One Prime');
  r = await request(app).patch(`/api/buses/${opBus._id}`).set(auth(adminToken)).send({ plateNumber: base.plateNumber });
  assert.equal(r.status, 409);
  ok('admin edit 200 + plate dup 409');

  // --- 11. reassign (B9) guards
  r = await request(app).patch(`/api/buses/${b1._id}/operator`).set(auth(adminToken)).send({});
  assert.equal(r.status, 400);
  r = await request(app).patch(`/api/buses/${b1._id}/operator`).set(auth(adminToken)).send({ uid: cus.user._id });
  assert.equal(r.status, 400);
  ok('reassign missing uid 400 + customer target 400');

  // --- 12. operator cannot reassign → 403
  r = await request(app).patch(`/api/buses/${b1._id}/operator`).set(auth(opAToken)).send({ uid: opB.user._id });
  assert.equal(r.status, 403);
  ok('operator reassign 403');

  // --- 13. admin reassign → 200 uid updated
  r = await request(app).patch(`/api/buses/${b1._id}/operator`).set(auth(adminToken)).send({ uid: opB.user._id });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.bus.uid, opB.user._id);
  assert.equal(r.body.bus.ownerName, 'BMngB');
  ok('admin reassign 200 + uid/ownerName updated');

  // --- 14. customer list = active only
  r = await request(app).patch(`/api/buses/${b1._id}/status`).set(auth(adminToken)).send({ bstatus: 'active' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  r = await request(app).get('/api/buses').set(auth(cusToken));
  assert.ok(r.body.buses.every((b) => b.bstatus === 'active') && r.body.buses.some((b) => String(b._id) === String(b1._id)));
  ok('customer list active-only');

  // --- 15. BusType PATCH/DELETE blocked while a bus references it → 409
  r = await request(app).patch(`/api/bus-types/${type._id}`).set(auth(adminToken)).send({ name: 'Blocked Rename' });
  assert.equal(r.status, 409);
  r = await request(app).delete(`/api/bus-types/${type._id}`).set(auth(adminToken));
  assert.equal(r.status, 409);
  ok('BusType PATCH/DELETE 409 while referenced');

  // --- 16. after deleting the buses, type editable again
  r = await request(app).delete(`/api/buses/${b1._id}`).set(auth(adminToken));
  assert.equal(r.status, 200, JSON.stringify(r.body));
  r = await request(app).delete(`/api/buses/${opBus._id}`).set(auth(adminToken));
  assert.equal(r.status, 200, JSON.stringify(r.body));
  r = await request(app).patch(`/api/bus-types/${type._id}`).set(auth(adminToken)).send({ name: 'Now Editable' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  r = await request(app).delete(`/api/bus-types/${type._id}`).set(auth(adminToken));
  assert.equal(r.status, 200);
  ok('after bus delete, type PATCH 200 + DELETE 200');

  console.log(`\nPASS: ${pass} assertions`);
} finally {
  await Bus.deleteMany({ _id: { $in: cleanup.busIds } });
  await User.deleteMany({ _id: { $in: cleanup.userIds } });
  await BusType.deleteMany({ _id: { $in: cleanup.typeIds } });
  await disconnectDB();
  console.log('cleaned up');
}