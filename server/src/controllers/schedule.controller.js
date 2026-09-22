import BusSchedule from '../models/BusSchedule.js';
import ScheduleRoute from '../models/ScheduleRoute.js';
import Sales from '../models/Sales.js';
import Bus from '../models/Bus.js';
import { issueScheduleNo } from '../utils/counter.js';
import { AppError, asyncHandler } from '../middleware/errorHandler.js';

const DAY = 86400000;
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export const listSchedules = asyncHandler(async (req, res) => {
  const user = req.user;
  let filter;
  if (user.ustatus === 'admin') {
    filter = { bsstatus: { $ne: 'expired' }, deletedAt: null };
  } else if (user.ustatus === 'operator') {
    const own = await Bus.find({ uid: user._id, deletedAt: null }).select('_id').lean();
    filter = { bsstatus: { $ne: 'expired' }, deletedAt: null, bid: { $in: own.map((b) => b._id) } };
  } else {
    filter = { bsstatus: 'approved', deletedAt: null };
  }
  const schedules = await BusSchedule.find(filter)
    .sort({ trdate: 1 })
    .populate({
      path: 'bid',
      select: 'plateNumber bname amenities bstatus bsapby busTypeId',
      populate: { path: 'busTypeId', select: 'name seatCount' },
    })
    .lean();

  // drop orphaned schedules whose bus no longer exists, and schedules whose bus
  // has been soft-deleted
  const liveSchedules = schedules.filter((s) => s.bid !== null && !s.bid.deletedAt);
  // customers only see schedules whose bus is active
  const visibleSchedules =
    user.ustatus === 'admin' || user.ustatus === 'operator'
      ? liveSchedules
      : liveSchedules.filter((s) => s.bid.bstatus === 'active');

  const ids = visibleSchedules.map((s) => s._id);
  const prices = await ScheduleRoute.find({ bsid: { $in: ids }, deletedAt: null })
    .populate('rid', 'sp fp')
    .lean();
  const priceMap = new Map(prices.map((p) => [String(p.bsid), p]));

  const out = visibleSchedules.map(({ bid, ...rest }) => {
    const { busTypeId, ...busRest } = bid;
    return {
      ...rest,
      bid: bid._id,
      bus: { ...busRest, busType: busTypeId ?? null },
      price: priceMap.get(String(rest._id)) ?? null,
    };
  });

  res.json({ schedules: out });
});

export const createSchedule = asyncHandler(async (req, res) => {
  const { bid, trdate, trtime } = req.validated.body;

  const bus = await Bus.findOne({ _id: bid, deletedAt: null });
  if (!bus) {
    throw new AppError(404, 'Bus not found');
  }
  if (req.user.ustatus === 'operator' && String(bus.uid) !== String(req.user._id)) {
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

  const existing = await BusSchedule.find({ bid, deletedAt: null }).select('trdate').lean();
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
    bsstatus: 'pending',
    bssapby: 'none',
    schedNo: await issueScheduleNo(),
  });

  res.status(201).json({ schedule });
});

export const updateStatus = asyncHandler(async (req, res) => {
  const { id } = req.validated.params;
  const { bsstatus } = req.validated.body;

  const schedule = await BusSchedule.findOne({ _id: id, deletedAt: null });
  if (!schedule) {
    throw new AppError(404, 'Schedule not found');
  }

  if (schedule.bsstatus === bsstatus) {
    return res.json({ schedule, message: 'No change' });
  }

  schedule.bsstatus = bsstatus;
  schedule.bssapby = req.user.uname;
  await schedule.save();

  if (bsstatus !== 'approved') {
    await ScheduleRoute.updateMany(
      { bsid: schedule._id, arstatus: { $ne: 'expired' }, deletedAt: null },
      { $set: { arstatus: 'pending' } }
    );
  } else {
    // The schedule status is the single approval switch: approving it also
    // approves the fare (price status is derived from the schedule status).
    await ScheduleRoute.updateMany(
      { bsid: schedule._id, arstatus: { $ne: 'expired' }, deletedAt: null },
      { $set: { arstatus: 'approved' } }
    );
    await Sales.findOneAndUpdate(
      { bsid: schedule._id },
      {
        $set: {
          trdate: schedule.trdate,
          trtime: schedule.trtime,
        },
        $setOnInsert: {
          bid: schedule.bid,
          sales: 0,
        },
      },
      { upsert: true, returnDocument: 'after' }
    );
  }

  res.json({ schedule, message: 'Status updated' });
});

export const deleteSchedule = asyncHandler(async (req, res) => {
  const { id } = req.validated.params;

  const schedule = await BusSchedule.findOne({ _id: id, deletedAt: null });
  if (!schedule) {
    throw new AppError(404, 'Schedule not found');
  }

  if (req.user.ustatus === 'operator') {
    const busOwner = await Bus.findOne({ _id: schedule.bid, deletedAt: null })
      .select('uid')
      .lean();
    if (!busOwner || String(busOwner.uid) !== String(req.user._id)) {
      throw new AppError(403, 'Not your bus');
    }
  }

  // Soft delete: dependents (ScheduleRoute / Seats / Tickets / Sales) are kept,
  // excluded from every query via deletedAt: null filters.
  schedule.deletedAt = new Date();
  await schedule.save();

  res.json({ message: 'Schedule deleted', id });
});

export const updateSchedule = asyncHandler(async (req, res) => {
  const { id } = req.validated.params;

  const schedule = await BusSchedule.findOne({ _id: id, deletedAt: null });
  if (!schedule) {
    throw new AppError(404, 'Schedule not found');
  }

  if (req.user.ustatus === 'operator') {
    const busOwner = await Bus.findOne({ _id: schedule.bid, deletedAt: null })
      .select('uid')
      .lean();
    if (!busOwner || String(busOwner.uid) !== String(req.user._id)) {
      throw new AppError(403, 'Not your bus');
    }
  }

  const { trdate, trtime } = req.validated.body;
  const changes = {};

  if (trdate !== undefined) {
    const t0 = startOfDay(new Date(`${trdate}T00:00:00`));
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

      const existing = await BusSchedule.find({
        bid: schedule.bid,
        _id: { $ne: schedule._id },
        deletedAt: null,
      })
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

  if (trtime !== undefined && trtime !== schedule.trtime) {
    changes.trtime = trtime;
  }

  if (Object.keys(changes).length === 0) {
    return res.json({ schedule, message: 'No change' });
  }

  Object.assign(schedule, changes);
  schedule.bsstatus = 'pending';
  schedule.bssapby = 'none';
  await schedule.save();

  await ScheduleRoute.updateMany(
    { bsid: schedule._id, arstatus: { $ne: 'expired' }, deletedAt: null },
    { $set: { arstatus: 'pending' } }
  );

  res.json({ schedule, message: 'Schedule updated' });
});