import bcrypt from 'bcryptjs';
import { connectDB, disconnectDB } from '../config/db.js';
import Location from '../models/Location.js';
import User from '../models/User.js';
import { LOCATIONS } from './locations.js'

const DEFAULT_USERS = [
  {
    uname: 'SuperAdmin',
    uemail: 'admin@eyatra.dev',
    umobile: '9800000000',
    upass: 'eYatraAdmin@1234',
    ugender: 'Other',
    ustatus: 'admin',
  },
  {
    uname: 'SampleOperator',
    uemail: 'operator@eyatra.dev',
    umobile: '9800000001',
    upass: 'eYatraOperator@1234',
    ugender: 'Other',
    ustatus: 'operator',
  },
  {
    uname: 'SampleCustomer',
    uemail: 'customer@eyatra.dev',
    umobile: '9800000002',
    upass: 'eYatraCustomer@1234',
    ugender: 'Other',
    ustatus: 'customer',
  },
];

async function seedLocations() {
  const sorted = [...LOCATIONS].sort((a, b) => a.localeCompare(b));
  let created = 0;
  for (const name of sorted) {
    const doc = await Location.findOneAndUpdate(
      { name },
      { name },
      { upsert: true, returnDocument: 'after' }
    );
    if (doc) created++;
  }
  const total = await Location.countDocuments();
  console.log(`[seed] locations upserted=${created} total=${total}`);
}

async function seedUsers() {
  let created = 0;
  for (const u of DEFAULT_USERS) {
    const existing = await User.findOne({
      $or: [{ uemail: u.uemail }, { umobile: u.umobile }],
    });
    if (existing) {
      console.log(`[seed] user exists: ${u.uemail} (${existing.ustatus})`);
      continue;
    }
    const passwordHash = await bcrypt.hash(u.upass, 10);
    const now = new Date();
    await User.create({
      uname: u.uname,
      uemail: u.uemail,
      umobile: u.umobile,
      ugender: u.ugender,
      ustatus: u.ustatus,
      passwordHash,
      udate: now,
      utime: now.toTimeString().slice(0, 8),
      totaltc: 0,
      reservedtc: 0,
      pendingtc: 0,
      payment: 0,
      due: 0,
      points: 0,
    });
    created++;
  }
  const total = await User.countDocuments();
  console.log(`[seed] users created=${created} total=${total}`);
}

async function main() {
  await connectDB();
  await seedLocations();
  await seedUsers();
  await disconnectDB();
  console.log('[seed] done');
}

main().catch(async (err) => {
  console.error('[seed] failed:', err);
  await disconnectDB();
  process.exit(1);
});