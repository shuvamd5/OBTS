import crypto from 'crypto';
import { Types } from 'mongoose';
import Payment from '../models/Payment.js';
import Ticket from '../models/Ticket.js';
import Seat from '../models/Seat.js';
import User from '../models/User.js';
import ScheduleRoute from '../models/ScheduleRoute.js';
import Sales from '../models/Sales.js';
import { AppError, asyncHandler } from '../middleware/errorHandler.js';
import { runInTransaction } from '../utils/tx.js';

const asId = (v) => new Types.ObjectId(v);

// Payment-driven sales: the per-(bid,bsid) Sales row exists from schedule
// approval; paid increments it, refund decrements it (G9).
const salesUpdate = async (session, ticket, delta) => {
  const s = session ? { session } : {};
  const ar = await ScheduleRoute.findById(ticket.arid).select('bsid').lean();
  if (!ar) return;
  await Sales.updateOne({ bsid: ar.bsid }, { $inc: { sales: delta } }, s);
};

// Mark one payment+ticket paid. Re-fetches by id so the transaction session
// sees the freshly-updated docs. Held tickets are promoted to reserved (seat +
// ledger counters) to mirror the legacy desk behavior. points are NOT
// re-awarded here (already granted at booking, removed on cancel/refund).
const applyPaid = async (session, paymentId, ticketId, opts) => {
  const s = session ? { session } : {};
  const payment = await Payment.findById(paymentId, null, s);
  const ticket = await Ticket.findById(ticketId, null, s);
  if (!payment || !ticket) throw new AppError(404, 'Payment or ticket not found');
  if (ticket.tstatus === 'cancelled') throw new AppError(400, 'Ticket already cancelled');
  if (ticket.paymentStatus === 'paid') return 'already-paid';

  const inc = { payment: ticket.price, due: -ticket.price };
  let promote = false;
  if (ticket.tstatus === 'held') {
    inc.reservedtc = 1;
    inc.pendingtc = -1;
    promote = true;
  }
  await User.updateOne({ _id: ticket.uid }, { $inc: inc }, s);
  if (promote) {
    await Seat.updateOne({ _id: ticket.ssid }, { $set: { status: 'reserved', lockExpiry: null } }, s);
    await Ticket.updateOne({ _id: ticket._id }, { $set: { tstatus: 'reserved' } }, s);
  }
  await Ticket.updateOne(
    { _id: ticket._id },
    { $set: { paymentStatus: 'paid', pyreby: opts.receivedBy ?? 'online' } },
    s
  );
  await Payment.updateOne(
    { _id: payment._id },
    {
      $set: {
        status: 'paid',
        method: opts.method,
        gateway: opts.gateway ?? payment.gateway ?? null,
        gatewayRef: opts.gatewayRef ?? payment.gatewayRef ?? null,
        receivedBy: opts.receivedBy ?? null,
      },
    },
    s
  );
  await salesUpdate(session, ticket, ticket.price);
  return 'paid';
};

// Full-cancel refund: reverses ledger + sales, releases the seat, and flips the
// ticket to cancelled/refunded in one transaction (user-confirmed semantics).
const applyRefund = async (session, paymentId, user) => {
  const s = session ? { session } : {};
  const payment = await Payment.findById(paymentId, null, s);
  if (!payment) throw new AppError(404, 'Payment not found');
  if (payment.status === 'refunded') return 'no-change';

  const ticket = await Ticket.findById(payment.ticketId, null, s);
  if (!ticket) throw new AppError(404, 'Ticket not found');
  if (ticket.paymentStatus === 'refunded' || ticket.tstatus === 'cancelled') return 'no-change';
  if (ticket.paymentStatus !== 'paid') throw new AppError(400, 'Payment has not been made');

  const inc = { totaltc: -1, payment: -ticket.price, due: ticket.price, points: -1 };
  if (ticket.tstatus === 'reserved') inc.reservedtc = -1;
  else inc.pendingtc = -1;
  await User.updateOne({ _id: ticket.uid }, { $inc: inc }, s);
  await Seat.deleteOne({ _id: ticket.ssid }, s);
  await Ticket.updateOne(
    { _id: ticket._id },
    { $set: { tstatus: 'cancelled', paymentStatus: 'refunded', pyreby: user.uname } },
    s
  );
  await Payment.updateOne(
    { _id: payment._id },
    { $set: { status: 'refunded', receivedBy: user.uname } },
    s
  );
  await salesUpdate(session, ticket, -ticket.price);
  return 'refunded';
};

// Build Payment docs for tickets that predate the collection (backfill renamed
// the ticket enum only). Ownership is enforced against the calling user.
const ensurePayments = async (session, filter) => {
  const s = session ? { session } : {};
  const existing = await Payment.find(filter, null, s).lean();
  if (existing.length) return existing;

  const ticketFilter = filter.ticketId
    ? { _id: filter.ticketId, uid: filter.userId }
    : { bookingRef: filter.bookingRef, uid: filter.userId, tstatus: { $ne: 'cancelled' } };
  const tickets = await Ticket.find(ticketFilter, null, s).lean();
  if (tickets.length === 0) return [];

  await Payment.create(
    tickets.map((t) => ({
      ticketId: t._id,
      bookingRef: t.bookingRef ?? null,
      userId: t.uid,
      amount: t.price,
    })),
    s
  );
  return Payment.find(filter, null, s).lean();
};

// G2 — POST /api/payments/create (ticketId | bookingRef): mint pending payments
// for the non-paid tickets of one booking and start a gateway transaction.
export const createPayment = asyncHandler(async (req, res) => {
  const { ticketId, bookingRef, gateway } = req.validated.body;
  const filter = ticketId
    ? { ticketId: asId(ticketId), userId: req.user._id }
    : { bookingRef: asId(bookingRef), userId: req.user._id };

  const payments = await ensurePayments(null, filter);
  const pending = payments.filter((p) => p.status === 'pending');
  if (pending.length === 0) {
    throw new AppError(400, 'No pending payment for this booking');
  }

  const transactionId = crypto.randomBytes(9).toString('hex');
  await Payment.updateMany(
    { _id: { $in: pending.map((p) => p._id) } },
    { $set: { transactionId, method: 'online', gateway: gateway ?? 'esewa' } }
  );
  const amount = pending.reduce((sum, p) => sum + p.amount, 0);

  res.status(201).json({
    message: 'Payment initiated',
    transactionId,
    amount,
    gateway: gateway ?? 'esewa',
    payments: pending.map((p) => ({ _id: p._id, ticketId: p.ticketId, amount: p.amount, status: p.status })),
  });
});

// G5 — POST /api/payments/cash: staff marks a ticket paid at the counter.
export const cashPayment = asyncHandler(async (req, res) => {
  const { ticketId } = req.validated.body;
  const ticket = await Ticket.findById(asId(ticketId));
  if (!ticket) throw new AppError(404, 'Ticket not found');

  let outcome;
  await runInTransaction(async (session) => {
    const [payment] = await ensurePayments(session, { ticketId: ticket._id, userId: ticket.uid });
    if (!payment) throw new AppError(404, 'Ticket not found');
    outcome = await applyPaid(session, payment._id, ticket._id, {
      method: 'cash',
      receivedBy: req.user.uname,
    });
  });
  if (outcome === 'already-paid') throw new AppError(400, 'Payment already made');

  res.json({ message: 'Payment cleared', ticketId });
});

// G6 — POST /api/payments/:id/refund: admin full-cancel refund.
export const refundPayment = asyncHandler(async (req, res) => {
  const { id } = req.validated.params;
  const payment = await Payment.findById(asId(id));
  if (!payment) throw new AppError(404, 'Payment not found');

  let outcome;
  await runInTransaction(async (session) => {
    outcome = await applyRefund(session, payment._id, req.user);
  });
  if (outcome === 'no-change') {
    return res.json({ message: 'No change', id });
  }

  res.json({ message: 'Payment refunded', id });
});

// G3 — POST /api/payments/verify: gateway callback confirmation (mock gateway).
export const verifyPayment = asyncHandler(async (req, res) => {
  const { transactionId, status } = req.validated.body;

  if (status === 'failed') {
    const failed = await Payment.updateMany(
      { transactionId, status: 'pending' },
      { $set: { status: 'failed' } }
    );
    return res.json({ message: 'Payment failed', count: failed.modifiedCount });
  }

  const payments = await Payment.find({ transactionId }).lean();
  if (payments.length === 0) throw new AppError(404, 'Transaction not found');

  let processed = 0;
  let outcome = 'paid';
  await runInTransaction(async (session) => {
    for (const p of payments) {
      const result = await applyPaid(session, p._id, p.ticketId, {
        method: 'online',
        gateway: p.gateway ?? 'esewa',
        gatewayRef: transactionId,
      });
      if (result === 'paid') processed++;
    }
    if (payments.every((p) => p.status !== 'pending')) outcome = 'no-change';
  });

  if (outcome === 'no-change') return res.json({ message: 'No change', transactionId, count: 0 });
  res.json({ message: 'Payment verified', transactionId, count: processed });
});

// G4 — POST /api/payments/webhook: async gateway webhook (mock gateway).
export const paymentWebhook = asyncHandler(async (req, res) => {
  const { transactionId, status } = req.validated.body;
  if (status === 'paid') {
    const payments = await Payment.find({ transactionId }).lean();
    if (payments.length === 0) throw new AppError(404, 'Transaction not found');
    let processed = 0;
    await runInTransaction(async (session) => {
      for (const p of payments) {
        if ((await applyPaid(session, p._id, p.ticketId, { method: 'online', gateway: p.gateway ?? 'esewa', gatewayRef: transactionId })) === 'paid') processed++;
      }
    });
    return res.json({ message: 'Webhook processed', transactionId, count: processed });
  }
  await Payment.updateMany({ transactionId, status: 'pending' }, { $set: { status: 'failed' } });
  res.json({ message: 'Webhook processed', transactionId, count: 0 });
});

// GET /api/payments/:id — status for the callback UI (owner or staff).
export const getPayment = asyncHandler(async (req, res) => {
  const { id } = req.validated.params;
  const payment = await Payment.findById(asId(id)).lean();
  if (!payment) throw new AppError(404, 'Payment not found');
  const isStaff = ['admin', 'operator'].includes(req.user.ustatus);
  if (!isStaff && String(payment.userId) !== String(req.user._id)) {
    throw new AppError(403, 'Not your payment');
  }
  res.json({ payment });
});