import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import UserView from "./UserView";
import type { Schedule } from "../../types";

const base: Schedule = {
  _id: "s1",
  bid: "b1",
  bus: {
    _id: "b1",
    plateNumber: "BA 1 KHA 1213",
    bname: "Express",
    amenities: [],
    bstatus: "pending",
    bsapby: "none",
    busType: { _id: "t1", name: "Luxury", seatCount: 40 },
  },
  trdate: "2026-09-19T18:15:00.000Z",
  trtime: "15:15",
  bsstatus: "pending",
  bssapby: "none",
};

describe("UserView", () => {
  it("renders route and fare when the price has a route", () => {
    render(
      <UserView
        schedules={[
          {
            ...base,
            price: {
              _id: "p1",
              bsid: "b1",
              rid: { _id: "r1", sp: "Butwal", fp: "Pokhara" },
              price: 1000,
              arstatus: "approved",
            },
          },
        ]}
        loading={false}
        error=""
      />
    );
    expect(screen.getByText(/Butwal → Pokhara/)).toBeInTheDocument();
  });

  it("renders safely when the price's route is missing", () => {
    render(
      <UserView
        schedules={[
          {
            ...base,
            price: {
              _id: "p1",
              bsid: "b1",
              rid: null,
              price: 1000,
              arstatus: "pending",
            } as unknown as Schedule["price"],
          },
        ]}
        loading={false}
        error=""
      />
    );
    expect(screen.getByText(/route is unavailable/i)).toBeInTheDocument();
  });
});