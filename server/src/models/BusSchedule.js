import mongoose from 'mongoose';

export const SCHEDULE_STATUSES = ['not approved', 'going', 'not going', 'pending', 'Expired'];

const busScheduleSchema = new mongoose.Schema(
  {
    bid: { type: mongoose.Schema.Types.ObjectId, ref: 'Bus', required: true, index: true },
    trdate: { type: Date, required: true },
    trtime: { type: String, required: true },
    bsstatus: { type: String, enum: SCHEDULE_STATUSES, default: 'not approved' },
    bssapby: { type: String, default: 'none' },
  },
  { timestamps: true }
);

busScheduleSchema.index({ bid: 1, trdate: 1 });

const BusSchedule = mongoose.model('BusSchedule', busScheduleSchema);

export default BusSchedule;