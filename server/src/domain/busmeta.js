export const ZONE_CODES = {
  ME: 'मे',
  KO: 'को',
  SA: 'स',
  JA: 'ज',
  BA: 'बा',
  NA: 'ना',
  GA: 'ग',
  LU: 'लु',
  DH: 'ध',
  RA: 'र',
  BHE: 'भे',
  KA: 'क',
  SE: 'से',
  MA: 'म',
};

export const VEHICLE_TYPES = {
  KA: 'क',
  KHA: 'ख',
};

export const BUS_TYPES = ['A/C', 'Deluxe', 'Suspension'];
export const BUS_SEATS = [37, 39];
export const SEAT_STYLES = ['FOLDABLE', 'SEMI-FOLDABLE', 'UNFOLDABLE'];
export const BUS_STATUSES = ['unchecked', 'active', 'inactive'];

export const busMeta = () => ({
  zoneCodes: Object.entries(ZONE_CODES).map(([code, label]) => ({ code, label })),
  vehicleTypes: Object.entries(VEHICLE_TYPES).map(([code, label]) => ({ code, label })),
});