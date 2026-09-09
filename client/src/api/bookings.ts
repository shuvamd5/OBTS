import api from "./client";
import type { BookingOffer, BookingResult } from "../types";

export interface SearchParams {
  sp: string;
  fp: string;
  date: string;
  time?: string;
  order?: "price" | "time";
}

export const bookingsApi = {
  search: (params: SearchParams) =>
    api.get<{ offers: BookingOffer[] }>("/bookings/search", { params }),

  pending: (payload: { arid: string; sno: number; sp: string; fp: string }) =>
    api.post<BookingResult>("/bookings/pending", payload),

  confirm: (payload: { arid: string; sno: number; sp: string; fp: string }) =>
    api.post<BookingResult>("/bookings/confirm", payload),
};
