// Shared TypeScript types used by the server TS pilot.
// Server TS modules import via: `import type { X } from '../../../shared/domain.js'`
// (the `.js` specifier maps to `.ts` via NodeNext + tsx).

// --- Seat map geometry (server: src/domain/seatmap.ts) ---

export interface SeatRow {
  left: string | null;
  seats: number[];
}

export interface SeatLayout {
  labels: string[];
  rows: SeatRow[];
  blockB: number;
}

export interface SeatInfo {
  sno: number;
  blc: 'A' | 'B';
  sna: string;
}

// --- Bus metadata (server: src/domain/busmeta.ts) ---

export interface CodeLabel {
  code: string;
  label: string;
}

export interface BusMetaInfo {
  zoneCodes: CodeLabel[];
  vehicleTypes: CodeLabel[];
}