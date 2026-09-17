import ScheduleRoute from '../models/ScheduleRoute.js';
import BusSchedule from '../models/BusSchedule.js';
import Bus from '../models/Bus.js';
import Route from '../models/Route.js';
import Location from '../models/Location.js';
import Seat from '../models/Seat.js';
import Ticket from '../models/Ticket.js';
import User from '../models/User.js';
import { seatAt, seatRows } from '../domain/seatmap.js';
import { AppError, asyncHandler } from '../middleware/errorHandler.js';
import { runInTransaction } from '../utils/tx.js';
import { computeArrival } from '../utils/routeDuration.js';

const DAY = 86400000;
const HOLD_MS = 10 * 60 * 1000; // 10 min seat lock
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

const releaseExpiredHeld = async () => {
  const expired = await Seat.find({ status: 'held', lockExpiry: { $lt: new Date() } }).select('_id').lean();
  if (expired.length === 0) return;
  const ids = expired.map((s) => s._id);

  const tickets = await Ticket.find({ ssid: { $in: ids }, tstatus: 'P' })
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
  const { arid, sp, fp } = req.validated.body;
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
  const ticketStatus = action === 'confirm' ? 'R' : 'P';
  const { tickets, seats } = await runInTransaction(async (session) => {
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
        treby: req.user.uname,
        tstatus: ticketStatus,
        payment: 'due',
        pyreby: 'none',
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
      tickets: createdTickets.map((t) => ({
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
        treby: t.treby,
        tstatus: t.tstatus,
        payment: t.payment,
        pyreby: t.pyreby,
      })),
    };
  });

  res.status(201).json({
    message: 'registration complete',
    tickets,
    seats,
    ticket: tickets[0],
    seat: seats[0],
    bus: {
      bname: bus.bname,
      plateNumber: bus.plateNumber,
      busType: { _id: bus.busTypeId?._id ?? null, name: bus.busTypeId?.name ?? null, seatCount: bus.busTypeId?.seatCount ?? 37 },
      amenities: bus.amenities ?? [],
    },
    price: seg.price * snos.length,
  });
};

export { findEligible, segmentFor, overlaps };
export const createPendingBooking = asyncHandler((req, res) => createBooking(req, res, 'pending'));
export const createConfirmBooking = asyncHandler((req, res) => createBooking(req, res, 'confirm'));
