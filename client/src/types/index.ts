export type UserRole = "admin" | "operator" | "customer" | "checker";
export type ScheduleStatus = "not approved" | "going" | "not going" | "pending" | "Expired";
export type PriceStatus = "unchecked" | "not ok" | "ok" | "Expired";

export interface User {
  _id: string;
  uname: string;
  ugender: string;
  uemail: string;
  umobile: string;
  ustatus: UserRole;
  udate: string;
  utime: string;
  totaltc: number;
  reservedtc: number;
  pendingtc: number;
  payment: number;
  due: number;
  points: number;
}

export interface RegisterPayload {
  uname: string;
  uemail: string;
  umobile: string;
  upass: string;
  ugender: string;
}

export interface UpdateProfilePayload {
  uname?: string;
  uemail?: string;
  umobile?: string;
  ugender?: string;
  curpass?: string;
  upass?: string;
}

export interface Checkpoint {
  _id: string;
  route: string;
  price: number;
}

export interface Route {
  _id: string;
  sp: string;
  fp: string;
  checkpoints: Checkpoint[];
}

export type BusStatus = "unchecked" | "active" | "inactive";

export interface Bus {
  _id: string;
  bcd: string;
  bno: string;
  bname: string;
  btype: "A/C" | "Deluxe" | "Suspension";
  nseat: 37 | 39;
  stype: "FOLDABLE" | "SEMI-FOLDABLE" | "UNFOLDABLE";
  bstatus: BusStatus;
  bsapby: string;
  uid?: string | null;
  ownerName?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface BusMetaItem {
  code: string;
  label: string;
}

export interface BusMeta {
  zoneCodes: BusMetaItem[];
  vehicleTypes: BusMetaItem[];
}

export interface SchedulePrice {
  _id: string;
  bsid: string;
  rid: { _id: string; sp: string; fp: string };
  price: number;
  arstatus: PriceStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface Schedule {
  _id: string;
  bid: string;
  bus:
    | Pick<Bus, "_id" | "bcd" | "bno" | "bname" | "btype" | "nseat" | "bstatus" | "bsapby">
    | null;
  trdate: string;
  trtime: string;
  bsstatus: ScheduleStatus;
  bssapby: string;
  price?: SchedulePrice | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface PriceEntry {
  _id: string;
  bsid: string;
  rid: { _id: string; sp: string; fp: string };
  price: number;
  arstatus: PriceStatus;
  schedule?: {
    _id: string;
    bid: string;
    trdate: string;
    trtime: string;
    bsstatus: ScheduleStatus;
    bssapby: string;
  } | null;
  bus?: Pick<Bus, "_id" | "bcd" | "bno" | "bname" | "btype" | "bstatus"> | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface AppStats {
  tickets: { pending: number };
  buses: number;
  schedules: number;
  prices: number;
  total: number;
}

export type SeatStatus = "E" | "P" | "R";

export interface OfferSeat {
  sno: number;
  blc: string;
  sna: string;
  status: SeatStatus;
}

export interface OfferRow {
  left: string | null;
  seats: number[];
}

export interface BookingOffer {
  arid: string;
  bsid: string;
  bid: string;
  bname: string;
  bcd: string;
  bno: string;
  btype: string;
  stype: string;
  nseat: number;
  trdate: string;
  trtime: string;
  route: { rid: string; sp: string; fp: string };
  query: { sp: string; fp: string };
  cpid: { sp: number; fp: number };
  price: number;
  counts: { E: number; P: number; R: number };
  seats: OfferSeat[];
  rows: OfferRow[];
}

export interface BookingResult {
  message: string;
  ticket: {
    _id: string;
    arid: string;
    ssid: string;
    trdate: string;
    trtime: string;
    sno: number;
    blc: string;
    sna: string;
    price: number;
    uid: string;
    treby: string;
    tstatus: SeatStatus;
    payment: string;
    pyreby: string;
  };
  seat: {
    _id: string;
    arid: string;
    sno: number;
    sp: string;
    fp: string;
    price: number;
    status: SeatStatus;
    trdate: string;
    trtime: string;
  };
  bus: {
    bname: string;
    bcd: string;
    bno: string;
    btype: string;
    stype: string;
    nseat: number;
  };
  price: number;
}