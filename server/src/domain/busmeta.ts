import type { BusMetaInfo, CodeLabel } from '../../../shared/domain.js';

export const ZONE_CODES: Record<string, string> = {
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

export const VEHICLE_TYPES: Record<string, string> = {
  KA: 'क',
  KHA: 'ख',
};

export const BUS_TYPES: readonly string[] = ['A/C', 'Deluxe', 'Suspension'];
export const BUS_SEATS = [37, 39] as const;
export const SEAT_STYLES: readonly string[] = ['FOLDABLE', 'SEMI-FOLDABLE', 'UNFOLDABLE'];
export const BUS_STATUSES: readonly string[] = ['unchecked', 'active', 'inactive'];

export const busMeta = (): BusMetaInfo => ({
  zoneCodes: Object.entries(ZONE_CODES).map(([code, label]) => ({ code, label } as CodeLabel)),
  vehicleTypes: Object.entries(VEHICLE_TYPES).map(([code, label]) => ({ code, label } as CodeLabel)),
});