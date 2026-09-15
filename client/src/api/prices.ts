import api from "./client";
import type { PriceEntry } from "../types";

export const pricesApi = {
  assign: (payload: { bsid: string; rid: string; price: number }) =>
    api.post<{ scheduleRoute: PriceEntry }>("/prices", payload),

  updateRoute: (id: string, rid: string) =>
    api.patch<{ scheduleRoute: PriceEntry; message?: string }>(`/prices/${id}/route`, { rid }),

  updatePrice: (id: string, price: number) =>
    api.patch<{ scheduleRoute: PriceEntry; message?: string }>(`/prices/${id}/price`, { price }),
};