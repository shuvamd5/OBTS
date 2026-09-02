import api from "./client";
import type { Bus, BusStatus } from "../types";

export interface BusCreatePayload {
  bcd0: string;
  bcd1: string;
  bcd2: string;
  bno: string;
  bname: string;
  btype: Bus["btype"];
  nseat: number;
  stype: "foldable" | "semi-foldable" | "unfoldable";
}

export const busesApi = {
  list: () => api.get<{ buses: Bus[] }>("/buses"),

  create: (payload: BusCreatePayload) => api.post<{ bus: Bus }>("/buses", payload),

  updateStatus: (id: string, bstatus: BusStatus) =>
    api.patch<{ bus: Bus; message?: string }>(`/buses/${id}/status`, { bstatus }),

  remove: (id: string) => api.delete<{ message: string; id: string }>(`/buses/${id}`),
};