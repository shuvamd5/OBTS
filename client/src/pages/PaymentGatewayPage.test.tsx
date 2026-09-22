import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const payments = vi.hoisted(() => ({
  create: vi.fn(),
  cash: vi.fn(),
  verify: vi.fn(),
  refund: vi.fn(),
  get: vi.fn(),
}));

vi.mock("../api/payments", () => ({ paymentsApi: payments }));

import PaymentGatewayPage from "./PaymentGatewayPage";

function renderPage(entry: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/pay/:transactionId" element={<PaymentGatewayPage />} />
          <Route path="*" element={<div>Home screen</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("PaymentGatewayPage", () => {
  beforeEach(() => {
    payments.verify.mockReset();
  });

  it("shows txn + amount and verifies payment on Pay now", async () => {
    payments.verify.mockResolvedValue({ data: { message: "paid" } });
    const user = userEvent.setup();
    renderPage("/pay/txn-abc?amount=2000&gateway=khalti");

    expect(await screen.findByText("txn-abc")).toBeInTheDocument();
    expect(screen.getByText("Rs 2000")).toBeInTheDocument();
    expect(screen.getAllByText(/Khalti/i).length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: "Pay now" }));

    await waitFor(() => expect(payments.verify).toHaveBeenCalledWith("txn-abc"));
    expect(await screen.findByText("Payment successful")).toBeInTheDocument();
    expect(screen.getAllByText(/2000/).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "My bookings" })).toBeInTheDocument();
  });

  it("surfaces the error when verification fails", async () => {
    payments.verify.mockRejectedValue(new Error("bad gateway"));
    const user = userEvent.setup();
    renderPage("/pay/txn-bad?amount=1000");

    await user.click(await screen.findByRole("button", { name: "Pay now" }));
    expect(await screen.findByText("bad gateway")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pay now" })).toBeInTheDocument();
  });

  it("redirects home without a transaction id", async () => {
    renderPage("/pay");
    expect(await screen.findByText("Home screen")).toBeInTheDocument();
  });
});