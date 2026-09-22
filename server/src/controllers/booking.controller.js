import ScheduleRoute from '../models/ScheduleRoute.js';
import BusSchedule from '../models/BusSchedule.js';
import Bus from '../models/Bus.js';
import Route from '../models/Route.js';
import Location from '../models/Location.js';
import Seat from '../models/Seat.js';
import Ticket from '../models/Ticket.js';
import Payment from '../models/Payment.js';
import User from '../models/User.js';
import { Types } from 'mongoose';
import { seatAt, seatRows } from '../domain/seatmap.js';
import { AppError, asyncHandler } from '../middleware/errorHandler.js';
import { runInTransaction } from '../utils/tx.js';
import { computeArrival } from '../utils/routeDuration.js';
import { buildBookingId } from '../utils/counter.js';

const DAY = 86400000;
const HOLD_MS = 10 * 60 * 1000; // 10 min seat lock
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

const releaseExpiredHeld = async () => {
  const expired = await Seat.find({ status: 'held', lockExpiry: { $lt: new Date() } }).select('_id').lean();
  if (expired.length === 0) return;
  const ids = expired.map((s) => s._id);

  const tickets = await Ticket.find({ ssid: { $in: ids }, tstatus: 'held' })
    .select('uid price')
    .lean();
  await Ticket.deleteMany({ ssid: { $in: ids } });

  // Reverse the user ledger for pending bookings whose holds just expired. Held
  // seats created by the standalone hold endpoint have no ticket and no ledger
  // increment, so they are excluded from the reversal.
  const perUser = new Map();
  for (const t of tickets) {
    const key = String(t.uid);
    const cur = perUser.get(key) ?? { count: 0, price: 0 };
    cur.count += 1;
    cur.price += t.price;
    perUser.set(key, cur);
  }

  await Seat.deleteMany({ _id: { $in: ids } });

  for (const [uid, { count, price }] of perUser) {
    await User.updateOne(
      { _id: uid },
      { $inc: { totaltc: -count, pendingtc: -count, due: -price, points: -count } }
    );
  }
};

// cpid : route origin = 0, route final = 100, checkpoints 1 to n.
function segmentFor(route, price, sp, fp) {
  const spIdx = route.checkpoints.findIndex((c) => c.route === sp);
  const fpIdx = route.checkpoints.findIndex((c) => c.route === fp);

  if (sp !== route.sp && spIdx < 0) return null;
  if (fp !== route.fp && fpIdx < 0) return null;

  const scpid = spIdx >= 0 ? spIdx + 1 : 0;
  const fcpid = fp === route.fp ? 100 : fpIdx + 1;
  if (scpid >= fcpid) return null;

  const spPrice = spIdx >= 0 ? route.checkpoints[spIdx].price : 0;
  const fpPrice = fp === route.fp ? price : route.checkpoints[fpIdx].price;
  const segmentPrice = fpPrice - spPrice;
  if (segmentPrice < 0) return null;

  return { scpid, fcpid, price: segmentPrice };
}

function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

function routeMatches(route, sp, fp) {
  if (sp !== route.sp && !route.checkpoints.some((c) => c.route === sp)) return false;
  const fpIdx = route.checkpoints.findIndex((c) => c.route === fp);
  if (fp !== route.fp && fpIdx < 0) return false;
  const scpid = sp !== route.sp ? route.checkpoints.findIndex((c) => c.route === sp) + 1 : 0;
  const fcpid = fp === route.fp ? 100 : fpIdx + 1;
  return scpid < fcpid;
}

// Checkpoint town names strictly between sp and fp (drives the stop picker).
function intermediateStops(route, sp, fp) {
  if (sp === route.sp && fp === route.fp) return route.checkpoints.map((c) => c.route);
  const spIdx = sp === route.sp ? -1 : route.checkpoints.findIndex((c) => c.route === sp);
  const fpIdx = fp === route.fp ? route.checkpoints.length : route.checkpoints.findIndex((c) => c.route === fp);
  if (spIdx >= fpIdx) return [];
  return route.checkpoints.slice(spIdx + 1, fpIdx).map((c) => c.route);
}

// K1: a requested intermediate stop must lie strictly between sp and fp.
function routeCoversStops(route, sp, fp, stops) {
  const spIdx = sp === route.sp ? -1 : route.checkpoints.findIndex((c) => c.route === sp);
  const fpIdx = fp === route.fp ? route.checkpoints.length : route.checkpoints.findIndex((c) => c.route === fp);
  if (spIdx >= fpIdx) return false;
  return stops.every((stop) => {
    const idx = route.checkpoints.findIndex((c) => c.route === stop);
    return idx > spIdx && idx < fpIdx;
  });
}

const buildOffer = async (addroute, schedule, bus, route, sp, fp) => {
  const seg = segmentFor(route, addroute.price, sp, fp);
  if (!seg) return null;

  const busType = bus.busTypeId ?? {};
  const seatCount = busType.seatCount ?? 37;
  await releaseExpiredHeld();
  const occupied = await Seat.find({ arid: addroute._id })
    .select('sno spcpid fpcpid status lockExpiry')
    .lean();
  const bySeat = new Map();
  for (const s of occupied) {
    if (!bySeat.has(s.sno)) bySeat.set(s.sno, []);
    bySeat.get(s.sno).push(s);
  }

  const counts = { available: 0, held: 0, reserved: 0 };
  const seats = [];
  for (let iter = 0; iter < seatCount; iter++) {
    const def = seatAt(seatCount, iter);
    let status = 'available';
    let lockExpiry = null;
    const rows = bySeat.get(def.sno) ?? [];
    for (const row of rows) {
      if (overlaps(seg.scpid, seg.fcpid, row.spcpid, row.fpcpid)) {
        status = row.status;
        lockExpiry = row.lockExpiry ?? null;
        break;
      }
    }
    counts[status]++;
    seats.push({ sno: def.sno, blc: def.blc, sna: def.sna, status, lockExpiry });
  }

  return {
    arid: addroute._id,
    bsid: schedule._id,
    bid: bus._id,
    bus: {
      bid: bus._id,
      bname: bus.bname,
      plateNumber: bus.plateNumber,
      busType: { _id: busType._id ?? null, name: busType.name ?? null, seatCount },
      amenities: bus.amenities ?? [],
      rating: bus.rating ?? 0,
    },
    trdate: schedule.trdate,
    trtime: schedule.trtime,
    arrival: computeArrival(schedule.trtime, route.durationMinutes ?? null),
    route: {
      rid: route._id,
      sp: route.sp,
      fp: route.fp,
      stops: intermediateStops(route, sp, fp),
      durationMinutes: route.durationMinutes ?? null,
    },
    query: { sp, fp },
    cpid: { sp: seg.scpid, fp: seg.fcpid },
    price: seg.price,
    counts,
    seats,
    rows: seatRows(seatCount),
  };
};

export const searchOffers = asyncHandler(async (req, res) => {
  const {
    sp,
    fp,
    date,
    order,
    busType,
    amenities,
    stops,
    minPrice,
    maxPrice,
    fromTime,
    toTime,
  } = req.validated.query;

  const [spLoc, fpLoc] = await Promise.all([
    Location.findOne({ name: sp }).lean(),
    Location.findOne({ name: fp }).lean(),
  ]);
  if (!spLoc) throw new AppError(400, 'Error in starting point selection');
  if (!fpLoc) throw new AppError(400, 'Error in final point selection');

  const t0 = startOfDay(new Date(`${date}T00:00:00`));
  if (Number.isNaN(t0.getTime())) throw new AppError(400, 'Invalid travel date');
  if (t0 < startOfDay(new Date())) throw new AppError(400, 'Travel date cannot be in the past');

  const routes = await Route.find({
    $or: [{ sp }, { 'checkpoints.route': sp }],
  }).lean();
  const rids = routes.filter((r) => routeMatches(r, sp, fp)).map((r) => r._id);
  if (rids.length === 0) return res.json({ offers: [] });

  const prices = await ScheduleRoute.find({
    rid: { $in: rids },
    arstatus: 'approved',
    deletedAt: null,
  }).lean();
  const bsidList = prices.map((p) => p.bsid);
  const schedules = await BusSchedule.find({
    _id: { $in: bsidList },
    bsstatus: { $ne: 'expired' },
    deletedAt: null,
    trdate: t0,
  }).lean();

  const schedMap = new Map(schedules.map((s) => [String(s._id), s]));
  const busIds = [...new Set(schedules.map((s) => String(s.bid)))];
  const buses = await Bus.find({ _id: { $in: busIds }, deletedAt: null, bstatus: 'active' })
    .populate('busTypeId', 'name seatCount')
    .lean();
  const busMap = new Map(buses.map((b) => [String(b._id), b]));
  const routeMap = new Map(routes.map((r) => [String(r._id), r]));

  const offers = [];
  for (const price of prices) {
    const schedule = schedMap.get(String(price.bsid));
    if (!schedule) continue;
    const bus = busMap.get(String(schedule.bid));
    if (!bus) continue;
    const route = routeMap.get(String(price.rid));
    if (!route) continue;

    // K1 — intermediate stop filter (checkpoint strictly between sp/fp).
    if (stops?.length && !routeCoversStops(route, sp, fp, stops)) continue;

    const offer = await buildOffer(price, schedule, bus, route, sp, fp);
    if (!offer) continue;

    // K3 — bus type / amenities / price range / departure-time filters.
    if (busType?.length && !busType.some((id) => String(bus.busTypeId?._id ?? '') === id)) continue;
    const amenitySet = new Set((offer.bus.amenities ?? []).map((a) => a.toLowerCase()));
    if (amenities?.length && !amenities.every((a) => amenitySet.has(a))) continue;
    if (minPrice !== undefined && offer.price < minPrice) continue;
    if (maxPrice !== undefined && offer.price > maxPrice) continue;
    if (fromTime !== undefined && offer.trtime < fromTime) continue;
    if (toTime !== undefined && offer.trtime > toTime) continue;

    offers.push(offer);
  }

  if (order === 'price') offers.sort((a, b) => a.price - b.price);
  else if (order === 'time') offers.sort((a, b) => a.trtime.localeCompare(b.trtime));
  else if (order === 'arrival') {
    offers.sort((a, b) => (a.arrival ?? '99:99').localeCompare(b.arrival ?? '99:99'));
  } else if (order === 'rating') {
    offers.sort(
      (a, b) => (b.bus.rating ?? 0) - (a.bus.rating ?? 0) || a.price - b.price
    );
  }

  res.json({ offers });
});

const findEligible = async (arid) => {
  const addroute = await ScheduleRoute.findById(arid);
  if (!addroute || addroute.deletedAt) throw new AppError(404, 'Price entry not found');
  const schedule = await BusSchedule.findById(addroute.bsid);
  if (!schedule || schedule.deletedAt) throw new AppError(404, 'Schedule not found');
  const route = await Route.findById(addroute.rid);
  if (!route) throw new AppError(404, 'Route not found');
  const bus = await Bus.findOne({ _id: schedule.bid, deletedAt: null, bstatus: 'active' })
    .populate('busTypeId', 'name seatCount')
    .lean();
  if (!bus) throw new AppError(400, 'Bus is not available for booking');
  return { addroute, schedule, route, bus };
};

const createBooking = async (req, res, action) => {
  const { arid, sp, fp, passenger } = req.validated.body;
  const snos = [...new Set(req.validated.body.sno)];
  if (snos.length === 0) throw new AppError(400, 'At least one seat is required');

  const { addroute, schedule, route, bus } = await findEligible(arid);

  if (addroute.arstatus !== 'approved') {
    throw new AppError(400, 'Price entry is not available for booking');
  }
  if (schedule.bsstatus === 'expired') {
    throw new AppError(400, 'Schedule has expired');
  }
  if (startOfDay(schedule.trdate) < startOfDay(new Date())) {
    throw new AppError(400, 'Travel date has passed');
  }

  const seg = segmentFor(route, addroute.price, sp, fp);
  if (!seg) throw new AppError(400, 'Invalid travel segment');

  const seatCount = bus.busTypeId?.seatCount ?? 37;
  const seatDefs = snos.map((sno) => seatAt(seatCount, sno - 1));
  if (seatDefs.some((def) => !def)) throw new AppError(400, 'Invalid seat number');

  await releaseExpiredHeld();
  const occupied = await Seat.find({ arid, sno: { $in: snos } })
    .select('sno spcpid fpcpid status')
    .lean();
  for (const row of occupied) {
    if (!overlaps(seg.scpid, seg.fcpid, row.spcpid, row.fpcpid)) continue;
    if (row.status === 'reserved') throw new AppError(409, 'the selected seat has been reserved');
    throw new AppError(
      409,
      action === 'confirm' ? 'the selected seat is kept on-hold' : 'the selected seat is on-hold'
    );
  }

  const seatStatus = action === 'confirm' ? 'reserved' : 'held';
  const ticketStatus = action === 'confirm' ? 'reserved' : 'held';
  const bookingRef = new Types.ObjectId();
  if (!schedule.schedNo) throw new AppError(500, 'Schedule has no assigned number');
  const bookingId = await buildBookingId(schedule.schedNo);
  const { tickets, seats, payments } = await runInTransaction(async (session) => {
    const s = session ? { session } : {};

    let created;
    try {
      created = await Seat.create(
        snos.map((sno) => ({
          arid,
          sno,
          sp,
          spcpid: seg.scpid,
          fp,
          fpcpid: seg.fcpid,
          price: seg.price,
          uid: req.user._id,
          status: seatStatus,
          lockExpiry: action === 'confirm' ? null : new Date(Date.now() + HOLD_MS),
          trdate: schedule.trdate,
          trtime: schedule.trtime,
        })),
        { ...s, ordered: true }
      );
    } catch (err) {
      if (err?.code === 11000) {
        throw new AppError(409, 'Seat already booked for this segment');
      }
      throw err;
    }

    const n = snos.length;
    const ledgerInc = action === 'confirm' ? { reservedtc: n } : { pendingtc: n };
    await User.updateOne(
      { _id: req.user._id },
      { $inc: { totaltc: n, ...ledgerInc, due: seg.price * n, points: n } },
      s
    );

    const createdTickets = await Ticket.create(
      snos.map((sno, i) => ({
        arid,
        ssid: created[i]._id,
        trdate: schedule.trdate,
        trtime: schedule.trtime,
        sno,
        blc: seatDefs[i].blc,
        sna: seatDefs[i].sna,
        price: seg.price,
        uid: req.user._id,
        bookedBy: req.user._id,
        bookedByName: req.user.uname,
        bookingId,
        tstatus: ticketStatus,
        paymentStatus: 'pending',
        pyreby: 'none',
        bookingRef,
        passengerName: passenger.name,
        passengerPhone: passenger.phone,
        passengerAge: passenger.age,
        passengerGender: passenger.gender,
      })),
      { ...s, ordered: true }
    );

    const createdPayments = await Payment.create(
      createdTickets.map((t) => ({
        ticketId: t._id,
        bookingRef,
        userId: req.user._id,
        amount: seg.price,
      })),
      { ...s, ordered: true }
    );

    return {
      seats: created.map((seat) => ({
        _id: seat._id,
        arid,
        sno: seat.sno,
        sp,
        fp,
        price: seat.price,
        status: seat.status,
        trdate: schedule.trdate,
        trtime: schedule.trtime,
      })),
      tickets: createdTickets.map((t, i) => ({
        _id: t._id,
        arid,
        ssid: t.ssid,
        trdate: t.trdate,
        trtime: t.trtime,
        sno: t.sno,
        blc: t.blc,
        sna: t.sna,
        price: t.price,
        uid: t.uid,
        bookedBy: t.bookedBy,
        bookedByName: t.bookedByName,
        bookingId: t.bookingId,
        tstatus: t.tstatus,
        paymentStatus: t.paymentStatus,
        pyreby: t.pyreby,
        bookingRef: t.bookingRef,
        paymentId: createdPayments[i]._id,
        passengerName: t.passengerName,
        passengerPhone: t.passengerPhone,
        passengerAge: t.passengerAge,
        passengerGender: t.passengerGender,
      })),
      payments: createdPayments.map((p) => ({
        _id: p._id,
        ticketId: p.ticketId,
        amount: p.amount,
        status: p.status,
      })),
    };
  });

  res.status(201).json({
    message: 'registration complete',
    tickets,
    seats,
    payments,
    ticket: tickets[0],
    seat: seats[0],
    bus: {
      bname: bus.bname,
      plateNumber: bus.plateNumber,
      busType: { _id: bus.busTypeId?._id ?? null, name: bus.busTypeId?.name ?? null, seatCount: bus.busTypeId?.seatCount ?? 37 },
      amenities: bus.amenities ?? [],
    },
    price: seg.price * snos.length,
    bookingRef,
    bookingId,
    passenger,
  });
};

export { findEligible, segmentFor, overlaps };
export const createPendingBooking = asyncHandler((req, res) => createBooking(req, res, 'pending'));
export const createConfirmBooking = asyncHandler((req, res) => createBooking(req, res, 'confirm'));

// Enrich ticket docs with bus + route + segment, legacy user-view style.
const attachBookingDetails = async (tickets) => {
  if (tickets.length === 0) return [];

  const arIds = [...new Set(tickets.map((t) => String(t.arid)))];
  const addroutes = await ScheduleRoute.find({ _id: { $in: arIds } }).lean();
  const ridList = [...new Set(addroutes.map((a) => String(a.rid)))];
  const bsidList = [...new Set(addroutes.map((a) => String(a.bsid)))];
  const [schedules, routes] = await Promise.all([
    BusSchedule.find({ _id: { $in: bsidList } }).lean(),
    Route.find({ _id: { $in: ridList } }).lean(),
  ]);
  const busIdList = [...new Set(schedules.map((s) => String(s.bid)))];
  const [seats, buses] = await Promise.all([
    Seat.find({ _id: { $in: tickets.map((t) => t.ssid) } }).select('sp fp price status').lean(),
    Bus.find({ _id: { $in: busIdList } }).populate('busTypeId', 'name').lean(),
  ]);
  const seatMap = new Map(seats.map((s) => [String(s._id), s]));
  const arMap = new Map(addroutes.map((a) => [String(a._id), a]));
  const schedMap = new Map(schedules.map((s) => [String(s._id), s]));
  const routeMap = new Map(routes.map((r) => [String(r._id), r]));
  const busMap = new Map(buses.map((b) => [String(b._id), b]));

  return tickets.map((t) => {
    const seat = seatMap.get(String(t.ssid));
    const addroute = arMap.get(String(t.arid));
    const route = addroute ? routeMap.get(String(addroute.rid)) : undefined;
    const schedule = addroute ? schedMap.get(String(addroute.bsid)) : undefined;
    const bus = schedule ? busMap.get(String(schedule.bid)) : undefined;
    return {
      ...t,
      bus: bus
        ? {
            _id: bus._id,
            bname: bus.bname,
            plateNumber: bus.plateNumber,
            busTypeName: bus.busTypeId?.name ?? null,
          }
        : null,
      route: route ? { rid: route._id, sp: route.sp, fp: route.fp } : null,
      segment: seat ? { sp: seat.sp, fp: seat.fp, price: seat.price ?? t.price } : null,
    };
  });
};

const groupStatus = (tickets) => {
  const statuses = new Set(tickets.map((t) => t.tstatus));
  if (statuses.size === 1) return tickets[0].tstatus;
  if (statuses.has('reserved')) return 'reserved';
  return 'held';
};

// Group payment summary from per-ticket paymentStatus:
// all paid → 'paid', all refunded → 'refunded', none paid → 'pending', mixed → 'partial'.
const groupPayment = (tickets) => {
  const statuses = new Set(tickets.map((t) => t.paymentStatus ?? 'pending'));
  if (statuses.size === 1) {
    const only = tickets[0].paymentStatus ?? 'pending';
    return only === 'paid' ? 'paid' : only === 'refunded' ? 'refunded' : 'pending';
  }
  return 'partial';
};

const groupBookings = (tickets) => {
  const groups = new Map();
  for (const t of tickets) {
    const key = String(t.bookingRef ?? t._id);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(t);
  }

  return [...groups.values()].map((group) => {
    const first = group[0];
    const totalPrice = group.reduce((sum, t) => sum + (t.price ?? 0), 0);
    return {
      bookingRef: String(first.bookingRef ?? first._id),
      bookingId: first.bookingId ?? null,
      arid: first.arid,
      trdate: first.trdate,
      trtime: first.trtime,
      bus: first.bus,
      route: first.route,
      seats: group.map((t) => ({
        sno: t.sno,
        blc: t.blc,
        sna: t.sna,
        price: t.price,
        ticketId: t._id,
        passengerName: t.passengerName,
        passengerPhone: t.passengerPhone,
      })),
      totalPrice,
      status: groupStatus(group),
      payment: groupPayment(group),
      tickets: group,
    };
  });
};

// GET /api/bookings/my — owner's bookings grouped by bookingRef for tabs.
export const listMyBookings = asyncHandler(async (req, res) => {
  const tickets = await Ticket.find({ uid: req.user._id, deletedAt: null })
    .sort({ trdate: -1 })
    .lean();
  const enriched = await attachBookingDetails(tickets);
  const bookings = groupBookings(enriched).sort(
    (a, b) => new Date(b.trdate) - new Date(a.trdate) || a.trtime.localeCompare(b.trtime)
  );
  res.json({ bookings });
});

// GET /api/bookings/:id — a single owner booking group (bookingRef).
export const getBookingById = asyncHandler(async (req, res) => {
  const { id } = req.validated.params;
  const tickets = await Ticket.find({ bookingRef: id, uid: req.user._id, deletedAt: null })
    .sort({ sno: 1 })
    .lean();
  if (tickets.length === 0) throw new AppError(404, 'Booking not found');
  const enriched = await attachBookingDetails(tickets);
  res.json({ booking: groupBookings(enriched)[0] });
});

// Reverse a single ticket's ledger + release its seat (shared group/individual cancel).
// Mirrors legacy tedit 'E'. A paid ticket cannot be cancelled here — refunds are
// processed by admin via the payment module (refund = full cancel).
const cancelTicket = async (session, ticket, user) => {
  if (ticket.tstatus === 'cancelled') return false;
  if (ticket.paymentStatus === 'paid') {
    throw new AppError(400, 'Ticket payment already made — refund it first');
  }
  const s = session ? { session } : {};
  const inc = { totaltc: -1, due: -ticket.price, points: -1 };
  if (ticket.tstatus === 'reserved') inc.reservedtc = -1;
  else inc.pendingtc = -1;
  await User.updateOne({ _id: user._id }, { $inc: inc }, s);
  await Seat.deleteOne({ _id: ticket.ssid }, s);
  await Ticket.updateOne({ _id: ticket._id }, { $set: { tstatus: 'cancelled' } }, s);
  await Payment.deleteOne({ ticketId: ticket._id }, s);
  return true;
};

// PATCH /api/bookings/:id/cancel — cancel every non-cancelled ticket in the group.
export const cancelBooking = asyncHandler(async (req, res) => {
  const { id } = req.validated.params;
  const tickets = await Ticket.find({ bookingRef: id, uid: req.user._id });
  if (tickets.length === 0) throw new AppError(404, 'Booking not found');

  let cancelled = 0;
  await runInTransaction(async (session) => {
    for (const t of tickets) {
      if (await cancelTicket(session, t, req.user)) cancelled++;
    }
  });

  res.json({ message: cancelled > 0 ? 'Booking cancelled' : 'No change', bookingRef: id });
});

// PATCH /api/bookings/tickets/:ticketId/cancel — cancel a single ticket in a group.
export const cancelBookingTicket = asyncHandler(async (req, res) => {
  const { ticketId } = req.validated.params;
  const ticket = await Ticket.findById(ticketId);
  if (!ticket) throw new AppError(404, 'Ticket not found');
  if (String(ticket.uid) !== String(req.user._id)) {
    throw new AppError(403, 'Not your ticket');
  }

  let cancelled = false;
  await runInTransaction(async (session) => {
    cancelled = await cancelTicket(session, ticket, req.user);
  });

  res.json({ message: cancelled ? 'Ticket cancelled' : 'No change', ticketId });
});

// POST /api/bookings/:id/reserve — promote the group's held tickets to reserved
// (seat reserved + lockExpiry cleared, ledger held→reserved). Payments already
// exist (minted pending at booking) so nothing moves there. Expired holds are
// skipped — the user must rebook if the seats were already released.
export const reserveBooking = asyncHandler(async (req, res) => {
  const { id } = req.validated.params;
  const tickets = await Ticket.find({ bookingRef: id, uid: req.user._id, tstatus: 'held', deletedAt: null }).lean();
  if (tickets.length === 0) throw new AppError(400, 'No held tickets to reserve');

  const count = await runInTransaction(async (session) => {
    const s = session ? { session } : {};
    let n = 0;
    for (const t of tickets) {
      const seat = await Seat.findById(t.ssid, null, s);
      if (!seat || seat.status !== 'held') continue;
      if (seat.lockExpiry && new Date(seat.lockExpiry).getTime() <= Date.now()) continue;
      await Seat.updateOne(
        { _id: seat._id },
        { $set: { status: 'reserved', lockExpiry: null } },
        s
      );
      await Ticket.updateOne({ _id: t._id }, { $set: { tstatus: 'reserved' } }, s);
      await User.updateOne(
        { _id: req.user._id },
        { $inc: { reservedtc: 1, pendingtc: -1 } },
        s
      );
      n += 1;
    }
    return n;
  });

  if (count === 0) {
    throw new AppError(409, 'Seats no longer on hold — they were released. Please book again.');
  }
  res.json({ message: `${count} seat(s) reserved`, count, bookingRef: id });
});

// GET /api/bookings/passengers — staff payment/booking list (mirrors legacy busticketlist).
// Schedules from today forward with an approved price, each with passenger rows.
export const listPassengers = asyncHandler(async (req, res) => {
  const today = startOfDay(new Date());
  const scheduleFilter = { trdate: { $gte: today }, deletedAt: null };
  if (req.user.ustatus === 'operator') {
    const ownBusIds = await Bus.find({ uid: req.user._id, deletedAt: null }).select('_id').lean();
    scheduleFilter.bid = { $in: ownBusIds.map((b) => b._id) };
  }
  const schedules = await BusSchedule.find(scheduleFilter).sort({ trdate: 1, trtime: 1 }).lean();
  if (schedules.length === 0) return res.json({ schedules: [] });
  const schedMap = new Map(schedules.map((s) => [String(s._id), s]));

  const addroutes = await ScheduleRoute.find({
    bsid: { $in: schedules.map((s) => s._id) },
    arstatus: 'approved',
    deletedAt: null,
  })
    .populate('rid', 'sp fp')
    .lean();
  const ars = addroutes.filter((a) => schedMap.has(String(a.bsid)));
  if (ars.length === 0) return res.json({ schedules: [] });

  const busIds = [...new Set(ars.map((a) => String(schedMap.get(String(a.bsid)).bid)))];
  const buses = await Bus.find({ _id: { $in: busIds } }).populate('busTypeId', 'name').lean();
  const busMap = new Map(buses.map((b) => [String(b._id), b]));

  const out = [];
  for (const ar of ars) {
    const schedule = schedMap.get(String(ar.bsid));
    if (!schedule) continue;
    const bus = busMap.get(String(schedule.bid));
    const tickets = await Ticket.find({ arid: ar._id, tstatus: { $ne: 'cancelled' } })
      .sort({ sno: 1 })
      .lean();
    const enriched = await attachBookingDetails(tickets);
    const payments = await Payment.find({
      ticketId: { $in: tickets.map((t) => t._id) },
    })
      .select('_id ticketId status')
      .lean();
    const payMap = new Map(payments.map((p) => [String(p.ticketId), p]));
    out.push({
      bsid: ar.bsid,
      arid: ar._id,
      trdate: schedule.trdate,
      trtime: schedule.trtime,
      bsstatus: schedule.bsstatus,
      bus: bus
        ? {
            _id: bus._id,
            bname: bus.bname,
            plateNumber: bus.plateNumber,
            busTypeName: bus.busTypeId?.name ?? null,
          }
        : null,
      route: ar.rid,
      price: ar.price,
      tickets: enriched.map((t) => ({
        _id: t._id,
        sno: t.sno,
        blc: t.blc,
        sna: t.sna,
        trdate: t.trdate,
        trtime: t.trtime,
        price: t.price,
        tstatus: t.tstatus,
        paymentStatus: t.paymentStatus,
        paymentId: payMap.get(String(t._id))?._id ?? null,
        passengerName: t.passengerName,
        passengerPhone: t.passengerPhone,
        passengerAge: t.passengerAge,
        passengerGender: t.passengerGender,
        bus: t.bus,
        route: t.route,
        segment: t.segment ? { sp: t.segment.sp, fp: t.segment.fp } : null,
      })),
    });
  }

  res.json({ schedules: out });
});
