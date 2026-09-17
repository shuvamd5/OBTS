export type UserRole = "admin" | "operator" | "customer" | "checker";
export type ScheduleStatus = "pending" | "approved" | "not_going" | "expired";
export type PriceStatus = "pending" | "approved" | "rejected" | "expired";

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

export type RouteStatus = "pending" | "active" | "inactive";

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
  rstatus: RouteStatus;
  rsapby: string;
  distance: number;
  duration: string;
  durationMinutes: number | null;
}

export type BusStatus = "pending" | "active" | "inactive";
export type SeatStyle = "standard" | "semi-luxury" | "luxury";

export interface BusType {
  _id: string;
  name: string;
  seatCount: number;
  seatStyle: SeatStyle;
  busCount?: number;
  deletedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export type BusBusType = Pick<BusType, "_id" | "name" | "seatCount">;

export interface Bus {
  _id: string;
  plateNumber: string;
  busTypeId: string | null;
  busType: BusBusType | null;
  bname: string;
  amenities: string[];
  rating: number;
  bstatus: BusStatus;
  bsapby: string;
  uid: string | null;
  ownerName: string | null;
  deletedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
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
  bus: Pick<Bus, "_id" | "plateNumber" | "bname" | "amenities" | "bstatus" | "bsapby" | "busType"> | null;
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
  bus?: Pick<Bus, "_id" | "plateNumber" | "bname" | "bstatus" | "amenities" | "busType"> | null;
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

export type SeatStatus = "available" | "held" | "reserved";
export type TicketStatus = "E" | "P" | "R";

export interface OfferSeat {
  sno: number;
  blc: string;
  sna: string;
  status: SeatStatus;
  lockExpiry?: string | null;
}

export interface OfferRow {
  left: string | null;
  seats: number[];
}

export interface OfferBus {
  bid: string;
  bname: string;
  plateNumber: string;
  busType: { _id: string | null; name: string | null; seatCount: number } | null;
  amenities: string[];
  rating: number;
}

export interface BookingOffer {
  arid: string;
  bsid: string;
  bid: string;
  bus: OfferBus;
  trdate: string;
  trtime: string;
  route: { rid: string; sp: string; fp: string; stops: string[]; durationMinutes: number | null };
  query: { sp: string; fp: string };
  cpid: { sp: number; fp: number };
  price: number;
  arrival: string | null;
  counts: { available: number; held: number; reserved: number };
  seats: OfferSeat[];
  rows: OfferRow[];
}

export interface BookingTicket {
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
  tstatus: TicketStatus;
  payment: string;
  pyreby: string;
}

export interface BookingSeat {
  _id: string;
  arid: string;
  sno: number;
  sp: string;
  fp: string;
  price: number;
  status: SeatStatus;
  trdate: string;
  trtime: string;
}

export interface BookingResult {
  message: string;
  tickets?: BookingTicket[];
  ticket: BookingTicket;
  seats?: BookingSeat[];
  seat: BookingSeat;
  bus: {
    bname: string;
    plateNumber: string;
    busType: { _id: string | null; name: string | null; seatCount: number } | null;
    amenities: string[];
  };
  price: number;
}