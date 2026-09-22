import api from "./client";
import type { PaymentInitResult, PaymentStatus } from "../types";

export const paymentsApi = {
  create: (ref: { ticketId?: string; bookingRef?: string; gateway?: "esewa" | "khalti" }) =>
    api.post<PaymentInitResult>("/payments/create", ref),

  cash: (ticketId: string) => api.post<{ message: string }>("/payments/cash", { ticketId }),

  verify: (transactionId: string, status?: "paid" | "failed") =>
    api.post<{ message: string; transactionId?: string; count?: number }>("/payments/verify", {
      transactionId,
      ...(status ? { status } : {}),
    }),

  refund: (paymentId: string) =>
    api.post<{ message: string }>(`/payments/${paymentId}/refund`),

  get: (id: string) =>
    api.get<{ payment: { _id: string; status: PaymentStatus; amount: number; method: string | null } }>(
      `/payments/${id}`
    ),
};