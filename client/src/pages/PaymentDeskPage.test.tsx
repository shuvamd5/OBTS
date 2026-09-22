import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PassengerSchedule } from "../api/bookings";

const bookings = vi.hoisted(() => {
  return { passengers: vi.fn() };
});

const payments = vi.hoisted(() => ({
  create: vi.fn(),
  cash: vi.fn(),
  verify: vi.fn(),
  refund: vi.fn(),
  get: vi.fn(),
}));

const auth = vi.hoisted(() => ({ user: { ustatus: "admin" } as { ustatus: string } }));

vi.mock("../api/bookings", () => ({ bookingsApi: bookings }));
vi.mock("../api/payments", () => ({ paymentsApi: payments }));
vi.mock("../auth/AuthContext", () => ({ useAuth: () => ({ user: auth.user }) }));

import PaymentDeskPage from "./PaymentDeskPage";

const schedule = (over: Partial<PassengerSchedule> = {}): PassengerSchedule => ({
  _id: "s1",
  trdate: "2030-01-01",
  trtime: "08:00",
  bsstatus: "approved",
  bus: { _id: "b1", bname: "Express Queen", plateNumber: "BA 1 JA 2345" },
  route: { rid: "r1", sp: "KTM", fp: "PKR" },
  price: 500,
  tickets: [
    {
      _id: "t1",
      sno: 1,
      blc: "B",
      sna: "1",
      trdate: "2030-01-01",
      trtime: "08:00",
      price: 500,
      tstatus: "reserved",
      paymentStatus: "pending",
      paymentId: null,
      passengerName: "Ram Bahadur",
      passengerPhone: "9800000000",
      passengerAge: 30,
      passengerGender: "Male",
      bus: null,
      route: null,
      segment: { sp: "KTM", fp: "PKR" },
    },
    {
      _id: "t2",
      sno: 2,
      blc: "B",
      sna: "2",
      trdate: "2030-01-01",
      trtime: "08:00",
      price: 500,
      tstatus: "reserved",
      paymentStatus: "paid",
      paymentId: "pay2",
      passengerName: "Shyam Karki",
      passengerPhone: "9800000001",
      passengerAge: 28,
      passengerGender: "Male",
      bus: null,
      route: null,
      segment: { sp: "KTM", fp: "PKR" },
    },
  ],
  ...over,
});

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <PaymentDeskPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("PaymentDeskPage", () => {
  beforeEach(() => {
    bookings.passengers.mockReset();
    payments.cash.mockReset();
    payments.refund.mockReset();
    auth.user = { ustatus: "admin" };
  });

  it("lists schedules with mixed payment rows", async () => {
    bookings.passengers.mockResolvedValue({ data: { schedules: [schedule()] } });
    renderPage();

    expect(await screen.findByText("Express Queen · BA 1 JA 2345")).toBeInTheDocument();
    expect(screen.getByText(/KTM → PKR/)).toBeInTheDocument();
    expect(screen.getByText(/Ram Bahadur/)).toBeInTheDocument();
    expect(screen.getByText(/Shyam Karki/)).toBeInTheDocument();
    expect(screen.getByText("Pending")).toBeInTheDocument();
    expect(screen.getByText("Paid")).toBeInTheDocument();
  });

  it("marks a pending ticket as paid via cash", async () => {
    bookings.passengers.mockResolvedValue({ data: { schedules: [schedule()] } });
    payments.cash.mockResolvedValue({ data: { message: "Payment recorded" } });
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Mark paid" }));
    await waitFor(() => expect(payments.cash).toHaveBeenCalledWith("t1"));
  });

  it("refunds a paid ticket after confirming (admin)", async () => {
    bookings.passengers.mockResolvedValue({ data: { schedules: [schedule()] } });
    payments.refund.mockResolvedValue({ data: { message: "Refunded" } });
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Refund" }));
    await screen.findByText("Refund ticket?");
    await user.click(screen.getByRole("button", { name: "Yes, refund" }));

    await waitFor(() => expect(payments.refund).toHaveBeenCalledWith("pay2"));
  });

  it("hides refunds for operators but keeps cash buttons", async () => {
    auth.user = { ustatus: "operator" };
    bookings.passengers.mockResolvedValue({ data: { schedules: [schedule()] } });
    renderPage();

    expect(await screen.findByRole("button", { name: "Mark paid" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Refund" })).not.toBeInTheDocument();
  });
});