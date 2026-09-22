import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { MyBooking, MyBookingTicket } from "../types";

const bookings = vi.hoisted(() => ({
  my: vi.fn(),
  cancel: vi.fn(),
  cancelTicket: vi.fn(),
  reserve: vi.fn(),
  search: vi.fn(),
  pending: vi.fn(),
  confirm: vi.fn(),
  get: vi.fn(),
  passengers: vi.fn(),
}));

const payments = vi.hoisted(() => ({ create: vi.fn() }));

vi.mock("../api/bookings", () => ({ bookingsApi: bookings }));
vi.mock("../api/payments", () => ({ paymentsApi: payments }));

import MyBookingsPage from "./MyBookingsPage";

const ticket = (over: Partial<MyBookingTicket> = {}): MyBookingTicket => ({
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
  bookingId: "EYT-030-001-00001",
  bookedByName: "Test Customer",
  tstatus: "reserved",
  paymentStatus: "paid",
  pyreby: "none",
  bookingRef: "ref-res",
  passengerName: "Ram Bahadur",
  passengerPhone: "9800000000",
  passengerAge: 30,
  passengerGender: "Male",
  bus: { _id: "b1", bname: "Express Queen", plateNumber: "BA 1 JA 2345", busTypeName: "Volvo" },
  route: { rid: "r1", sp: "KTM", fp: "PKR" },
  segment: { sp: "KTM", fp: "PKR", price: 500 },
  ...over,
});

const reserved: MyBooking = {
  bookingRef: "ref-res",
  arid: "arid1",
  trdate: "2030-01-01",
  trtime: "08:00",
  bus: { bid: "b1", bname: "Express Queen", plateNumber: "BA 1 JA 2345", busTypeName: "Volvo" },
  route: { rid: "r1", sp: "KTM", fp: "PKR" },
  seats: [{ sno: 1, blc: "B", sna: "1", price: 500, ticketId: "t1", passengerName: "Ram Bahadur" }],
  totalPrice: 500,
  status: "reserved",
  payment: "paid",
  tickets: [ticket()],
};

const held: MyBooking = {
  ...reserved,
  bookingRef: "ref-held",
  trdate: "2030-02-01",
  status: "held",
  tickets: [ticket({ _id: "t2", bookingRef: "ref-held", tstatus: "held" })],
  seats: [{ sno: 2, blc: "B", sna: "2", price: 500, ticketId: "t2", passengerName: "Ram Bahadur" }],
};

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <MyBookingsPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("MyBookingsPage", () => {
  beforeEach(() => {
    bookings.my.mockReset();
    bookings.cancel.mockReset();
    bookings.cancelTicket.mockReset();
    bookings.reserve.mockReset();
    payments.create.mockReset();
  });

  it("groups bookings under status tabs and shows booking details", async () => {
    bookings.my.mockResolvedValue({ data: { bookings: [held, reserved] } });
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("My Bookings");
    expect(await screen.findByText("Express Queen · BA 1 JA 2345")).toBeInTheDocument();
    expect(screen.getByText("Ram Bahadur")).toBeInTheDocument();
    expect(screen.getAllByText("· 9800000000").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Rs 500").length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: /^Reserved/ }));
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Cancel booking" })).toBeInTheDocument()
    );
    expect(screen.queryByText("2030-02-01 08:00")).not.toBeInTheDocument();
  });

  it("cancels the whole booking after confirming", async () => {
    bookings.my.mockResolvedValue({ data: { bookings: [reserved] } });
    bookings.cancel.mockResolvedValue({ data: { message: "Booking cancelled" } });
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: /^Reserved/ }));
    await user.click(await screen.findByRole("button", { name: "Cancel booking" }));
    await screen.findByText("Cancel booking?");
    await user.click(screen.getByRole("button", { name: "Yes, cancel" }));

    await waitFor(() => expect(bookings.cancel).toHaveBeenCalledWith("ref-res"));
  });

  it("cancels an individual seat", async () => {
    bookings.my.mockResolvedValue({ data: { bookings: [reserved] } });
    bookings.cancelTicket.mockResolvedValue({ data: { message: "Ticket cancelled" } });
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: /^Reserved/ }));
    await user.click(await screen.findByRole("button", { name: "Cancel seat" }));
    await screen.findByText("Cancel booking?");
    await user.click(screen.getByRole("button", { name: "Yes, cancel" }));

    await waitFor(() => expect(bookings.cancelTicket).toHaveBeenCalledWith("t1"));
    expect(bookings.cancel).not.toHaveBeenCalled();
  });

  it("lets the user reserve a held booking and pay online", async () => {
    bookings.my.mockResolvedValue({ data: { bookings: [held, reserved] } });
    bookings.reserve.mockResolvedValue({ data: { message: "1 seat(s) reserved", count: 1 } });
    payments.create.mockResolvedValue({
      data: { transactionId: "tx1", amount: 500, gateway: "MockGateway" },
    });
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("My Bookings");
    await user.click(await screen.findByRole("button", { name: "Reserve seat" }));

    await screen.findByText(/Pay online/);
    expect(screen.getByText(/Seats become reserved now/)).toBeInTheDocument();
    await user.click(screen.getByText("Pay online"));
    await user.click(screen.getByRole("button", { name: "Reserve & pay online" }));

    await waitFor(() => expect(bookings.reserve).toHaveBeenCalledWith("ref-held"));
    await waitFor(() => expect(payments.create).toHaveBeenCalledWith({ bookingRef: "ref-held" }));
  });
});
