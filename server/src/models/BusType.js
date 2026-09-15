import mongoose from 'mongoose';

export const SEAT_STYLES = ['standard', 'semi-luxury', 'luxury'];

const busTypeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    seatCount: { type: Number, required: true },
    seatStyle: { type: String, enum: SEAT_STYLES, required: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

const BusType = mongoose.model('BusType', busTypeSchema);

export default BusType;