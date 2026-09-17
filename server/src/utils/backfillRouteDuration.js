import Route from '../models/Route.js';
import { parseDurationToMinutes } from './routeDuration.js';

// P0-2: routes created before durationMinutes existed must derive it from their
// free-text duration so the search offer can compute an arrival time. Idempotent.
export async function backfillRouteDuration() {
  const routes = await Route.find({ durationMinutes: { $exists: false } })
    .select('_id duration')
    .lean();

  let modified = 0;
  for (const r of routes) {
    const durationMinutes = parseDurationToMinutes(r.duration);
    await Route.updateOne({ _id: r._id }, { $set: { durationMinutes } });
    modified += 1;
  }
  if (modified > 0) {
    console.log(`[backfill] durationMinutes derived for ${modified} route(s)`);
  }
  return modified;
}