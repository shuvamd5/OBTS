import mongoose from 'mongoose';

export const PAYMENT_STATUSES = ['pending', 'paid', 'refunded', 'failed'];
export const PAYMENT_METHODS = ['cash', 'online'];
export const PAYMENT_GATEWAYS = ['esewa', 'khalti'];

const paymentSchema = new mongoose.Schema(
  {
    ticketId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket', required: true, unique: true },
    bookingRef: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    method: { type: String, enum: PAYMENT_METHODS, default: null },
    status: { type: String, enum: PAYMENT_STATUSES, default: 'pending', index: true },
    gateway: { type: String, enum: PAYMENT_GATEWAYS, default: null },
    transactionId: { type: String, default: null, index: true },
    gatewayRef: { type: String, default: null },
    receivedBy: { type: String, default: null },
  },
  { timestamps: true }
);

const Payment = mongoose.model('Payment', paymentSchema);

export default Payment;