import api from "./client";
import type { BusType } from "../types";

export interface BusTypePayload {
  name: string;
  seatCount: number;
  seatStyle: BusType["seatStyle"];
}

export const busTypesApi = {
  list: () => api.get<{ busTypes: BusType[] }>("/bus-types"),

  create: (payload: BusTypePayload) => api.post<{ busType: BusType }>("/bus-types", payload),

  update: (id: string, payload: Partial<BusTypePayload>) =>
    api.patch<{ busType: BusType; message: string }>(`/bus-types/${id}`, payload),

  remove: (id: string) => api.delete<{ message: string; id: string }>(`/bus-types/${id}`),
};