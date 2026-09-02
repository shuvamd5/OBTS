import Bus from '../models/Bus.js';
import BusSchedule from '../models/BusSchedule.js';
import Addroute from '../models/Addroute.js';
import { asyncHandler } from '../middleware/errorHandler.js';

export const getStats = asyncHandler(async (req, res) => {
  const user = req.user;
  const isStaff = user.ustatus === 'Admin' || user.ustatus === 'Manager';

  let ownBusIds = null;
  let ownBusFilter = {};
  if (user.ustatus === 'Manager') {
    const own = await Bus.find({ uid: user._id }).select('_id').lean();
    ownBusIds = own.map((b) => b._id);
    ownBusFilter = { _id: { $in: ownBusIds } };
  }

  const ticketsPending = 0; // Ticket module is not yet implemented; placeholder for future use.

  const buses =
    user.ustatus === 'Admin'
      ? await Bus.countDocuments({ bstatus: { $ne: 'active' } })
      : user.ustatus === 'Manager'
      ? await Bus.countDocuments({ ...ownBusFilter, bstatus: { $ne: 'active' } })
      : 0;

  const schedules = isStaff
    ? await BusSchedule.countDocuments({
        ...(user.ustatus === 'Manager' ? { bid: { $in: ownBusIds } } : {}),
        bsstatus: { $nin: ['going', 'Expired'] },
      })
    : 0;

  let prices = 0;
  if (user.ustatus === 'Admin') {
    prices = await Addroute.countDocuments({ arstatus: { $nin: ['ok', 'Expired'] } });
  } else if (user.ustatus === 'Manager') {
    const ownScheds = await BusSchedule.find({ bid: { $in: ownBusIds } }).select('_id').lean();
    prices = await Addroute.countDocuments({
      bsid: { $in: ownScheds.map((s) => s._id) },
      arstatus: { $nin: ['ok', 'Expired'] },
    });
  }

  const total = ticketsPending + buses + schedules + prices;

  res.json({ tickets: { pending: ticketsPending }, buses, schedules, prices, total });
});