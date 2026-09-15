import Route from '../models/Route.js';

// P0-2: legacy routes predating distance/duration must never expose undefined
// to the client or fail a mongoose save() validation.
export async function backfillRouteFields() {
  const res = await Route.updateMany(
    { distance: { $exists: false } },
    { $set: { distance: 0, duration: 'TBD' } }
  );
  if (res.modifiedCount > 0) {
    console.log(`[backfill] distance/duration set on ${res.modifiedCount} legacy route(s)`);
  }
  return res.modifiedCount;
}