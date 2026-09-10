import Addroute from '../models/Addroute.js';
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

const DAY = 86400000;
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

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

const buildOffer = async (addroute, schedule, bus, route, sp, fp) => {
  const seg = segmentFor(route, addroute.price, sp, fp);
  if (!seg) return null;

  const occupied = await Seat.find({ arid: addroute._id }).select('sno spcpid fpcpid status').lean();
  const bySeat = new Map();
  for (const s of occupied) {
    if (!bySeat.has(s.sno)) bySeat.set(s.sno, []);
    bySeat.get(s.sno).push(s);
  }

  const counts = { E: 0, R: 0, P: 0 };
  const seats = [];
  for (let iter = 0; iter < bus.nseat; iter++) {
    const def = seatAt(bus.nseat, iter);
    let status = 'E';
    const rows = bySeat.get(def.sno) ?? [];
    for (const row of rows) {
      if (overlaps(seg.scpid, seg.fcpid, row.spcpid, row.fpcpid)) {
        status = row.status;
        break;
      }
    }
    counts[status]++;
    seats.push({ sno: def.sno, blc: def.blc, sna: def.sna, status });
  }

  return {
    arid: addroute._id,
    bsid: schedule._id,
    bid: bus._id,
    bname: bus.bname,
    bcd: bus.bcd,
    bno: bus.bno,
    btype: bus.btype,
    stype: bus.stype,
    nseat: bus.nseat,
    trdate: schedule.trdate,
    trtime: schedule.trtime,
    route: { rid: route._id, sp: route.sp, fp: route.fp },
    query: { sp, fp },
    cpid: { sp: seg.scpid, fp: seg.fcpid },
    price: seg.price,
    counts,
    seats,
    rows: seatRows(bus.nseat),
  };
};

export const searchOffers = asyncHandler(async (req, res) => {
  const { sp, fp, date, order } = req.validated.query;

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

  const prices = await Addroute.find({ rid: { $in: rids }, arstatus: 'ok' }).lean();
  const bsidList = prices.map((p) => p.bsid);
  const schedules = await BusSchedule.find({
    _id: { $in: bsidList },
    bsstatus: { $ne: 'Expired' },
    trdate: t0,
  }).lean();

  const schedMap = new Map(schedules.map((s) => [String(s._id), s]));
  const busIds = [...new Set(schedules.map((s) => String(s.bid)))];
  const buses = await Bus.find({ _id: { $in: busIds } }).lean();
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
    const offer = await buildOffer(price, schedule, bus, route, sp, fp);
    if (offer) offers.push(offer);
  }

  if (order === 'price') offers.sort((a, b) => a.price - b.price);
  else if (order === 'time') offers.sort((a, b) => a.trtime.localeCompare(b.trtime));

  res.json({ offers });
});

const findEligible = async (arid) => {
  const addroute = await Addroute.findById(arid);
  if (!addroute) throw new AppError(404, 'Price entry not found');
  const schedule = await BusSchedule.findById(addroute.bsid);
  if (!schedule) throw new AppError(404, 'Schedule not found');
  const route = await Route.findById(addroute.rid);
  if (!route) throw new AppError(404, 'Route not found');
  const bus = await Bus.findById(schedule.bid);
  if (!bus) throw new AppError(404, 'Bus not found');
  return { addroute, schedule, route, bus };
};

const createBooking = async (req, res, action) => {
  const { arid, sno, sp, fp } = req.validated.body;

  const { addroute, schedule, route, bus } = await findEligible(arid);

  if (addroute.arstatus !== 'ok') {
    throw new AppError(400, 'Price entry is not available for booking');
  }
  if (schedule.bsstatus === 'Expired') {
    throw new AppError(400, 'Schedule has expired');
  }
  if (startOfDay(schedule.trdate) < startOfDay(new Date())) {
    throw new AppError(400, 'Travel date has passed');
  }

  const seg = segmentFor(route, addroute.price, sp, fp);
  if (!seg) throw new AppError(400, 'Invalid travel segment');

  const seatDef = seatAt(bus.nseat, sno - 1);
  if (!seatDef) throw new AppError(400, 'Invalid seat number');

  const occupied = await Seat.find({ arid, sno }).select('spcpid fpcpid status').lean();
  for (const row of occupied) {
    if (!overlaps(seg.scpid, seg.fcpid, row.spcpid, row.fpcpid)) continue;
    if (row.status === 'R') throw new AppError(409, 'the selected seat has been reserved');
    throw new AppError(
      409,
      action === 'confirm' ? 'the selected seat is kept on-hold' : 'the selected seat is on-hold'
    );
  }

  const status = action === 'confirm' ? 'R' : 'P';
  const { ticket, seat } = await runInTransaction(async (session) => {
    const s = session ? { session } : {};

    let seat;
    try {
      const seats = await Seat.create(
        [
          {
            arid,
            sno,
            sp,
            spcpid: seg.scpid,
            fp,
            fpcpid: seg.fcpid,
            price: seg.price,
            uid: req.user._id,
            status,
            trdate: schedule.trdate,
            trtime: schedule.trtime,
          },
        ],
        s
      );
      seat = seats[0];
    } catch (err) {
      if (err?.code === 11000) {
        throw new AppError(409, 'Seat already booked for this segment');
      }
      throw err;
    }

    const ledgerInc = action === 'confirm' ? { reservedtc: 1 } : { pendingtc: 1 };
    await User.updateOne(
      { _id: req.user._id },
      { $inc: { totaltc: 1, ...ledgerInc, due: seg.price, points: 1 } },
      s
    );

    const tickets = await Ticket.create(
      [
        {
          arid,
          ssid: seat._id,
          trdate: schedule.trdate,
          trtime: schedule.trtime,
          sno,
          blc: seatDef.blc,
          sna: seatDef.sna,
          price: seg.price,
          uid: req.user._id,
          treby: req.user.uname,
          tstatus: status,
          payment: 'due',
          pyreby: 'none',
        },
      ],
      s
    );
    return { seat, ticket: tickets[0] };
  });

  res.status(201).json({
    message: 'registration complete',
    ticket,
    seat,
    bus: {
      bname: bus.bname,
      bcd: bus.bcd,
      bno: bus.bno,
      btype: bus.btype,
      stype: bus.stype,
      nseat: bus.nseat,
    },
    price: seg.price,
  });
};

export const createPendingBooking = asyncHandler((req, res) => createBooking(req, res, 'pending'));
export const createConfirmBooking = asyncHandler((req, res) => createBooking(req, res, 'confirm'));