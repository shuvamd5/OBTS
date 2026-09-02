import mongoose from 'mongoose';
import Route from '../models/Route.js';
import Location from '../models/Location.js';
import Addroute from '../models/Addroute.js';
import { AppError, asyncHandler } from '../middleware/errorHandler.js';

async function ensureLocation(name) {
  const found = await Location.findOne({ name });
  if (!found) {
    throw new AppError(400, `'${name}' is not a known destination`);
  }
}

function sortedCheckpoints(route) {
  route.checkpoints.sort((a, b) => a.price - b.price);
}

export const listRoutes = asyncHandler(async (_req, res) => {
  const routes = await Route.find({}).sort({ sp: 1 }).lean();
  const sorted = routes.map((r) => ({
    ...r,
    checkpoints: [...r.checkpoints].sort((a, b) => a.price - b.price),
  }));
  res.json({ routes: sorted });
});

export const createRoute = asyncHandler(async (req, res) => {
  const { sp, fp } = req.body;

  await ensureLocation(sp);
  await ensureLocation(fp);

  const existing = await Route.findOne({ sp, fp });
  if (existing) {
    throw new AppError(409, 'Route already exists');
  }

  const route = await Route.create({ sp, fp });
  res.status(201).json({ route });
});

export const updateRoute = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const route = await Route.findById(id);
  if (!route) {
    throw new AppError(404, 'Route not found');
  }

  if (req.body.sp !== undefined) await ensureLocation(req.body.sp);
  if (req.body.fp !== undefined) await ensureLocation(req.body.fp);

  // sp/fp must remain different
  const newSp = req.body.sp ?? route.sp;
  const newFp = req.body.fp ?? route.fp;
  if (newSp === newFp) {
    throw new AppError(400, 'Start point and end point must be different towns');
  }

  const changes = {};
  if (req.body.sp !== undefined && req.body.sp !== route.sp) changes.sp = req.body.sp;
  if (req.body.fp !== undefined && req.body.fp !== route.fp) changes.fp = req.body.fp;

  if (Object.keys(changes).length === 0) {
    return res.json({ route, message: 'No change' });
  }

  const dup = await Route.findOne({
    sp: changes.sp ?? route.sp,
    fp: changes.fp ?? route.fp,
    _id: { $ne: route._id },
  });
  if (dup) {
    throw new AppError(409, 'Route already exists');
  }

  Object.assign(route, changes);
  await route.save();
  res.json({ route });
});

export const addCheckpoint = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { route: stop, price } = req.body;

  await ensureLocation(stop);

  const route = await Route.findById(id);
  if (!route) {
    throw new AppError(404, 'Route not found');
  }

  // checkpoint cannot be sp or fp
  if (stop === route.sp || stop === route.fp) {
    throw new AppError(400, 'Checkpoint cannot be the start or end point');
  }

  if (route.checkpoints.some((c) => c.route === stop)) {
    throw new AppError(409, 'Checkpoint already exists on this route');
  }

  route.checkpoints.push({ route: stop, price });
  sortedCheckpoints(route);
  await route.save();
  res.status(201).json({ route });
});

export const updateCheckpoint = asyncHandler(async (req, res) => {
  const { id, cpid } = req.params;

  if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(cpid)) {
    throw new AppError(400, 'Invalid id');
  }

  const route = await Route.findById(id);
  if (!route) {
    throw new AppError(404, 'Route not found');
  }

  const checkpoint = route.checkpoints.id(cpid);
  if (!checkpoint) {
    throw new AppError(404, 'Checkpoint not found');
  }

  if (req.body.route !== undefined) {
    await ensureLocation(req.body.route);
    if (req.body.route === route.sp || req.body.route === route.fp) {
      throw new AppError(400, 'Checkpoint cannot be the start or end point');
    }
  }

  const changes = {};
  if (req.body.route !== undefined && req.body.route !== checkpoint.route) {
    changes.route = req.body.route;
  }
  if (req.body.price !== undefined && req.body.price !== checkpoint.price) {
    changes.price = req.body.price;
  }

  if (Object.keys(changes).length === 0) {
    return res.json({ route, message: 'No change' });
  }

  if (
    changes.route !== undefined &&
    route.checkpoints.some((c) => c._id.toString() !== cpid && c.route === changes.route)
  ) {
    throw new AppError(409, 'Checkpoint already exists on this route');
  }

  if (changes.route !== undefined) checkpoint.route = changes.route;
  if (changes.price !== undefined) checkpoint.price = changes.price;

  sortedCheckpoints(route);
  await route.save();
  res.json({ route });
});

export const deleteRoute = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    throw new AppError(400, 'Invalid route id');
  }

  const route = await Route.findById(id);
  if (!route) {
    throw new AppError(404, 'Route not found');
  }

  const linked = await Addroute.findOne({ rid: id }).select('_id').lean();
  if (linked) {
    throw new AppError(
      400,
      'Cannot delete route — it is assigned to one or more schedules. Remove those schedule fares first.'
    );
  }

  await Route.findByIdAndDelete(id);
  res.json({ message: 'Route deleted', id });
});

export const deleteCheckpoint = asyncHandler(async (req, res) => {
  const { id, cpid } = req.params;

  if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(cpid)) {
    throw new AppError(400, 'Invalid id');
  }

  const route = await Route.findById(id);
  if (!route) {
    throw new AppError(404, 'Route not found');
  }

  const checkpoint = route.checkpoints.id(cpid);
  if (!checkpoint) {
    throw new AppError(404, 'Checkpoint not found');
  }

  route.checkpoints.pull(cpid);
  await route.save();
  res.json({ route, message: 'Checkpoint deleted' });
});