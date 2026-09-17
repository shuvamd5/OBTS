import api from "./client";
import type { Bus, BusStatus } from "../types";

export interface BusCreatePayload {
  plateNumber: string;
  busTypeId: string;
  bname: string;
  amenities: string[];
  rating?: number;
}

export type BusEditPayload = Partial<BusCreatePayload>;

export const busesApi = {
  list: () => api.get<{ buses: Bus[] }>("/buses"),

  get: (id: string) => api.get<{ bus: Bus }>(`/buses/${id}`),

  create: (payload: BusCreatePayload) => api.post<{ bus: Bus }>("/buses", payload),

  update: (id: string, payload: BusEditPayload) =>
    api.patch<{ bus: Bus; message?: string }>(`/buses/${id}`, payload),

  updateStatus: (id: string, bstatus: BusStatus) =>
    api.patch<{ bus: Bus; message?: string }>(`/buses/${id}/status`, { bstatus }),

  remove: (id: string) => api.delete<{ message: string; id: string }>(`/buses/${id}`),
};