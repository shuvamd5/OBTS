import Bus from '../models/Bus.js';
import BusSchedule from '../models/BusSchedule.js';
import Addroute from '../models/Addroute.js';
import Sales from '../models/Sales.js';
import Seat from '../models/Seat.js';
import Ticket from '../models/Ticket.js';
import { AppError, asyncHandler } from '../middleware/errorHandler.js';

export const listBuses = asyncHandler(async (req, res) => {
  const user = req.user;
  let filter;
  if (user.ustatus === 'admin') filter = {};
  else if (user.ustatus === 'operator') filter = { uid: user._id };
  else filter = { bstatus: 'active' };

  const buses = await Bus.find(filter)
    .populate('uid', 'uname')
    .sort({ bcd: 1 })
    .lean();
  res.json({
    buses: buses.map((b) => ({
      ...b,
      uid: b.uid?._id ?? null,
      ownerName: b.uid?.uname ?? null,
    })),
  });
});

export const createBus = asyncHandler(async (req, res) => {
  const { bcd0, bcd1, bcd2, bno, bname, btype, nseat, stype } = req.validated.body;

  const bcd = `${bcd0} ${bcd1} ${bcd2}`;

  const existing = await Bus.findOne({ bcd, bno });
  if (existing) {
    throw new AppError(409, 'A bus with this number plate already exists');
  }

  const bus = await Bus.create({
    bcd,
    bno,
    bname: bname.toUpperCase(),
    btype,
    nseat,
    stype: stype.toUpperCase(),
    bstatus: 'unchecked',
    bsapby: 'none',
    uid: req.user.ustatus === 'operator' ? req.user._id : null,
  });

  res.status(201).json({ bus });
});

export const updateStatus = asyncHandler(async (req, res) => {
  const { id } = req.validated.params;
  const { bstatus } = req.validated.body;

  const bus = await Bus.findById(id);
  if (!bus) {
    throw new AppError(404, 'Bus not found');
  }

  if (bus.bstatus === bstatus) {
    return res.json({ bus, message: 'No change' });
  }

  bus.bstatus = bstatus;
  bus.bsapby = req.user.uname;

  if (bstatus !== 'active') {
    const scheds = await BusSchedule.find({ bid: bus._id }).select('_id').lean();
    const sid = scheds.map((x) => x._id);
    await BusSchedule.updateMany(
      { bid: bus._id, bsstatus: { $ne: 'Expired' } },
      { $set: { bsstatus: 'unchecked' } }
    );
    await Addroute.updateMany(
      { bsid: { $in: sid }, arstatus: { $ne: 'Expired' } },
      { $set: { arstatus: 'unchecked' } }
    );
  }

  await bus.save();

  res.json({ bus, message: 'Status updated' });
});

export const deleteBus = asyncHandler(async (req, res) => {
  const { id } = req.validated.params;

  const bus = await Bus.findById(id);
  if (!bus) {
    throw new AppError(404, 'Bus not found');
  }

  if (req.user.ustatus === 'operator' && String(bus.uid) !== String(req.user._id)) {
    throw new AppError(403, 'Not your bus');
  }

  const scheds = await BusSchedule.find({ bid: bus._id }).select('_id').lean();
  const sid = scheds.map((x) => x._id);
  const ars = await Addroute.find({ bsid: { $in: sid } }).select('_id').lean();
  const arid = ars.map((x) => x._id);
  await Seat.deleteMany({ arid: { $in: arid } });
  await Ticket.deleteMany({ arid: { $in: arid } });
  await Addroute.deleteMany({ bsid: { $in: sid } });
  await Sales.deleteMany({ bsid: { $in: sid } });
  await BusSchedule.deleteMany({ bid: bus._id });
  await Bus.findByIdAndDelete(id);

  res.json({ message: 'Bus deleted', id });
});