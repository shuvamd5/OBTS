import Bus from '../models/Bus.js';
import BusSchedule from '../models/BusSchedule.js';
import ScheduleRoute from '../models/ScheduleRoute.js';
import Ticket from '../models/Ticket.js';
import { asyncHandler } from '../middleware/errorHandler.js';

export const getStats = asyncHandler(async (req, res) => {
  const user = req.user;
  const isStaff = user.ustatus === 'admin' || user.ustatus === 'operator';

  let ownBusIds = null;
  let ownBusFilter = {};
  if (user.ustatus === 'operator') {
    const own = await Bus.find({ uid: user._id, deletedAt: null }).select('_id').lean();
    ownBusIds = own.map((b) => b._id);
    ownBusFilter = { _id: { $in: ownBusIds } };
  }

  // Pending tickets badge: admin counts all, manager counts tickets on own buses,
  // users count their own.
  let pendingFilter;
  if (user.ustatus === 'admin') {
    pendingFilter = { tstatus: 'P' };
  } else if (user.ustatus === 'operator') {
    const ownScheds = await BusSchedule.find({ bid: { $in: ownBusIds } }).select('_id').lean();
    const ownArs = await ScheduleRoute.find({
      bsid: { $in: ownScheds.map((s) => s._id) },
      deletedAt: null,
    })
      .select('_id')
      .lean();
    pendingFilter = { tstatus: 'P', arid: { $in: ownArs.map((a) => a._id) } };
  } else {
    pendingFilter = { tstatus: 'P', uid: user._id };
  }
  const ticketsPending = await Ticket.countDocuments(pendingFilter);

  const buses =
    user.ustatus === 'admin'
      ? await Bus.countDocuments({ deletedAt: null, bstatus: { $ne: 'active' } })
      : user.ustatus === 'operator'
      ? await Bus.countDocuments({ ...ownBusFilter, deletedAt: null, bstatus: { $ne: 'active' } })
      : 0;

  const schedules = isStaff
    ? await BusSchedule.countDocuments({
        ...(user.ustatus === 'operator' ? { bid: { $in: ownBusIds } } : {}),
        bsstatus: { $nin: ['approved', 'expired'] },
        deletedAt: null,
      })
    : 0;

  let prices = 0;
  if (user.ustatus === 'admin') {
    const liveScheds = await BusSchedule.find({
      bsstatus: { $ne: 'expired' },
      deletedAt: null,
    })
      .select('_id')
      .lean();
    prices = await ScheduleRoute.countDocuments({
      bsid: { $in: liveScheds.map((s) => s._id) },
      arstatus: { $nin: ['approved', 'expired'] },
      deletedAt: null,
    });
  } else if (user.ustatus === 'operator') {
    const ownScheds = await BusSchedule.find({
      bid: { $in: ownBusIds },
      bsstatus: { $ne: 'expired' },
      deletedAt: null,
    })
      .select('_id')
      .lean();
    prices = await ScheduleRoute.countDocuments({
      bsid: { $in: ownScheds.map((s) => s._id) },
      arstatus: { $nin: ['approved', 'expired'] },
      deletedAt: null,
    });
  }

  const total = ticketsPending + buses + schedules + prices;

  res.json({ tickets: { pending: ticketsPending }, buses, schedules, prices, total });
});