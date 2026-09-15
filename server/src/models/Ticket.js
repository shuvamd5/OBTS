import mongoose from 'mongoose';

export const TICKET_STATUSES = ['E', 'P', 'R'];

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
    treby: { type: String, required: true },
    tstatus: { type: String, enum: TICKET_STATUSES, required: true },
    payment: { type: String, default: 'due' },
    pyreby: { type: String, default: 'none' },
  },
  { timestamps: true }
);

const Ticket = mongoose.model('Ticket', ticketSchema);

export default Ticket;