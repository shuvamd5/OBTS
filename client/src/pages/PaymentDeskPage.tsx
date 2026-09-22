import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { bookingsApi, type PassengerSchedule } from "../api/bookings";
import { paymentsApi } from "../api/payments";
import { serializeError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { isAdmin } from "../lib/roles";
import { fmtDate } from "../lib/date";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import Pill, { type PillDot } from "../components/ui/Pill";
import ConfirmDialog from "../components/ui/ConfirmDialog";

const PAY_LABEL: Record<string, string> = {
  pending: "Pending",
  paid: "Paid",
  refunded: "Refunded",
  failed: "Failed",
};

const PAY_DOT: Record<string, PillDot> = {
  pending: "amber",
  paid: "green",
  refunded: "red",
  failed: "red",
};

export default function PaymentDeskPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const admin = isAdmin(user);
  const [error, setError] = useState("");
  const [refund, setRefund] = useState<{ paymentId: string; label: string } | null>(null);

  const deskQuery = useQuery({
    queryKey: ["passengers"],
    queryFn: () => bookingsApi.passengers().then((res) => res.data.schedules),
  });
  const schedules = deskQuery.data ?? null;
  const loadError = deskQuery.isError ? serializeError(deskQuery.error) : "";

  const settle = () => {
    void queryClient.invalidateQueries({ queryKey: ["passengers"] });
    void queryClient.invalidateQueries({ queryKey: ["bookings"] });
  };

  const cashMutation = useMutation({
    mutationFn: (ticketId: string) => paymentsApi.cash(ticketId),
    onSuccess: settle,
    onError: (err) => setError(serializeError(err)),
  });

  const refundMutation = useMutation({
    mutationFn: (paymentId: string) => paymentsApi.refund(paymentId),
    onSuccess: settle,
    onError: (err) => setError(serializeError(err)),
  });

  const busy = cashMutation.isPending || refundMutation.isPending;

  const runRefund = () => {
    if (!refund) return;
    setError("");
    refundMutation.mutate(refund.paymentId, { onSettled: () => setRefund(null) });
  };

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Payment Desk</h1>
        <p className="mt-1 text-sm text-slate-500">
          Mark cash payments as paid, or refund paid tickets (admin).
        </p>
      </div>

      {(error || loadError) && (
        <p className="mb-4 rounded-card bg-red-50 px-4 py-2 text-sm text-red-700">{error || loadError}</p>
      )}

      {schedules === null ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : (schedules ?? []).length === 0 ? (
        <Card panel pad="6">
          <p className="text-sm text-slate-500">No upcoming schedules with passengers.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {(schedules ?? []).map((schedule) => (
            <ScheduleCard
              key={schedule._id}
              schedule={schedule}
              admin={admin}
              busy={busy}
              onCash={(ticketId) => cashMutation.mutate(ticketId)}
              onRefund={(paymentId, seatLabel) => setRefund({ paymentId, label: seatLabel })}
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(refund)}
        title="Refund ticket?"
        message={
          refund
            ? `Refund ${refund.label}. This releases the seat, reverses the ledger and sales, and marks the ticket cancelled. This cannot be undone.`
            : ""
        }
        confirmLabel="Yes, refund"
        busy={busy}
        onConfirm={runRefund}
        onCancel={() => setRefund(null)}
      />
    </div>
  );
}

function ScheduleCard({
  schedule,
  admin,
  busy,
  onCash,
  onRefund,
}: {
  schedule: PassengerSchedule;
  admin: boolean;
  busy: boolean;
  onCash: (ticketId: string) => void;
  onRefund: (paymentId: string, seatLabel: string) => void;
}) {
  return (
    <Card panel pad="4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-bold text-slate-900">
            {schedule.bus ? `${schedule.bus.bname} · ${schedule.bus.plateNumber}` : "Bus"}
          </div>
          <div className="mt-1 text-sm text-slate-500">
            {schedule.route ? `${schedule.route.sp} → ${schedule.route.fp}` : "Route"} ·{" "}
            {fmtDate(schedule.trdate)} {schedule.trtime}
          </div>
        </div>
        <div className="text-right text-sm">
          <div className="font-semibold text-slate-700">Rs {schedule.price} fare</div>
          <div className="text-xs text-slate-400">{schedule.tickets.length} ticket(s)</div>
        </div>
      </div>

      <div className="mt-3 divide-y divide-slate-100 border-t border-slate-100">
        {schedule.tickets.map((ticket) => {
          const seatLabel = `${ticket.blc}${ticket.sna}`;
          const paid = ticket.paymentStatus === "paid";
          const pending =
            ticket.paymentStatus === "pending" && ticket.tstatus !== "cancelled";
          const refundable = paid && admin && Boolean(ticket.paymentId);
          return (
            <div key={ticket._id} className="flex flex-wrap items-center justify-between gap-3 py-2 text-sm">
              <div className="flex min-w-[10rem] flex-col">
                <span className="font-semibold text-slate-800">
                  {seatLabel}
                  <span className="ml-2 text-xs font-normal text-slate-400">
                    {ticket.tstatus} · {ticket.segment ? `${ticket.segment.sp}→${ticket.segment.fp}` : ""}
                  </span>
                </span>
                <span className="text-xs text-slate-500">
                  {ticket.passengerName || "—"}
                  {ticket.passengerPhone ? ` · ${ticket.passengerPhone}` : ""}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-semibold text-slate-700">Rs {ticket.price}</span>
                <Pill dot={PAY_DOT[ticket.paymentStatus] ?? "slate"}>
                  {PAY_LABEL[ticket.paymentStatus] ?? ticket.paymentStatus}
                </Pill>
                {pending && (
                  <Button size="sm" disabled={busy} onClick={() => onCash(ticket._id)}>
                    Mark paid
                  </Button>
                )}
                {refundable && (
                  <Button
                    size="sm"
                    variant="danger"
                    disabled={busy}
                    onClick={() => onRefund(ticket.paymentId!, seatLabel)}
                  >
                    Refund
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}