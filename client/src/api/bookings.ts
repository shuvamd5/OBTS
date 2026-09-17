import api from "./client";
import type { BookingOffer, BookingResult } from "../types";

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

  pending: (payload: { arid: string; sno: number[]; sp: string; fp: string }) =>
    api.post<BookingResult>("/bookings/pending", payload),

  confirm: (payload: { arid: string; sno: number[]; sp: string; fp: string }) =>
    api.post<BookingResult>("/bookings/confirm", payload),
};
