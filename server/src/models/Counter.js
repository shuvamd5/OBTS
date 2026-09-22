import mongoose from 'mongoose';

// Named atomic sequence counters (e.g. schedule numbers, bookingIds per year).
// `_id` is the counter name; `seq` is the last issued value.
const counterSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    seq: { type: Number, default: 0 },
  },
  { timestamps: false, versionKey: false }
);

const Counter = mongoose.model('Counter', counterSchema);

export default Counter;