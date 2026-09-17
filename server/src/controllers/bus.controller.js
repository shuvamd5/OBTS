import Bus from '../models/Bus.js';
import BusType from '../models/BusType.js';
import BusSchedule from '../models/BusSchedule.js';
import ScheduleRoute from '../models/ScheduleRoute.js';
import User from '../models/User.js';
import { AppError, asyncHandler } from '../middleware/errorHandler.js';

const BUS_TYPE_SELECT = 'name seatCount seatStyle';

const toOut = (bus) => {
  const { busTypeId, uid, ...rest } = bus;
  return {
    ...rest,
    busTypeId: busTypeId?._id ?? null,
    busType: busTypeId ?? null,
    uid: uid?._id ?? null,
    ownerName: uid?.uname ?? null,
  };
};

const assertTypeExists = async (busTypeId) => {
  const bt = await BusType.findOne({ _id: busTypeId, deletedAt: null }).select('_id').lean();
  if (!bt) throw new AppError(404, 'Bus type not found');
};

export const listBuses = asyncHandler(async (req, res) => {
  const user = req.user;
  const filter = { deletedAt: null };
  if (user.ustatus === 'operator') filter.uid = user._id;
  else if (user.ustatus !== 'admin') filter.bstatus = 'active';

  const buses = await Bus.find(filter)
    .sort({ plateNumber: 1 })
    .populate('busTypeId', BUS_TYPE_SELECT)
    .populate('uid', 'uname')
    .lean();
  res.json({ buses: buses.map(toOut) });
});

export const createBus = asyncHandler(async (req, res) => {
  const { plateNumber, busTypeId, bname, amenities, rating } = req.validated.body;

  await assertTypeExists(busTypeId);

  const existing = await Bus.findOne({ plateNumber, deletedAt: null });
  if (existing) throw new AppError(409, 'A bus with this plate number already exists');

  const created = await Bus.create({
    plateNumber,
    busTypeId,
    bname,
    amenities,
    rating,
    bsapby: 'none',
    uid: req.user.ustatus === 'operator' ? req.user._id : null,
  });

  const bus = await Bus.findById(created._id)
    .populate('busTypeId', BUS_TYPE_SELECT)
    .populate('uid', 'uname')
    .lean();
  res.status(201).json({ bus: toOut(bus) });
});

export const getBus = asyncHandler(async (req, res) => {
  const { id } = req.validated.params;

  const bus = await Bus.findOne({ _id: id, deletedAt: null })
    .populate('busTypeId', BUS_TYPE_SELECT)
    .populate('uid', 'uname')
    .lean();
  if (!bus) throw new AppError(404, 'Bus not found');
  res.json({ bus: toOut(bus) });
});

export const updateBus = asyncHandler(async (req, res) => {
  const { id } = req.validated.params;
  const body = req.validated.body;

  const bus = await Bus.findOne({ _id: id, deletedAt: null });
  if (!bus) throw new AppError(404, 'Bus not found');
  if (req.user.ustatus === 'operator' && String(bus.uid) !== String(req.user._id)) {
    throw new AppError(403, 'Not your bus');
  }

  if (body.busTypeId && String(body.busTypeId) !== String(bus.busTypeId)) {
    await assertTypeExists(body.busTypeId);
  }
  if (body.plateNumber && String(body.plateNumber) !== bus.plateNumber) {
    const dup = await Bus.findOne({ plateNumber: body.plateNumber, _id: { $ne: id }, deletedAt: null });
    if (dup) throw new AppError(409, 'A bus with this plate number already exists');
  }

  const infoFields = ['plateNumber', 'busTypeId', 'bname', 'amenities', 'rating'];
  const infoChanged = infoFields.some((k) => {
    const v = body[k];
    if (v === undefined) return false;
    if (k === 'busTypeId') return String(bus[k] ?? '') !== String(v);
    if (Array.isArray(v)) {
      const cur = bus[k] ?? [];
      return v.length !== cur.length || v.some((x, i) => x !== cur[i]);
    }
    return v !== bus[k];
  });

  Object.assign(bus, body);
  if (infoChanged) {
    bus.bstatus = 'pending';
    bus.bsapby = 'none';
  }
  await bus.save();

  const out = await Bus.findById(id)
    .populate('busTypeId', BUS_TYPE_SELECT)
    .populate('uid', 'uname')
    .lean();
  res.json({ bus: toOut(out), message: 'Bus updated' });
});

export const reassignOperator = asyncHandler(async (req, res) => {
  const { id } = req.validated.params;
  const { uid } = req.validated.body;

  if (uid === undefined) throw new AppError(400, 'Owner is required');
  if (uid !== null) {
    const owner = await User.findById(uid).select('ustatus').lean();
    if (!owner) throw new AppError(400, 'Owner not found');
    if (owner.ustatus !== 'operator') throw new AppError(400, 'Owner must be an operator');
  }

  const bus = await Bus.findOne({ _id: id, deletedAt: null });
  if (!bus) throw new AppError(404, 'Bus not found');

  bus.uid = uid;
  await bus.save();

  const out = await Bus.findById(id)
    .populate('busTypeId', BUS_TYPE_SELECT)
    .populate('uid', 'uname')
    .lean();
  res.json({ bus: toOut(out), message: 'Operator reassigned' });
});

export const updateStatus = asyncHandler(async (req, res) => {
  const { id } = req.validated.params;
  const { bstatus } = req.validated.body;

  const bus = await Bus.findOne({ _id: id, deletedAt: null });
  if (!bus) throw new AppError(404, 'Bus not found');

  if (bus.bstatus === bstatus) return res.json({ bus, message: 'No change' });

  bus.bstatus = bstatus;
  bus.bsapby = req.user.uname;

  if (bstatus !== 'active') {
    const scheds = await BusSchedule.find({ bid: bus._id }).select('_id').lean();
    const sid = scheds.map((x) => x._id);
    await BusSchedule.updateMany(
      { bid: bus._id, bsstatus: { $ne: 'expired' }, deletedAt: null },
      { $set: { bsstatus: 'pending' } }
    );
    await ScheduleRoute.updateMany(
      { bsid: { $in: sid }, arstatus: { $ne: 'expired' }, deletedAt: null },
      { $set: { arstatus: 'pending' } }
    );
  }

  await bus.save();
  res.json({ bus, message: 'Status updated' });
});

export const deleteBus = asyncHandler(async (req, res) => {
  const { id } = req.validated.params;

  const bus = await Bus.findOne({ _id: id, deletedAt: null });
  if (!bus) throw new AppError(404, 'Bus not found');
  if (req.user.ustatus === 'operator' && String(bus.uid) !== String(req.user._id)) {
    throw new AppError(403, 'Not your bus');
  }

  bus.deletedAt = new Date();
  await bus.save();

  res.json({ message: 'Bus deleted', id });
});