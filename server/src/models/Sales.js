import mongoose from 'mongoose';

const salesSchema = new mongoose.Schema(
  {
    bid: { type: mongoose.Schema.Types.ObjectId, ref: 'Bus', required: true},
    bsid: { type: mongoose.Schema.Types.ObjectId, ref: 'BusSchedule', required: true },
    trdate: { type: Date, required: true },
    trtime: { type: String, required: true },
    sales: { type: Number, default: 0 },
  },
  { timestamps: true }
);

salesSchema.index({ bsid: 1}, {unique: true});

const Sales = mongoose.model('Sales', salesSchema);

export default Sales;