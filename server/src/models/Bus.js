import mongoose from 'mongoose';
import { BUS_STATUSES, BUS_TYPES, BUS_SEATS, SEAT_STYLES } from '../domain/busmeta.js';

const busSchema = new mongoose.Schema(
  {
    bcd: { type: String, required: true },
    bno: { type: String, required: true },
    bname: { type: String, required: true },
    btype: { type: String, enum: BUS_TYPES, required: true },
    nseat: { type: Number, enum: BUS_SEATS, required: true },
    stype: { type: String, enum: SEAT_STYLES, required: true },
    bstatus: { type: String, enum: BUS_STATUSES, default: 'unchecked' },
    bsapby: { type: String, default: 'none' },
    uid: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  },
  { timestamps: true }
);

busSchema.index({ bcd: 1, bno: 1 }, { unique: true });

const Bus = mongoose.model('Bus', busSchema);

export default Bus;