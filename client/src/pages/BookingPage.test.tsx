import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { BookingOffer, BookingResult, User } from "../types";

const bookings = vi.hoisted(() => ({ search: vi.fn(), confirm: vi.fn(), pending: vi.fn() }));
const reference = vi.hoisted(() => ({ locations: vi.fn() }));
const auth = vi.hoisted(() => ({ user: null as User | null }));

vi.mock("../api/bookings", () => ({ bookingsApi: bookings }));
vi.mock("../api/reference", () => ({ referenceApi: reference }));
vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({ user: auth.user, loading: false, login: vi.fn(), register: vi.fn() }),
}));

import BookingPage from "./BookingPage";

const customer: User = {
  _id: "u1",
  uname: "Test Customer",
  ugender: "Male",
  uemail: "tc@obts.dev",
  umobile: "9841000000",
  ustatus: "customer",
  udate: "",
  utime: "",
  totaltc: 0,
  reservedtc: 0,
  pendingtc: 0,
  payment: 0,
  due: 0,
  points: 0,
};

const offer: BookingOffer = {
  arid: "arid1",
  bsid: "bsid1",
  bid: "bid1",
  bus: {
    bid: "bid1",
    bname: "Express Queen",
    plateNumber: "BA 1 JA 2345",
    busType: { _id: "bt1", name: "Volvo A/C Seater", seatCount: 37 },
    amenities: ["wifi", "ac"],
  },
  trdate: "2030-01-01",
  trtime: "08:00",
  route: { rid: "r1", sp: "KTM", fp: "PKR" },
  query: { sp: "KTM", fp: "PKR" },
  cpid: { sp: 0, fp: 100 },
  price: 500,
  counts: { available: 1, held: 0, reserved: 0 },
  seats: [{ sno: 1, blc: "B", sna: "1", status: "available", lockExpiry: null }],
  rows: [{ left: null, seats: [0] }],
};

const result: BookingResult = {
  message: "registration complete",
  ticket: {
    _id: "t1",
    arid: "arid1",
    ssid: "s1",
    trdate: "2030-01-01",
    trtime: "08:00",
    sno: 1,
    blc: "B",
    sna: "1",
    price: 500,
    uid: "u1",
    treby: "Test Customer",
    tstatus: "R",
    payment: "due",
    pyreby: "none",
  },
  seat: {
    _id: "s1",
    arid: "arid1",
    sno: 1,
    sp: "KTM",
    fp: "PKR",
    price: 500,
    status: "reserved",
    trdate: "2030-01-01",
    trtime: "08:00",
  },
  bus: {
    bname: "Express Queen",
    plateNumber: "BA 1 JA 2345",
    busType: { _id: "bt1", name: "Volvo A/C Seater", seatCount: 37 },
    amenities: ["wifi", "ac"],
  },
  price: 500,
};

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <BookingPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

async function fillSearchAndRun(user: ReturnType<typeof userEvent.setup>) {
  await screen.findAllByText("KTM");
  const combos = screen.getAllByRole("combobox");
  await user.selectOptions(combos[0], "KTM");
  await user.selectOptions(combos[1], "PKR");
  await user.click(screen.getByRole("button", { name: /book/i }));
  await screen.findByText("Express Queen");
}

async function pickSeat(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /B 1/ }));
  await screen.findByText("Confirm booking");
}

describe("BookingPage", () => {
  beforeEach(() => {
    auth.user = customer;
    reference.locations.mockResolvedValue({ data: { locations: ["KTM", "PKR"] } });
    bookings.search.mockResolvedValue({ data: { offers: [offer] } });
  });

  it(
    "lets a logged-in user search, pick a seat, and reserve it",
    async () => {
      bookings.confirm.mockResolvedValue({ data: result });
      const user = userEvent.setup();
      renderPage();

      await fillSearchAndRun(user);
      await pickSeat(user);

      await user.click(screen.getByRole("button", { name: "Reserve" }));

      await screen.findByText("registration complete");
      expect(bookings.confirm).toHaveBeenCalledWith({
        arid: "arid1",
        sno: 1,
        sp: "KTM",
        fp: "PKR",
      });
      await waitFor(() => expect(bookings.pending).not.toHaveBeenCalled());
    },
    15000
  );

  it("puts a picked seat on-hold instead of reserving it", async () => {
    bookings.pending.mockResolvedValue({ data: { ...result, ticket: { ...result.ticket, tstatus: "P" as const } } });
    const user = userEvent.setup();
    renderPage();

    await fillSearchAndRun(user);
    await pickSeat(user);

    await user.click(screen.getByRole("button", { name: "On-hold" }));

    await screen.findByText("registration complete");
    expect(bookings.pending).toHaveBeenCalledWith({
      arid: "arid1",
      sno: 1,
      sp: "KTM",
      fp: "PKR",
    });
    await waitFor(() => expect(bookings.confirm).not.toHaveBeenCalled());
  });
});