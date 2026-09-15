import mongoose from 'mongoose';

export const SCHEDULE_STATUSES = ['pending', 'approved', 'not_going', 'expired'];

const busScheduleSchema = new mongoose.Schema(
  {
    bid: { type: mongoose.Schema.Types.ObjectId, ref: 'Bus', required: true, index: true },
    trdate: { type: Date, required: true },
    trtime: { type: String, required: true },
    bsstatus: { type: String, enum: SCHEDULE_STATUSES, default: 'pending' },
    bssapby: { type: String, default: 'none' },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

busScheduleSchema.index({ bid: 1, trdate: 1 });

const BusSchedule = mongoose.model('BusSchedule', busScheduleSchema);

export default BusSchedule;