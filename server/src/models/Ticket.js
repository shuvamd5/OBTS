import mongoose from 'mongoose';

export const TICKET_STATUSES = ['held', 'reserved', 'cancelled'];
export const TICKET_PAYMENT_STATUSES = ['pending', 'paid', 'refunded', 'failed'];

const ticketSchema = new mongoose.Schema(
  {
    arid: { type: mongoose.Schema.Types.ObjectId, ref: 'ScheduleRoute', required: true },
    ssid: { type: mongoose.Schema.Types.ObjectId, ref: 'Seat', required: true },
    trdate: { type: Date, required: true },
    trtime: { type: String, required: true },
    sno: { type: Number, required: true },
    blc: { type: String, required: true },
    sna: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    uid: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    bookedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    bookedByName: { type: String, default: '' },
    bookingId: { type: String, default: null, index: true },
    tstatus: { type: String, enum: TICKET_STATUSES, required: true },
    paymentStatus: { type: String, enum: TICKET_PAYMENT_STATUSES, default: 'pending' },
    pyreby: { type: String, default: 'none' },
    bookingRef: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
    deletedAt: { type: Date, default: null },
    passengerName: { type: String, default: '' },
    passengerPhone: { type: String, default: '', trim: true },
    passengerAge: { type: Number, default: null, min: 0, max: 120 },
    passengerGender: { type: String, enum: ['Female', 'Male', 'Other', ''], default: '' },
  },
  { timestamps: true }
);

const Ticket = mongoose.model('Ticket', ticketSchema);

export default Ticket;