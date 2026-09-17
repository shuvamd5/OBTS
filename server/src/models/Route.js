import mongoose from 'mongoose';

const checkpointSchema = new mongoose.Schema(
  {
    route: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
  },
  { timestamps: true }
);

const routeSchema = new mongoose.Schema(
  {
    sp: { type: String, required: true },
    fp: { type: String, required: true },
    checkpoints: [checkpointSchema],
    rstatus: { type: String, enum: ['pending', 'active', 'inactive'], default: 'pending' },
    rsapby: { type: String, default: 'none' },
    distance: { type: Number, required: true, min: 0 },
    duration: { type: String, required: true, trim: true },
    durationMinutes: { type: Number, min: 0, default: null },
  },
  { timestamps: true }
);

routeSchema.index({ sp: 1, fp: 1 }, { unique: true });

const Route = mongoose.model('Route', routeSchema);

export default Route;