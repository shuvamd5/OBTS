import mongoose from 'mongoose';
import Route from '../models/Route.js';
import Location from '../models/Location.js';
import ScheduleRoute from '../models/ScheduleRoute.js';
import Seat from '../models/Seat.js';
import {
  AppError,
  asyncHandler,
} from '../middleware/errorHandler.js';
import { parseDurationToMinutes } from '../utils/routeDuration.js';

async function ensureLocation(name) {
  const found = await Location.findOne({ name });
  if (!found) {
    throw new AppError(400, `'${name}' is not a known destination`);
  }
}

function sortedCheckpoints(route) {
  route.checkpoints.sort((a, b) => a.price - b.price);
}

// Checkpoint edits re-sort the checkpoints and renumber their index-based
// segment ids (cpid). Seat/Ticket documents store those ids, so mutations are
// blocked while any booked tickets exist on the route to avoid silent
// corruption of segment references.
const assertNoRouteTickets = async (route) => {
  const linked = await ScheduleRoute.findOne({ rid: route._id, deletedAt: null }).select('_id').lean();
  if (!linked) return;
  const hasSeats = await Seat.exists({ arid: linked._id });
  if (hasSeats) {
    throw new AppError(
      400,
      'Cannot modify checkpoints while seats are booked on this route - use a new route instead'
    );
  }
};

export const listRoutes = asyncHandler(async (_req, res) => {
  const routes = await Route.find({}).sort({ sp: 1 }).lean();
  const sorted = routes.map((r) => ({
    ...r,
    rstatus: r.rstatus ?? 'pending',
    rsapby: r.rsapby ?? 'none',
    checkpoints: [...r.checkpoints].sort((a, b) => a.price - b.price),
  }));
  res.json({ routes: sorted });
});

export const createRoute = asyncHandler(async (req, res) => {
  const { sp, fp, distance, duration, durationMinutes } = req.validated.body;

  await ensureLocation(sp);
  await ensureLocation(fp);

  const existing = await Route.findOne({ sp, fp });
  if (existing) {
    throw new AppError(409, 'Route already exists');
  }

  const route = await Route.create({
    sp,
    fp,
    distance,
    duration,
    durationMinutes: durationMinutes ?? parseDurationToMinutes(duration),
  });
  res.status(201).json({ route });
});

export const updateRoute = asyncHandler(async (req, res) => {
  const { id } = req.validated.params;
  const route = await Route.findById(id);
  if (!route) {
    throw new AppError(404, 'Route not found');
  }

  const { sp, fp, distance, duration, durationMinutes } = req.validated.body;

  if (sp !== undefined) await ensureLocation(sp);
  if (fp !== undefined) await ensureLocation(fp);

  // sp/fp must remain different
  const newSp = sp ?? route.sp;
  const newFp = fp ?? route.fp;
  if (newSp === newFp) {
    throw new AppError(400, 'Start point and end point must be different towns');
  }

  const changes = {};
  if (sp !== undefined && sp !== route.sp) changes.sp = sp;
  if (fp !== undefined && fp !== route.fp) changes.fp = fp;
  if (distance !== undefined && distance !== route.distance) changes.distance = distance;
  if (duration !== undefined && duration !== route.duration) changes.duration = duration;
  if (durationMinutes !== undefined && durationMinutes !== route.durationMinutes) {
    changes.durationMinutes = durationMinutes;
  } else if (duration !== undefined && duration !== route.duration && durationMinutes === undefined) {
    const parsed = parseDurationToMinutes(duration);
    if (parsed !== null && parsed !== route.durationMinutes) changes.durationMinutes = parsed;
  }

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
  if (route.rstatus === 'active') {
    route.rstatus = 'pending';
    route.rsapby = 'none';
  }
  await route.save();
  res.json({ route });
});

export const updateRouteStatus = asyncHandler(async (req, res) => {
  const { id } = req.validated.params;
  const { rstatus } = req.validated.body;

  if (!mongoose.isValidObjectId(id)) {
    throw new AppError(400, 'Invalid route id');
  }

  const route = await Route.findById(id);
  if (!route) {
    throw new AppError(404, 'Route not found');
  }

  if ((route.rstatus ?? 'pending') === rstatus) {
    return res.json({ route: route.toObject(), message: 'No change' });
  }

  route.rstatus = rstatus;
  route.rsapby = req.user.uname;
  await route.save();

  res.json({ route, message: 'Status updated' });
});

export const addCheckpoint = asyncHandler(async (req, res) => {
  const { id } = req.validated.params;
  const { route: stop, price } = req.validated.body;

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

  await assertNoRouteTickets(route);

  route.checkpoints.push({ route: stop, price });
  sortedCheckpoints(route);
  await route.save();
  res.status(201).json({ route });
});

export const updateCheckpoint = asyncHandler(async (req, res) => {
  const { id, cpid } = req.validated.params;

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

  const { route: stop, price } = req.validated.body;

  if (stop !== undefined) {
    await ensureLocation(stop);
    if (stop === route.sp || stop === route.fp) {
      throw new AppError(400, 'Checkpoint cannot be the start or end point');
    }
  }

  const changes = {};
  if (stop !== undefined && stop !== checkpoint.route) {
    changes.route = stop;
  }
  if (price !== undefined && price !== checkpoint.price) {
    changes.price = price;
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

  await assertNoRouteTickets(route);

  sortedCheckpoints(route);
  await route.save();
  res.json({ route });
});

export const deleteRoute = asyncHandler(async (req, res) => {
  const { id } = req.validated.params;

  if (!mongoose.isValidObjectId(id)) {
    throw new AppError(400, 'Invalid route id');
  }

  const route = await Route.findById(id);
  if (!route) {
    throw new AppError(404, 'Route not found');
  }

  const linked = await ScheduleRoute.findOne({ rid: id, deletedAt: null }).select('_id').lean();
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
  const { id, cpid } = req.validated.params;

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

  await assertNoRouteTickets(route);

  route.checkpoints.pull(cpid);
  await route.save();
  res.json({ route, message: 'Checkpoint deleted' });
});