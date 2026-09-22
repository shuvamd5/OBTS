import BusSchedule from '../models/BusSchedule.js';
import { issueScheduleNo } from './counter.js';

// Assign a sequential schedule number to any schedule created before schedNo
// existed. Idempotent: only touches documents missing the field, each gets one
// fresh number from the shared counter so uniqueness always holds.
export const backfillScheduleNos = async () => {
  const missing = await BusSchedule.find({ schedNo: { $exists: false } })
    .sort({ trdate: 1, _id: 1 })
    .select('_id')
    .lean();
  for (const s of missing) {
    const schedNo = await issueScheduleNo();
    await BusSchedule.updateOne({ _id: s._id }, { $set: { schedNo } });
  }
  return missing.length;
};