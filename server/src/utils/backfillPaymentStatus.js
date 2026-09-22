import Ticket from '../models/Ticket.js';
import Payment from '../models/Payment.js';

// P0-2: legacy tickets carry payment 'due'/'Clear' on the `payment` field.
// Module 9 renames the field to `paymentStatus` with the new enum
// (pending/paid/refunded/failed) and backfills existing rows idempotently.
export async function backfillPaymentStatus() {
  const res = await Ticket.updateMany(
    { paymentStatus: { $exists: false } },
    [
      {
        $set: {
          paymentStatus: {
            $switch: {
              branches: [
                { case: { $eq: ['$payment', 'Clear'] }, then: 'paid' },
                { case: { $eq: ['$payment', 'due'] }, then: 'pending' },
              ],
              default: 'pending',
            },
          },
        },
      },
    ],
    { updatePipeline: true }
  );
  if (res.modifiedCount > 0) {
    console.log(`[backfill] ticket payment status derived on ${res.modifiedCount} row(s)`);
  }
  return res.modifiedCount;
}

// Module 9 minted Payment rows for new bookings, but tickets paid in the legacy
// system have paymentStatus 'paid' with no matching Payment doc — which breaks
// desk refunds (they key off the Payment id). Mint one doc per legacy paid
// ticket that lacks one, idempotently (unique ticketId index guards duplicates).
export async function backfillPaidPayments() {
  const paid = await Ticket.find({ paymentStatus: 'paid' })
    .select('_id bookingRef uid price')
    .lean();
  if (paid.length === 0) return 0;

  const existing = await Payment.find({ ticketId: { $in: paid.map((t) => t._id) } })
    .select('ticketId')
    .lean();
  const have = new Set(existing.map((p) => String(p.ticketId)));
  const missing = paid.filter((t) => !have.has(String(t._id)));
  if (missing.length === 0) return 0;

  await Payment.insertMany(
    missing.map((t) => ({
      ticketId: t._id,
      bookingRef: t.bookingRef ?? null,
      userId: t.uid,
      amount: t.price,
      status: 'paid',
    })),
    { ordered: false }
  );
  console.log(`[backfill] paid payment docs minted for ${missing.length} legacy ticket(s)`);
  return missing.length;
}