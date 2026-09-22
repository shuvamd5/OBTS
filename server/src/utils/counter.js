import Counter from '../models/Counter.js';

// Atomically issue the next number for a named counter. Safe under concurrency
// via findByIdAndUpdate + $inc upsert.
export const nextSeq = async (key, step = 1) => {
  const doc = await Counter.findByIdAndUpdate(
    key,
    { $inc: { seq: step } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();
  return doc.seq;
};

const yearToken = (d = new Date()) => String(d.getFullYear()).slice(-3);

// Human-readable booking id: EYT-026-001-00001 => EYT-<year>-<schedNo>-<seq>.
// One bookingId is minted per booking group (shared by all its tickets); the
// per-year bookingId counter plus the schedule number guarantee uniqueness.
export const buildBookingId = async (schedNo) => {
  const year = new Date().getFullYear();
  const seq = await nextSeq(`bookingId-${year}`);
  return `EYT-${yearToken()}-${String(schedNo).padStart(3, '0')}-${String(seq).padStart(5, '0')}`;
};

export const issueScheduleNo = () => nextSeq('schedNo');