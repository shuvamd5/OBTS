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
  },
  { timestamps: true }
);

routeSchema.index({ sp: 1, fp: 1 }, { unique: true });

const Route = mongoose.model('Route', routeSchema);

export default Route;