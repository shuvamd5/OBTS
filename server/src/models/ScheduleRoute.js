import mongoose from 'mongoose';

export const ROUTE_STATUSES = ['pending', 'approved', 'rejected', 'expired'];

const scheduleRouteSchema = new mongoose.Schema(
  {
    bsid: { type: mongoose.Schema.Types.ObjectId, ref: 'BusSchedule', required: true },
    rid: { type: mongoose.Schema.Types.ObjectId, ref: 'Route', required: true },
    price: { type: Number, required: true, min: 0 },
    arstatus: { type: String, enum: ROUTE_STATUSES, default: 'pending' },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Unique per live schedule only: a soft-deleted price must be replaceable.
scheduleRouteSchema.index(
  { bsid: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } }
);

const ScheduleRoute = mongoose.model('ScheduleRoute', scheduleRouteSchema, 'addroutes');

export default ScheduleRoute;