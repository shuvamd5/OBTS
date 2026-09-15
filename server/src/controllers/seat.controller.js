import Seat from '../models/Seat.js';
import { seatAt } from '../domain/seatmap.js';
import { AppError, asyncHandler } from '../middleware/errorHandler.js';
import { findEligible, segmentFor, overlaps } from './booking.controller.js';

const HOLD_MS = 10 * 60 * 1000; // 10 min hold
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

// POST /api/seats/hold: hold one seat for 10 minutes.
export const holdSeat = asyncHandler(async (req, res) => {
  const { arid, sno, sp, fp } = req.validated.body;

  const { addroute, schedule, route, bus } = await findEligible(arid);

  if (addroute.arstatus !== 'approved') throw new AppError(400, 'Price entry is not available for booking');
  if (schedule.bsstatus === 'expired') throw new AppError(400, 'Schedule has expired');
  if (startOfDay(schedule.trdate) < startOfDay(new Date())) throw new AppError(400, 'Travel date has passed');

  const seg = segmentFor(route, addroute.price, sp, fp);
  if (!seg) throw new AppError(400, 'Invalid travel segment');

  const seatCount = bus.busTypeId?.seatCount ?? 37;
  const seatDef = seatAt(seatCount, sno - 1);
  if (!seatDef) throw new AppError(400, 'Invalid seat number');

  // Lazy cleanup of stale holds for this addroute before the conflict check.
  await Seat.deleteMany({ arid, status: 'held', lockExpiry: { $lt: new Date() } });
  const occupied = await Seat.find({ arid, sno }).select('spcpid fpcpid status').lean();
  for (const row of occupied) {
    if (!overlaps(seg.scpid, seg.fcpid, row.spcpid, row.fpcpid)) continue;
    throw new AppError(
      409,
      row.status === 'reserved' ? 'the selected seat has been reserved' : 'the selected seat is on-hold'
    );
  }

  let seat;
  try {
    const seats = await Seat.create([
      {
        arid, sno, sp, spcpid: seg.scpid, fp, fpcpid: seg.fcpid,
        price: seg.price, uid: req.user._id, status: 'held',
        lockExpiry: new Date(Date.now() + HOLD_MS),
        trdate: schedule.trdate, trtime: schedule.trtime,
      },
    ]);
    seat = seats[0];
  } catch (err) {
    if (err?.code === 11000) throw new AppError(409, 'Seat already held for this segment');
    throw err;
  }

  res.status(201).json({ message: 'seats held', seat, lockExpiry: seat.lockExpiry });
});

// POST /api/seats/release: release your own unexpired held seat (standalone, no ticket created by hold).
export const releaseSeat = asyncHandler(async (req, res) => {
  const { arid, sno, sp, fp } = req.validated.body;

  const seat = await Seat.findOne({ arid, sno, sp, fp, uid: req.user._id, status: 'held' });
  if (!seat) throw new AppError(404, 'Held seat not found');

  await seat.deleteOne();
  res.json({ message: 'seat released' });
});