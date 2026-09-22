import Bus from '../models/Bus.js';
import ScheduleRoute from '../models/ScheduleRoute.js';
import BusSchedule from '../models/BusSchedule.js';
import Ticket from '../models/Ticket.js';

// Converts the legacy full-unique indexes into partial unique indexes scoped to
// live documents ({ deletedAt: null }). This lets a soft-deleted price/plate be
// re-assigned or re-created. Idempotent — safe to run on every connect.
const ensurePartialUniqueIndex = async (collection, field) => {
  const name = `${field}_1`;
  const indexes = await collection.indexes();
  const existing = indexes.find((i) => i.name === name);
  const hasPartial =
    existing &&
    JSON.stringify(existing.partialFilterExpression ?? null) === '{"deletedAt":null}';

  if (existing && !hasPartial) {
    await collection.dropIndex(name);
  } else if (existing) {
    return;
  }

  await collection.createIndex(
    { [field]: 1 },
    { unique: true, partialFilterExpression: { deletedAt: null }, name }
  );
};

export async function backfillIndexes() {
  await ensurePartialUniqueIndex(Bus.collection, 'plateNumber');
  await ensurePartialUniqueIndex(ScheduleRoute.collection, 'bsid');
  await ensureOrdinaryIndex(BusSchedule.collection, 'schedNo', { unique: true, sparse: true });
  await ensureOrdinaryIndex(Ticket.collection, 'bookingId', { unique: false, sparse: true });
}

// Ensure a (non-partial) index exists on a collection. AutoIndex is off so boot
// must create them; idempotent.
const ensureOrdinaryIndex = async (collection, field, opts = {}) => {
  const name = `${field}_1`;
  const indexes = await collection.indexes();
  if (indexes.some((i) => i.name === name)) return;
  await collection.createIndex({ [field]: 1 }, { name, ...opts });
};