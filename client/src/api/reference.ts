import api from "./client";
import type { BusMeta } from "../types";

export const referenceApi = {
  locations: () => api.get<{ locations: string[] }>("/reference/locations"),
  busMeta: () => api.get<BusMeta>("/reference/bus-meta"),
};