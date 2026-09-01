import { connectDB, disconnectDB } from '../config/db.js';
import Location from '../models/Location.js';
import { LOCATIONS } from './locations.js'

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

async function main() {
  await connectDB();
  await seedLocations();
  await disconnectDB();
  console.log('[seed] done');
}

main().catch(async (err) => {
  console.error('[seed] failed:', err);
  await disconnectDB();
  process.exit(1);
});