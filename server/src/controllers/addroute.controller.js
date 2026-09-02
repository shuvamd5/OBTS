import Addroute from '../models/Addroute.js';
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

export const listPrices = asyncHandler(async (req, res) => {
  const user = req.user;
  const isStaff = user.ustatus === 'Admin' || user.ustatus === 'Manager';

  let schedules = await BusSchedule.find({ bsstatus: { $ne: 'Expired' } })
    .sort({ trdate: 1 })
    .select('_id bid trdate trtime bsstatus bssapby')
    .lean();
  if (user.ustatus === 'Manager') {
    const own = await Bus.find({ uid: user._id }).select('_id').lean();
    const ownIds = own.map((b) => b._id);
    schedules = schedules.filter((s) => ownIds.some((id) => String(id) === String(s.bid)));
  }
  const scheduleIds = schedules.map((s) => s._id);
  const schedMap = new Map(schedules.map((s) => [String(s._id), s]));

  const busIds = [...new Set(schedules.map((s) => String(s.bid)))];
  const buses = await Bus.find({ _id: { $in: busIds } })
    .select('bcd bno bname btype bstatus')
    .lean();
  const busMap = new Map(buses.map((b) => [String(b._id), b]));

  let query = Addroute.find({ bsid: { $in: scheduleIds } }).populate('rid', 'sp fp');
  if (!isStaff) {
    query = query.where('arstatus').equals('ok');
  }
  const prices = await query.lean();

  const out = prices.map((p) => ({
    ...p,
    schedule: schedMap.get(String(p.bsid)) ?? null,
    bus: busMap.get(String(schedMap.get(String(p.bsid))?.bid)) ?? null,
  }));

  res.json({ prices: out });
});

export const assignPrice = asyncHandler(async (req, res) => {
  const { bsid, rid, price } = req.body;

  const schedule = await BusSchedule.findById(bsid);
  if (!schedule) {
    throw new AppError(404, 'Schedule not found');
  }
  const route = await Route.findById(rid);
  if (!route) {
    throw new AppError(404, 'Route not found');
  }
  assertPriceCoversRoute(route, price);

  if (req.user.ustatus === 'Manager') {
    const bus = await Bus.findById(schedule.bid).select('uid').lean();
    if (!bus || String(bus.uid) !== String(req.user._id)) {
      throw new AppError(403, 'Not your bus');
    }
  }

  const existing = await Addroute.findOne({ bsid });
  if (existing) {
    throw new AppError(409, 'Route and price are already registered for this schedule');
  }

  const addroute = await Addroute.create({ bsid, rid, price, arstatus: 'unchecked' });
  res.status(201).json({ addroute });
});

export const updateStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { arstatus } = req.body;

  const addroute = await Addroute.findById(id);
  if (!addroute) {
    throw new AppError(404, 'Price entry not found');
  }

  if (addroute.arstatus === arstatus) {
    return res.json({ addroute, message: 'No change' });
  }

  addroute.arstatus = arstatus;
  await addroute.save();

  res.json({ addroute, message: 'Status updated' });
});

export const updateRoute = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { rid } = req.body;

  const addroute = await Addroute.findById(id);
  if (!addroute) {
    throw new AppError(404, 'Price entry not found');
  }
  if (req.user.ustatus === 'Manager') {
    const schedule = await BusSchedule.findById(addroute.bsid).select('bid').lean();
    const bus = await Bus.findById(schedule.bid).select('uid').lean();
    if (!bus || String(bus.uid) !== String(req.user._id)) {
      throw new AppError(403, 'Not your bus');
    }
  }
  const route = await Route.findById(rid);
  if (!route) {
    throw new AppError(404, 'Route not found');
  }

  if (String(addroute.rid) === rid) {
    return res.json({ addroute, message: 'No change' });
  }
  assertPriceCoversRoute(route, addroute.price);

  addroute.rid = rid;
  addroute.arstatus = 'unchecked';
  await addroute.save();

  res.json({ addroute, message: 'Route updated' });
});

export const updatePrice = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { price } = req.body;

  const addroute = await Addroute.findById(id);
  if (!addroute) {
    throw new AppError(404, 'Price entry not found');
  }
  if (req.user.ustatus === 'Manager') {
    const schedule = await BusSchedule.findById(addroute.bsid).select('bid').lean();
    const bus = await Bus.findById(schedule.bid).select('uid').lean();
    if (!bus || String(bus.uid) !== String(req.user._id)) {
      throw new AppError(403, 'Not your bus');
    }
  }

  if (addroute.price === price) {
    return res.json({ addroute, message: 'No change' });
  }
  const route = await Route.findById(addroute.rid);
  if (!route) {
    throw new AppError(404, 'Route not found');
  }
  assertPriceCoversRoute(route, price);

  addroute.price = price;
  addroute.arstatus = 'unchecked';
  await addroute.save();

  res.json({ addroute, message: 'Price updated' });
});

export const deleteAddroute = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const addroute = await Addroute.findById(id);
  if (!addroute) {
    throw new AppError(404, 'Price entry not found');
  }
  if (req.user.ustatus === 'Manager') {
    const schedule = await BusSchedule.findById(addroute.bsid).select('bid').lean();
    const bus = await Bus.findById(schedule.bid).select('uid').lean();
    if (!bus || String(bus.uid) !== String(req.user._id)) {
      throw new AppError(403, 'Not your bus');
    }
  }
  await Addroute.findByIdAndDelete(id);

  res.json({ message: 'Price deleted', id });
});