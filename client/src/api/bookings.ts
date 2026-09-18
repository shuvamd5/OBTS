import api from "./client";
import type {
  BookingOffer,
  BookingPayload,
  BookingResult,
  MyBooking,
  PassengerInput,
} from "../types";

export type SearchOrder = "price" | "time" | "arrival" | "rating";

export interface SearchParams {
  sp: string;
  fp: string;
  date: string;
  time?: string;
  order?: SearchOrder;
  busType?: string[];
  amenities?: string[];
  stops?: string[];
  minPrice?: number;
  maxPrice?: number;
  fromTime?: string;
  toTime?: string;
}

export const bookingsApi = {
  search: (params: SearchParams) =>
    api.get<{ offers: BookingOffer[] }>("/bookings/search", {
      params,
      paramsSerializer: { indexes: null },
    }),

  pending: (payload: BookingPayload) =>
    api.post<BookingResult>("/bookings/pending", payload),

  confirm: (payload: BookingPayload) =>
    api.post<BookingResult>("/bookings/confirm", payload),

  my: () => api.get<{ bookings: MyBooking[] }>("/bookings/my"),

  get: (id: string) => api.get<{ booking: MyBooking }>(`/bookings/${id}`),

  cancel: (id: string) => api.patch<{ message: string }>(`/bookings/${id}/cancel`),

  cancelTicket: (ticketId: string) =>
    api.patch<{ message: string }>(`/bookings/tickets/${ticketId}/cancel`),

  passengers: () => api.get<{ schedules: PassengerSchedule[] }>("/bookings/passengers"),
};

export interface PassengerSchedule {
  _id: string;
  trdate: string;
  trtime: string;
  bsstatus: string;
  bus: { _id: string; bname: string; plateNumber: string } | null;
  route: { rid: string; sp: string; fp: string } | null;
  price: number;
  tickets: PassengerTicket[];
}

export interface PassengerTicket {
  _id: string;
  sno: number;
  blc: string;
  sna: string;
  trdate: string;
  trtime: string;
  price: number;
  tstatus: string;
  payment: string;
  passengerName: string;
  passengerAge: number | null;
  passengerGender: string;
  bus: { _id: string; bname: string; plateNumber: string } | null;
  route: { rid: string; sp: string; fp: string } | null;
  segment: { sp: string; fp: string } | null;
}

export type { PassengerInput };
