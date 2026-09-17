import ScheduleRoute from '../models/ScheduleRoute.js';
import BusSchedule from '../models/BusSchedule.js';
import Route from '../models/Route.js';
import Bus from '../models/Bus.js';
import { AppError, asyncHandler } from '../middleware/errorHandler.js';

const maxCheckpointFare = (route) =>
  (route.checkpoints ?? []).reduce((max, c) => Math.max(max, c?.price ?? 0), 0);

const assertPriceCoversRoute = (route, price) => {
  const min = maxCheckpointFare(route);
  if (!(price > min)) {
    throw new AppError(
      400,
      `Fare must be greater than the highest checkpoint fare inside this route (NRs. ${min})`
    );
  }
};

const assertOwnsScheduleBus = async (user, bsid) => {
  if (user.ustatus !== 'operator') return;
  const schedule = await BusSchedule.findById(bsid).select('bid').lean();
  if (!schedule) throw new AppError(404, 'Schedule not found');
  const bus = await Bus.findById(schedule.bid).select('uid').lean();
  if (!bus || String(bus.uid) !== String(user._id)) {
    throw new AppError(403, 'Not your bus');
  }
};

export const listPrices = asyncHandler(async (req, res) => {
  const user = req.user;
  const isStaff = user.ustatus === 'admin' || user.ustatus === 'operator';

  let schedules = await BusSchedule.find({
    bsstatus: { $ne: 'expired' },
    deletedAt: null,
  })
    .sort({ trdate: 1 })
    .select('_id bid trdate trtime bsstatus bssapby')
    .lean();
  if (user.ustatus === 'operator') {
    const own = await Bus.find({ uid: user._id, deletedAt: null }).select('_id').lean();
    const ownIds = own.map((b) => b._id);
    schedules = schedules.filter((s) => ownIds.some((id) => String(id) === String(s.bid)));
  }
  const scheduleIds = schedules.map((s) => s._id);
  const schedMap = new Map(schedules.map((s) => [String(s._id), s]));

  const busIds = [...new Set(schedules.map((s) => String(s.bid)))];
  const buses = await Bus.find({ _id: { $in: busIds }, deletedAt: null })
    .select('plateNumber bname bstatus amenities busTypeId')
    .populate('busTypeId', 'name seatCount')
    .lean();
  const busMap = new Map(buses.map((b) => [String(b._id), b]));

  let query = ScheduleRoute.find({ bsid: { $in: scheduleIds }, deletedAt: null }).populate(
    'rid',
    'sp fp'
  );
  if (!isStaff) {
    query = query.where('arstatus').equals('approved');
  }
  const prices = await query.lean();

  const out = prices.map((p) => {
    const sched = schedMap.get(String(p.bsid)) ?? null;
    const rawBus = busMap.get(String(sched?.bid));
    if (!rawBus) return { ...p, schedule: sched, bus: null };
    const { busTypeId, ...busRest } = rawBus;
    return { ...p, schedule: sched, bus: { ...busRest, busType: busTypeId ?? null } };
  });

  res.json({ prices: out });
});

export const assignPrice = asyncHandler(async (req, res) => {
  const { bsid, rid, price } = req.validated.body;

  const schedule = await BusSchedule.findById(bsid);
  if (!schedule) {
    throw new AppError(404, 'Schedule not found');
  }
  const route = await Route.findById(rid);
  if (!route) {
    throw new AppError(404, 'Route not found');
  }
  assertPriceCoversRoute(route, price);

  await assertOwnsScheduleBus(req.user, bsid);

  const existing = await ScheduleRoute.findOne({ bsid, deletedAt: null });
  if (existing) {
    throw new AppError(409, 'Route and price are already registered for this schedule');
  }

  const scheduleRoute = await ScheduleRoute.create({
    bsid,
    rid,
    price,
    arstatus: schedule.bsstatus === 'approved' ? 'approved' : 'pending',
  });
  res.status(201).json({ scheduleRoute });
});

export const updateStatus = asyncHandler(async (req, res) => {
  const { id } = req.validated.params;
  const { arstatus } = req.validated.body;

  const scheduleRoute = await ScheduleRoute.findOne({ _id: id, deletedAt: null });
  if (!scheduleRoute) {
    throw new AppError(404, 'Price entry not found');
  }
  await assertOwnsScheduleBus(req.user, scheduleRoute.bsid);

  if (scheduleRoute.arstatus === arstatus) {
    return res.json({ scheduleRoute, message: 'No change' });
  }

  scheduleRoute.arstatus = arstatus;
  await scheduleRoute.save();

  res.json({ scheduleRoute, message: 'Status updated' });
});

export const updateRoute = asyncHandler(async (req, res) => {
  const { id } = req.validated.params;
  const { rid } = req.validated.body;

  const scheduleRoute = await ScheduleRoute.findOne({ _id: id, deletedAt: null });
  if (!scheduleRoute) {
    throw new AppError(404, 'Price entry not found');
  }
  await assertOwnsScheduleBus(req.user, scheduleRoute.bsid);

  const route = await Route.findById(rid);
  if (!route) {
    throw new AppError(404, 'Route not found');
  }

  if (String(scheduleRoute.rid) === rid) {
    return res.json({ scheduleRoute, message: 'No change' });
  }
  assertPriceCoversRoute(route, scheduleRoute.price);

  const schedule = await BusSchedule.findById(scheduleRoute.bsid).select('bsstatus').lean();
  scheduleRoute.rid = rid;
  scheduleRoute.arstatus = schedule?.bsstatus === 'approved' ? 'approved' : 'pending';
  await scheduleRoute.save();

  res.json({ scheduleRoute, message: 'Route updated' });
});

export const updatePrice = asyncHandler(async (req, res) => {
  const { id } = req.validated.params;
  const { price } = req.validated.body;

  const scheduleRoute = await ScheduleRoute.findOne({ _id: id, deletedAt: null });
  if (!scheduleRoute) {
    throw new AppError(404, 'Price entry not found');
  }
  await assertOwnsScheduleBus(req.user, scheduleRoute.bsid);

  if (scheduleRoute.price === price) {
    return res.json({ scheduleRoute, message: 'No change' });
  }
  const route = await Route.findById(scheduleRoute.rid);
  if (!route) {
    throw new AppError(404, 'Route not found');
  }
  assertPriceCoversRoute(route, price);

  const schedule = await BusSchedule.findById(scheduleRoute.bsid).select('bsstatus').lean();
  scheduleRoute.price = price;
  scheduleRoute.arstatus = schedule?.bsstatus === 'approved' ? 'approved' : 'pending';
  await scheduleRoute.save();

  res.json({ scheduleRoute, message: 'Price updated' });
});

export const deleteScheduleRoute = asyncHandler(async (req, res) => {
  const { id } = req.validated.params;

  const scheduleRoute = await ScheduleRoute.findOne({ _id: id, deletedAt: null });
  if (!scheduleRoute) {
    throw new AppError(404, 'Price entry not found');
  }
  await assertOwnsScheduleBus(req.user, scheduleRoute.bsid);
  scheduleRoute.deletedAt = new Date();
  await scheduleRoute.save();

  res.json({ message: 'Price deleted', id });
});