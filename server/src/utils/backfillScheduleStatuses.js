import BusSchedule from '../models/BusSchedule.js';
import ScheduleRoute from '../models/ScheduleRoute.js';

// P0-2: legacy schedule/price statuses (Phase 4 era) must be remapped to the
// Module 5 enums so controllers never see values outside the new enum.
const SCHEDULE_SWITCH = {
  branches: [
    { case: 'not approved', then: 'pending' },
    { case: 'pending', then: 'pending' },
    { case: 'going', then: 'approved' },
    { case: 'not going', then: 'not_going' },
    { case: 'Expired', then: 'expired' },
  ],
  default: '$bsstatus',
};

const ROUTE_SWITCH = {
  branches: [
    { case: 'unchecked', then: 'pending' },
    { case: 'pending', then: 'pending' },
    { case: 'not ok', then: 'rejected' },
    { case: 'ok', then: 'approved' },
    { case: 'Expired', then: 'expired' },
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