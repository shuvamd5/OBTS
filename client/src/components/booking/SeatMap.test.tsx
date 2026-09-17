import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { SeatMap } from "./SeatMap";
import type { BookingOffer } from "../../types";

const corridorOffer: BookingOffer = {
  arid: "arid1",
  bsid: "bsid1",
  bid: "bid1",
  bus: {
    bid: "bid1",
    bname: "Express Queen",
    plateNumber: "BA 1 JA 2345",
    busType: { _id: "bt1", name: "Volvo A/C Seater", seatCount: 37 },
    amenities: ["wifi", "ac"],
    rating: 4,
  },
  trdate: "2030-01-01",
  trtime: "08:00",
  route: { rid: "r1", sp: "KTM", fp: "PKR", stops: [], durationMinutes: null },
  query: { sp: "KTM", fp: "PKR" },
  cpid: { sp: 0, fp: 100 },
  price: 500,
  arrival: "14:30",
  counts: { available: 4, held: 0, reserved: 0 },
  seats: [
    { sno: 1, blc: "D", sna: "1", status: "available", lockExpiry: null },
    { sno: 2, blc: "B", sna: "2", status: "available", lockExpiry: null },
    { sno: 3, blc: "A", sna: "3", status: "available", lockExpiry: null },
    { sno: 4, blc: "C", sna: "4", status: "available", lockExpiry: null },
  ],
  rows: [
    { left: "Driver", seats: [0] },
    { left: "B", seats: [1, 2] },
    { left: "Corridor", seats: [3] },
  ],
};

describe("SeatMap", () => {
  it("renders the corridor text and its lone seat in the same row", () => {
    render(<SeatMap offer={corridorOffer} selectedSnos={new Set()} onPick={() => {}} />);

    const rows = screen.getAllByRole("row");
    expect(rows).toHaveLength(3);

    const corridorRow = rows.find((r) => r.textContent?.includes("Corridor"));
    expect(corridorRow).toBeTruthy();
    expect(within(corridorRow!).getByText("Corridor")).toBeTruthy();
    expect(within(corridorRow!).getByRole("button", { name: /C4/ })).toBeTruthy();
  });
});