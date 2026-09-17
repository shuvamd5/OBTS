import mongoose from 'mongoose';
import { BUS_STATUSES } from '../domain/busmeta.js';

const busSchema = new mongoose.Schema(
  {
    plateNumber: { type: String, required: true, trim: true, uppercase: true },
    busTypeId: { type: mongoose.Schema.Types.ObjectId, ref: 'BusType', required: true },
    bname: { type: String, required: true },
    amenities: { type: [String], default: [] },
    rating: { type: Number, min: 0, max: 5, default: 0 },
    bstatus: { type: String, enum: BUS_STATUSES, default: 'pending' },
    bsapby: { type: String, default: 'none' },
    uid: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Unique per live bus only: a soft-deleted bus's plate must be re-usable.
busSchema.index(
  { plateNumber: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } }
);

const Bus = mongoose.model('Bus', busSchema);

export default Bus;