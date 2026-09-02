import BusSchedule from '../models/BusSchedule.js';
import Addroute from '../models/Addroute.js';
import Sales from '../models/Sales.js';
import Bus from '../models/Bus.js';
import { AppError, asyncHandler } from '../middleware/errorHandler.js';

const DAY = 86400000;
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export const listSchedules = asyncHandler(async (req, res) => {
  const user = req.user;
  let filter;
  if (user.ustatus === 'Admin') {
    filter = { bsstatus: { $ne: 'Expired' } };
  } else if (user.ustatus === 'Manager') {
    const own = await Bus.find({ uid: user._id }).select('_id').lean();
    filter = { bsstatus: { $ne: 'Expired' }, bid: { $in: own.map((b) => b._id) } };
  } else {
    filter = { bsstatus: 'going' };
  }
  const schedules = await BusSchedule.find(filter)
    .sort({ trdate: 1 })
    .populate('bid', 'bcd bno bname btype nseat bstatus bsapby')
    .lean();

  const ids = schedules.map((s) => s._id);
  const prices = await Addroute.find({ bsid: { $in: ids } })
    .populate('rid', 'sp fp')
    .lean();
  const priceMap = new Map(prices.map((p) => [String(p.bsid), p]));

  const out = schedules.map(({ bid, ...rest }) => ({
    ...rest,
    bid: bid._id,
    bus: bid,
    price: priceMap.get(String(rest._id)) ?? null,
  }));

  res.json({ schedules: out });
});

export const createSchedule = asyncHandler(async (req, res) => {
  const { bid, trdate, trtime } = req.body;

  const bus = await Bus.findById(bid);
  if (!bus) {
    throw new AppError(404, 'Bus not found');
  }
  if (req.user.ustatus === 'Manager' && String(bus.uid) !== String(req.user._id)) {
    throw new AppError(403, 'Not your bus');
  }

  const t0 = startOfDay(new Date(`${trdate}T00:00:00`));
  if (Number.isNaN(t0.getTime())) {
    throw new AppError(400, 'Invalid travelling date');
  }

  const today = startOfDay(new Date());
  const diff = Math.round((t0 - today) / DAY);
  if (diff < 4) {
    throw new AppError(400, 'There is less than 4 days difference in days');
  }

  const existing = await BusSchedule.find({ bid }).select('trdate').lean();
  for (const e of existing) {
    const e0 = startOfDay(e.trdate);
    if (e0.getTime() === t0.getTime()) {
      throw new AppError(409, 'Travelling date for the bus is already registered');
    }
    if (Math.abs(Math.round((t0 - e0) / DAY)) <= 2) {
      throw new AppError(400, 'difference between dates is less than 2 days');
    }
  }

  const schedule = await BusSchedule.create({
    bid,
    trdate: t0,
    trtime,
    bsstatus: 'not approved',
    bssapby: 'none',
  });

  res.status(201).json({ schedule });
});

export const updateStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { bsstatus } = req.body;

  const schedule = await BusSchedule.findById(id);
  if (!schedule) {
    throw new AppError(404, 'Schedule not found');
  }

  if (schedule.bsstatus === bsstatus) {
    return res.json({ schedule, message: 'No change' });
  }

  schedule.bsstatus = bsstatus;
  schedule.bssapby = req.user.uname;
  await schedule.save();

  if (bsstatus !== 'going') {
    await Addroute.updateMany(
      { bsid: schedule._id, arstatus: { $ne: 'Expired' } },
      { $set: { arstatus: 'unchecked' } }
    );
  } else {
    await Sales.findOneAndUpdate(
      { bsid: schedule._id },
      {
        $setOnInsert: {
          bid: schedule.bid,
          trdate: schedule.trdate,
          trtime: schedule.trtime,
          sales: 0,
        },
      },
      { upsert: true, returnDocument: 'after' }
    );
  }

  res.json({ schedule, message: 'Status updated' });
});

export const deleteSchedule = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const schedule = await BusSchedule.findById(id);
  if (!schedule) {
    throw new AppError(404, 'Schedule not found');
  }

  if (req.user.ustatus === 'Manager') {
    const busOwner = await Bus.findById(schedule.bid).select('uid').lean();
    if (!busOwner || String(busOwner.uid) !== String(req.user._id)) {
      throw new AppError(403, 'Not your bus');
    }
  }

  // obts deletes ticket/seat rows by arid first, then addroute + sales.
  const price = await Addroute.findOne({ bsid: schedule._id }).select('_id').lean();
  if (price) {
    
  }
  await Addroute.deleteMany({ bsid: schedule._id });
  await Sales.deleteMany({ bsid: schedule._id });
  await BusSchedule.findByIdAndDelete(id);

  res.json({ message: 'Schedule deleted', id });
});

export const updateSchedule = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const schedule = await BusSchedule.findById(id);
  if (!schedule) {
    throw new AppError(404, 'Schedule not found');
  }

  if (req.user.ustatus === 'Manager') {
    const busOwner = await Bus.findById(schedule.bid).select('uid').lean();
    if (!busOwner || String(busOwner.uid) !== String(req.user._id)) {
      throw new AppError(403, 'Not your bus');
    }
  }

  const changes = {};

  if (req.body.trdate !== undefined && req.body.trdate !== undefined) {
    const newDate = req.body.trdate;
    const t0 = startOfDay(new Date(`${newDate}T00:00:00`));
    if (Number.isNaN(t0.getTime())) {
      throw new AppError(400, 'Invalid travelling date');
    }

    const currentDay = startOfDay(schedule.trdate);
    if (t0.getTime() !== currentDay.getTime()) {
      const today = startOfDay(new Date());
      const diff = Math.round((t0 - today) / DAY);
      if (diff < 4) {
        throw new AppError(400, 'There is less than 4 days difference in days');
      }

      const existing = await BusSchedule.find({ bid: schedule.bid, _id: { $ne: schedule._id } })
        .select('trdate')
        .lean();
      for (const e of existing) {
        const e0 = startOfDay(e.trdate);
        if (e0.getTime() === t0.getTime()) {
          throw new AppError(409, 'Travelling date for the bus is already registered');
        }
        if (Math.abs(Math.round((t0 - e0) / DAY)) <= 2) {
          throw new AppError(400, 'difference between dates is less than 2 days');
        }
      }

      changes.trdate = t0;
    }
  }

  if (req.body.trtime !== undefined && req.body.trtime !== schedule.trtime) {
    changes.trtime = req.body.trtime;
  }

  if (Object.keys(changes).length === 0) {
    return res.json({ schedule, message: 'No change' });
  }

  Object.assign(schedule, changes);
  await schedule.save();

  res.json({ schedule, message: 'Schedule updated' });
});