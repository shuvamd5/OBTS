import mongoose from 'mongoose';

export const ADDROUTE_STATUSES = ['unchecked', 'not ok', 'ok', 'Expired'];

const addrouteSchema = new mongoose.Schema(
  {
    bsid: { type: mongoose.Schema.Types.ObjectId, ref: 'BusSchedule', required: true },
    rid: { type: mongoose.Schema.Types.ObjectId, ref: 'Route', required: true },
    price: { type: Number, required: true, min: 0 },
    arstatus: { type: String, enum: ADDROUTE_STATUSES, default: 'unchecked' },
  },
  { timestamps: true }
);

addrouteSchema.index({ bsid: 1}, {unique: true});

const Addroute = mongoose.model('Addroute', addrouteSchema);

export default Addroute;