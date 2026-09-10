// A15 e2e — PATCH /api/auth/me profile editing.
// Run: `node tests/profile-edit.test.mjs`
process.env.NODE_ENV = 'test';

import request from 'supertest';
import assert from 'node:assert/strict';
import { app } from '../src/index.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import User from '../src/models/User.js';

const uniq = Date.now().toString(36);
const cleanup = { userIds: [] };
let mobSeq = 0;
const mobile = () => `982${String((Date.now() + mobSeq++) % 10000000).padStart(7, '0')}`;
const email = (tag) => `${tag}_${uniq}@test.com`;
const auth = (t) => ({ Authorization: `Bearer ${t}` });

let pass = 0;
const ok = (name) => {
  pass += 1;
  console.log(`  ok - ${name}`);
};

async function register(tag) {
  const r = await request(app).post('/api/auth/register').send({
    uname: tag,
    uemail: email(tag),
    umobile: mobile(),
    upass: 'Test@1234',
    ugender: 'Male',
  });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  cleanup.userIds.push(r.body.user._id);
  return r.body;
}

try {
  await connectDB();

  // register two fresh customers (no admin dependency)
  const a = await register('ProfA');
  const b = await register('ProfB');
  const aToken = a.accessToken;
  const aId = a.user._id;

  // --- 1. no token → 401
  let r = await request(app).patch('/api/auth/me').send({ uname: 'X' });
  assert.equal(r.status, 401);
  ok('unauth PATCH /me 401');

  // --- 2. empty body → 400
  r = await request(app).patch('/api/auth/me').set(auth(aToken)).send({});
  assert.equal(r.status, 400);
  assert.equal(r.body.message, 'Nothing to update');
  ok('empty body 400 Nothing to update');

  // --- 3. name change
  r = await request(app).patch('/api/auth/me').set(auth(aToken)).send({ uname: 'ProfAnne' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.user.uname, 'ProfAnne');
  assert.equal(r.body.user.ustatus, 'customer');
  assert.equal(r.body.user.passwordHash, undefined);
  ok('name edit 200 + no passwordHash leaked + role preserved');

  // --- 4. email change, then login with the new email
  const newEmailA = email('ProfA_new');
  r = await request(app).patch('/api/auth/me').set(auth(aToken)).send({ uemail: newEmailA });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.user.uemail, newEmailA.toLowerCase());
  r = await request(app).post('/api/auth/login').send({ logid: newEmailA, logpass: 'Test@1234' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  ok('email edit 200 + login with new email 200');

  // --- 5. mobile change, then login with the new mobile
  const newMobileA = mobile();
  r = await request(app).patch('/api/auth/me').set(auth(aToken)).send({ umobile: newMobileA });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.user.umobile, newMobileA);
  r = await request(app).post('/api/auth/login').send({ logid: newMobileA, logpass: 'Test@1234' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  ok('mobile edit 200 + login with new mobile 200');

  // --- 6. gender change
  r = await request(app).patch('/api/auth/me').set(auth(aToken)).send({ ugender: 'Other' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.user.ugender, 'Other');
  ok('gender edit 200');

  // --- 7. duplicate email (owned by user B) → 409
  r = await request(app)
    .patch('/api/auth/me')
    .set(auth(aToken))
    .send({ uemail: b.user.uemail });
  assert.equal(r.status, 409, JSON.stringify(r.body));
  assert.equal(r.body.message, 'The email/mobile has already been registered');
  ok('duplicate email 409');

  // --- 8. duplicate mobile (owned by user B) → 409
  r = await request(app).patch('/api/auth/me').set(auth(aToken)).send({ umobile: b.user.umobile });
  assert.equal(r.status, 409, JSON.stringify(r.body));
  ok('duplicate mobile 409');

  // --- 9. upass without curpass → 400 (validation, field curpass)
  r = await request(app).patch('/api/auth/me').set(auth(aToken)).send({ upass: 'Newpass@123' });
  assert.equal(r.status, 400, JSON.stringify(r.body));
  assert.equal(r.body.details?.[0]?.field, 'curpass');
  ok('upass without curpass 400 on curpass field');

  // --- 10. wrong current password → 401
  r = await request(app)
    .patch('/api/auth/me')
    .set(auth(aToken))
    .send({ upass: 'Newpass@123', curpass: 'Wrong@1234' });
  assert.equal(r.status, 401, JSON.stringify(r.body));
  assert.equal(r.body.message, 'Current password is incorrect');
  ok('wrong curpass 401');

  // --- 11. correct password change → 200; old login fails, new login works
  r = await request(app)
    .patch('/api/auth/me')
    .set(auth(aToken))
    .send({ upass: 'Newpass@123', curpass: 'Test@1234' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  r = await request(app)
    .post('/api/auth/login')
    .send({ logid: newEmailA, logpass: 'Test@1234' });
  assert.equal(r.status, 401);
  r = await request(app)
    .post('/api/auth/login')
    .send({ logid: newEmailA, logpass: 'Newpass@123' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  ok('password change 200, old login 401, new login 200');

  // --- 12. bad values → 400
  r = await request(app).patch('/api/auth/me').set(auth(aToken)).send({ uemail: 'not-an-email' });
  assert.equal(r.status, 400);
  r = await request(app).patch('/api/auth/me').set(auth(aToken)).send({ umobile: '123' });
  assert.equal(r.status, 400);
  r = await request(app).patch('/api/auth/me').set(auth(aToken)).send({ uname: 'John2@!' });
  assert.equal(r.status, 400);
  r = await request(app)
    .patch('/api/auth/me')
    .set(auth(aToken))
    .send({ upass: 'short', curpass: 'Newpass@123' });
  assert.equal(r.status, 400);
  ok('bad email/mobile/name/weak-password 400');

  // --- 13. access token still valid after edits (sub unchanged)
  r = await request(app).get('/api/auth/me').set(auth(aToken));
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.user._id, aId);
  ok('existing access token still valid after edits');

  console.log(`\nPASS: ${pass} assertions`);
} finally {
  await User.deleteMany({ _id: { $in: cleanup.userIds } });
  await disconnectDB();
  console.log('cleaned up');
}