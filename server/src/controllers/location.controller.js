import Location from '../models/Location.js';
import Route from '../models/Route.js';
import { AppError, asyncHandler } from '../middleware/errorHandler.js';

async function usageCounts() {
  const rows = await Route.aggregate([
    { $project: { stops: { $concatArrays: [['$sp'], ['$fp'], '$checkpoints.route'] } } },
    { $unwind: '$stops' },
    { $group: { _id: '$stops', count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [r._id, r.count]));
}

async function isReferenced(name) {
  return (
    (await Route.countDocuments({
      $or: [{ sp: name }, { fp: name }, { 'checkpoints.route': name }],
    })) > 0
  );
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function findDuplicate(name, excludeId) {
  const query = { name: { $regex: `^${escapeRegex(name)}$`, $options: 'i' } };
  if (excludeId) query._id = { $ne: excludeId };
  return Location.findOne(query);
}

export const listLocations = asyncHandler(async (_req, res) => {
  const locations = await Location.find({}).sort({ name: 1 }).lean();
  const usage = await usageCounts();
  res.json({
    locations: locations.map((l) => ({ ...l, usageCount: usage.get(l.name) ?? 0 })),
  });
});

export const createLocation = asyncHandler(async (req, res) => {
  const { name } = req.validated.body;

  const dup = await findDuplicate(name);
  if (dup) {
    throw new AppError(409, 'This town already exists');
  }

  const location = await Location.create({ name });
  res.status(201).json({ location });
});

export const updateLocation = asyncHandler(async (req, res) => {
  const { id } = req.validated.params;
  const { name } = req.validated.body;

  const location = await Location.findById(id);
  if (!location) {
    throw new AppError(404, 'Town not found');
  }

  if (location.name === name) {
    return res.json({ location, message: 'No change' });
  }

  if (await isReferenced(location.name)) {
    throw new AppError(409, 'This town is used by routes — remove it from those routes first');
  }

  const dup = await findDuplicate(name, id);
  if (dup) {
    throw new AppError(409, 'This town already exists');
  }

  location.name = name;
  await location.save();
  res.json({ location, message: 'Town updated' });
});

export const deleteLocation = asyncHandler(async (req, res) => {
  const { id } = req.validated.params;

  const location = await Location.findById(id);
  if (!location) {
    throw new AppError(404, 'Town not found');
  }

  if (await isReferenced(location.name)) {
    throw new AppError(409, 'Cannot delete town — it is used by one or more routes');
  }

  await Location.findByIdAndDelete(id);
  res.json({ message: 'Town deleted', id });
});