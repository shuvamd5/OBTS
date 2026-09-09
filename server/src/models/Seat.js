import mongoose from 'mongoose';

export const SEAT_STATUSES = ['E', 'P', 'R'];

const seatSchema = new mongoose.Schema(
  {
    arid: { type: mongoose.Schema.Types.ObjectId, ref: 'Addroute', required: true },
    sno: { type: Number, required: true },
    sp: { type: String, required: true },
    spcpid: { type: Number, required: true },
    fp: { type: String, required: true },
    fpcpid: { type: Number, required: true },
    price: { type: Number, required: true, min: 0 },
    uid: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: SEAT_STATUSES, required: true },
    trdate: { type: Date, required: true },
    trtime: { type: String, required: true },
  },
  { timestamps: true }
);

// Same seat may have a non-overlapping bookings, but a booking in the exact segment is rejected.
seatSchema.index({ arid: 1, sno: 1, sp: 1, fp: 1 }, { unique: true });

const Seat = mongoose.model('Seat', seatSchema);

export default Seat;