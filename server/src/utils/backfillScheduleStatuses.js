import BusSchedule from '../models/BusSchedule.js';
import ScheduleRoute from '../models/ScheduleRoute.js';

// P0-2: legacy schedule/price statuses (Phase 4 era) must be remapped to the
// Module 5 enums so controllers never see values outside the new enum.
const SCHEDULE_SWITCH = {
  branches: [
    { case: { $eq: ['$bsstatus', 'not approved'] }, then: 'pending' },
    { case: { $eq: ['$bsstatus', 'pending'] }, then: 'pending' },
    { case: { $eq: ['$bsstatus', 'going'] }, then: 'approved' },
    { case: { $eq: ['$bsstatus', 'not going'] }, then: 'not_going' },
    { case: { $eq: ['$bsstatus', 'Expired'] }, then: 'expired' },
  ],
  default: '$bsstatus',
};

const ROUTE_SWITCH = {
  branches: [
    { case: { $eq: ['$arstatus', 'unchecked'] }, then: 'pending' },
    { case: { $eq: ['$arstatus', 'pending'] }, then: 'pending' },
    { case: { $eq: ['$arstatus', 'not ok'] }, then: 'rejected' },
    { case: { $eq: ['$arstatus', 'ok'] }, then: 'approved' },
    { case: { $eq: ['$arstatus', 'Expired'] }, then: 'expired' },
  ],
  default: '$arstatus',
};

export async function backfillScheduleStatuses() {
  const sched = await BusSchedule.updateMany(
    {},
    [{ $set: { bsstatus: { $switch: SCHEDULE_SWITCH } } }],
    { updatePipeline: true }
  );
  if (sched.modifiedCount > 0) {
    console.log(`[backfill] schedule statuses remapped on ${sched.modifiedCount} row(s)`);
  }

  const route = await ScheduleRoute.updateMany(
    {},
    [{ $set: { arstatus: { $switch: ROUTE_SWITCH } } }],
    { updatePipeline: true }
  );
  if (route.modifiedCount > 0) {
    console.log(`[backfill] price statuses remapped on ${route.modifiedCount} row(s)`);
  }

  return sched.modifiedCount + route.modifiedCount;
}