import api from "./client";
import type { BusType } from "../types";

export const referenceApi = {
  locations: () => api.get<{ locations: string[] }>("/reference/locations"),
  busTypes: () => api.get<{ busTypes: BusType[] }>("/reference/bus-types"),
};