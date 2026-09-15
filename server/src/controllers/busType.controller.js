import BusType from '../models/BusType.js';
import Bus from '../models/Bus.js';
import { AppError, asyncHandler } from '../middleware/errorHandler.js';

export const listBusTypes = asyncHandler(async (req, res) => {
  const busTypes = await BusType.find({ deletedAt: null }).sort({ seatCount: 1 }).lean();

  const countRows = await Bus.aggregate([
    { $match: { busTypeId: { $in: busTypes.map((t) => t._id) }, deletedAt: null } },
    { $group: { _id: '$busTypeId', count: { $sum: 1 } } },
  ]);
  const countMap = new Map(countRows.map((r) => [String(r._id), r.count]));

  res.json({
    busTypes: busTypes.map((t) => ({ ...t, busCount: countMap.get(String(t._id)) ?? 0 })),
  });
});

export const createBusType = asyncHandler(async (req, res) => {
  const { name, seatCount, seatStyle } = req.validated.body;

  const existing = await BusType.findOne({ name });
  if (existing) throw new AppError(409, 'A bus type with this name already exists');

  const busType = await BusType.create({ name, seatCount, seatStyle });
  res.status(201).json({ busType });
});

export const updateBusType = asyncHandler(async (req, res) => {
  const { id } = req.validated.params;
  const body = req.validated.body;

  const busType = await BusType.findOne({ _id: id, deletedAt: null });
  if (!busType) throw new AppError(404, 'Bus type not found');

  const referenced = await Bus.countDocuments({ busTypeId: id, deletedAt: null });
  if (referenced > 0) throw new AppError(409, 'This bus type is in use by a bus');

  if (body.name && body.name !== busType.name) {
    const dup = await BusType.findOne({ name: body.name, _id: { $ne: id } });
    if (dup) throw new AppError(409, 'A bus type with this name already exists');
  }

  Object.assign(busType, body);
  await busType.save();
  res.json({ busType, message: 'Bus type updated' });
});

export const deleteBusType = asyncHandler(async (req, res) => {
  const { id } = req.validated.params;

  const busType = await BusType.findOne({ _id: id, deletedAt: null });
  if (!busType) throw new AppError(404, 'Bus type not found');

  const referenced = await Bus.countDocuments({ busTypeId: id, deletedAt: null });
  if (referenced > 0) throw new AppError(409, 'This bus type is in use by a bus');

  busType.deletedAt = new Date();
  await busType.save();
  res.json({ message: 'Bus type deleted', id });
});