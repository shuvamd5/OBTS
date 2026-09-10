process.env.NODE_ENV = 'test';

import request from 'supertest';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { app } from '../src/index.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import User from '../src/models/User.js';

const uniq = Date.now().toString(36);
const cleanup = { userIds: [] };
const mobile = () => `983${String(Date.now() % 10000000).padStart(7, '0')}`;
const email = (tag) => `${tag}_${uniq}@test.com`;

let pass = 0;
const ok = (name) => {
  pass += 1;
  console.log(`  ok - ${name}`);
};

const hash = (raw) => crypto.createHash('sha256').update(raw).digest('hex');

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

  const a = await register('ResetA');
  const aId = a.user._id;
  const origEmail = a.user.uemail;

  // --- 1. forgot-password unknown email -> 404
  let r = await request(app)
    .post('/api/auth/forgot-password')
    .send({ uemail: `nobody_${uniq}@test.com` });
  assert.equal(r.status, 404);
  assert.equal(r.body.message, 'No account found with that email');
  ok('forgot-password unknown email 404');

  // --- 2. bad email format -> 400
  r = await request(app).post('/api/auth/forgot-password').send({ uemail: 'not-an-email' });
  assert.equal(r.status, 400);
  ok('forgot-password bad email 400');

  // --- 3. valid email -> 200, hashed token + future expiry persisted
  r = await request(app).post('/api/auth/forgot-password').send({ uemail: origEmail });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.message, 'If the email exists, a reset link has been sent');
  let user = await User.findById(aId).select('+resetToken');
  assert.ok(user.resetToken, 'reset token should be persisted');
  assert.ok(user.resetTokenExpiry > new Date());
  ok('forgot-password 200 + hashed token persisted with future expiry');

  // --- 4. resetToken never leaked in user JSON
  r = await request(app).post('/api/auth/login').send({ logid: origEmail, logpass: 'Test@1234' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.user.resetToken, undefined);
  ok('resetToken not leaked in user JSON');

  // --- 5. invalid token -> 400
  r = await request(app)
    .post('/api/auth/reset-password/not-a-real-token')
    .send({ upass: 'Newpass@123' });
  assert.equal(r.status, 400);
  assert.equal(r.body.message, 'Reset link is invalid or has expired');
  ok('reset-password invalid token 400');

  // --- 6. expired token -> 400
  await User.updateOne(
    { _id: aId },
    { resetToken: hash('expiredtoken123'), resetTokenExpiry: Date.now() - 1000 }
  );
  r = await request(app)
    .post('/api/auth/reset-password/expiredtoken123')
    .send({ upass: 'Newpass@123' });
  assert.equal(r.status, 400);
  ok('reset-password expired token 400');

  // --- 7. weak password -> 400 (validation)
  await User.updateOne(
    { _id: aId },
    { resetToken: hash('goodtoken123'), resetTokenExpiry: Date.now() + 3600000 }
  );
  r = await request(app).post('/api/auth/reset-password/goodtoken123').send({ upass: 'short' });
  assert.equal(r.status, 400);
  ok('reset-password weak password 400');

  // --- 8. valid token + valid password -> 200; old pass 401 / new pass 200; token cleared
  const rawToken = 'validreset123';
  await User.updateOne(
    { _id: aId },
    { resetToken: hash(rawToken), resetTokenExpiry: Date.now() + 3600000 }
  );
  r = await request(app)
    .post(`/api/auth/reset-password/${rawToken}`)
    .send({ upass: 'Newpass@123' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  user = await User.findById(aId).select('+resetToken');
  assert.equal(user.resetToken, null);
  assert.equal(user.resetTokenExpiry, null);
  r = await request(app).post('/api/auth/login').send({ logid: origEmail, logpass: 'Test@1234' });
  assert.equal(r.status, 401);
  r = await request(app).post('/api/auth/login').send({ logid: origEmail, logpass: 'Newpass@123' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  ok('reset-password 200 + token cleared + old pass 401 + new pass 200');

  // --- 9. token reuse -> 400 (invalidated after use)
  r = await request(app)
    .post(`/api/auth/reset-password/${rawToken}`)
    .send({ upass: 'Another@123' });
  assert.equal(r.status, 400);
  ok('reset-password token reuse 400');

  console.log(`\nPASS: ${pass} assertions`);
} finally {
  await User.deleteMany({ _id: { $in: cleanup.userIds } });
  await disconnectDB();
  console.log('cleaned up');
}