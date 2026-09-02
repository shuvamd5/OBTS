import api from "./client";
import type { PriceEntry, PriceStatus } from "../types";

export const pricesApi = {
  list: () => api.get<{ prices: PriceEntry[] }>("/prices"),

  assign: (payload: { bsid: string; rid: string; price: number }) =>
    api.post<{ addroute: PriceEntry }>("/prices", payload),

  updateStatus: (id: string, arstatus: PriceStatus) =>
    api.patch<{ addroute: PriceEntry; message?: string }>(`/prices/${id}/status`, { arstatus }),

  updateRoute: (id: string, rid: string) =>
    api.patch<{ addroute: PriceEntry; message?: string }>(`/prices/${id}/route`, { rid }),

  updatePrice: (id: string, price: number) =>
    api.patch<{ addroute: PriceEntry; message?: string }>(`/prices/${id}/price`, { price }),

  remove: (id: string) => api.delete<{ message: string; id: string }>(`/prices/${id}`),
};