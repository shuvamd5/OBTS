// K5: duration helpers for arrival-time computation.
// Free-text durations like '6 hours', '1 hr 30 min', '06:30' are parsed into
// total minutes; unknown/legacy values resolve to null.

export function parseDurationToMinutes(duration) {
  if (typeof duration !== 'string') return null;
  const text = duration.trim().toLowerCase();
  if (!text || /^(tbd|n\/a|unknown|-)$/.test(text)) return null;

  const colon = text.match(/^(\d{1,2}):(\d{2})$/);
  if (colon) return Number(colon[1]) * 60 + Number(colon[2]);

  let total = 0;
  let matched = false;

  const hours = text.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h\b)/);
  if (hours) {
    total += Math.round(Number(hours[1]) * 60);
    matched = true;
  }

  const mins = text.match(/(\d+(?:\.\d+)?)\s*(?:minutes?|mins?|m\b)/);
  if (mins) {
    total += Math.round(Number(mins[1]));
    matched = true;
  }

  if (!matched) {
    const bare = text.match(/^(\d+)$/);
    if (bare) {
      total += Number(bare[1]) * 60;
      matched = true;
    }
  }

  return matched ? total : null;
}

export function minutesToHHMM(totalMinutes) {
  if (typeof totalMinutes !== 'number' || !Number.isFinite(totalMinutes) || totalMinutes < 0) return null;
  const m = Math.round(totalMinutes) % (24 * 60);
  const hh = String(Math.floor(m / 60)).padStart(2, '0');
  const mm = String(m % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

// trtime is 'HH:MM' (24h). Returns 'HH:MM' arrival or null when unknown.
export function computeArrival(trtime, durationMinutes) {
  if (typeof durationMinutes !== 'number' || !Number.isFinite(durationMinutes) || durationMinutes < 0) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(trtime);
  if (!m) return null;
  const total = (Number(m[1]) * 60 + Number(m[2]) + Math.round(durationMinutes)) % (24 * 60);
  return minutesToHHMM(total);
}