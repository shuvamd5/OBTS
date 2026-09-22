import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { bookingsApi } from "../api/bookings";
import { paymentsApi } from "../api/payments";
import { serializeError } from "../api/client";
import { fmtDate } from "../lib/date";
import type { BookingPayment, MyBooking, TicketStatus } from "../types";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import Pill, { type PillDot } from "../components/ui/Pill";

const TABS: { key: TicketStatus; label: string }[] = [
  { key: "held", label: "On-hold" },
  { key: "reserved", label: "Reserved" },
  { key: "cancelled", label: "Cancelled" },
];

const STATUS_LABEL: Record<TicketStatus, string> = {
  held: "On-hold",
  reserved: "Reserved",
  cancelled: "Cancelled",
};

const STATUS_DOT: Record<TicketStatus, PillDot> = {
  held: "amber",
  reserved: "green",
  cancelled: "red",
};

const tabClass = (active: boolean) =>
  `rounded-btn px-3 py-1.5 text-sm font-medium ${
    active ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-100"
  }`;

const PAY_LABEL: Record<BookingPayment, string> = {
  pending: "Pending",
  paid: "Paid",
  partial: "Partial",
  refunded: "Refunded",
  failed: "Failed",
};

const PAY_DOT: Record<BookingPayment, PillDot> = {
  pending: "amber",
  paid: "green",
  partial: "amber",
  refunded: "red",
  failed: "red",
};

export default function MyBookingsPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [tab, setTab] = useState<TicketStatus>("held");
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState<{ ref: string; ticketId?: string; label: string } | null>(null);

  const bookingsQuery = useQuery({
    queryKey: ["bookings"],
    queryFn: () => bookingsApi.my().then((res) => res.data.bookings),
  });
  const bookings = bookingsQuery.data ?? null;
  const loadError = bookingsQuery.isError ? serializeError(bookingsQuery.error) : "";

  const settle = () => {
    void queryClient.invalidateQueries({ queryKey: ["bookings"] });
    setConfirm(null);
  };

  const groupCancel = useMutation({
    mutationFn: (ref: string) => bookingsApi.cancel(ref),
    onSuccess: settle,
    onError: (err) => {
      setError(serializeError(err));
      setConfirm(null);
    },
  });

  const ticketCancel = useMutation({
    mutationFn: (ticketId: string) => bookingsApi.cancelTicket(ticketId),
    onSuccess: settle,
    onError: (err) => {
      setError(serializeError(err));
      setConfirm(null);
    },
  });

  const payMutation = useMutation({
    mutationFn: (ref: string) => paymentsApi.create({ bookingRef: ref }).then((res) => res.data),
    onError: (err) => setError(serializeError(err)),
  });

  const reserveMutation = useMutation({
    mutationFn: ({ ref, method }: { ref: string; method: "station" | "online" }) =>
      bookingsApi.reserve(ref).then(async () => {
        if (method !== "online") return null;
        const init = await paymentsApi.create({ bookingRef: ref }).then((r) => r.data);
        return {
          transactionId: init.transactionId,
          amount: init.amount,
          gateway: init.gateway,
        } as { transactionId: string; amount: number; gateway: string };
      }),
    onError: (err) => setError(serializeError(err)),
  });

  const handlePay = (booking: MyBooking) => {
    setError("");
    payMutation.mutate(booking.bookingRef, {
      onSuccess: (init) => {
        void navigate(`/pay/${init.transactionId}?amount=${init.amount}&gateway=${init.gateway}`);
      },
    });
  };

  const handleReserve = (booking: MyBooking, method: "station" | "online") => {
    setError("");
    reserveMutation.mutate(
      { ref: booking.bookingRef, method },
      {
        onSuccess: (payment) => {
          void queryClient.invalidateQueries({ queryKey: ["bookings"] });
          if (payment) {
            void navigate(`/pay/${payment.transactionId}?amount=${payment.amount}&gateway=${payment.gateway}`);
          }
        },
      }
    );
  };

  const busy =
    groupCancel.isPending ||
    ticketCancel.isPending ||
    payMutation.isPending ||
    reserveMutation.isPending;
  const shown = (bookings ?? []).filter((b) => b.status === tab);

  const counts = (key: TicketStatus) => (bookings ?? []).filter((b) => b.status === key).length;

  const runConfirm = () => {
    if (!confirm) return;
    setError("");
    if (confirm.ticketId) ticketCancel.mutate(confirm.ticketId);
    else groupCancel.mutate(confirm.ref);
  };

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">My Bookings</h1>
          <p className="mt-1 text-sm text-slate-500">
            Track on-hold and reserved seats, or cancel bookings you no longer need.
          </p>
        </div>
        <Link
          to="/"
          className="rounded-btn border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          Book a seat
        </Link>
      </div>

      {(error || loadError) && (
        <p className="mb-4 rounded-card bg-red-50 px-4 py-2 text-sm text-red-700">{error || loadError}</p>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button key={t.key} type="button" onClick={() => setTab(t.key)} className={tabClass(tab === t.key)}>
            {t.label}
            <span className="ml-1.5 text-xs opacity-70">{counts(t.key)}</span>
          </button>
        ))}
      </div>

      {bookings === null ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : shown.length === 0 ? (
        <Card panel pad="6">
          <p className="text-sm text-slate-500">No {STATUS_LABEL[tab].toLowerCase()} bookings.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {shown.map((booking) => (
            <BookingCard
              key={booking.bookingRef}
              booking={booking}
              busy={busy}
              onPay={() => handlePay(booking)}
              onReserve={(method) => handleReserve(booking, method)}
              onCancelGroup={() => setConfirm({ ref: booking.bookingRef, label: "booking" })}
              onCancelTicket={(seatLabel, ticketId) =>
                setConfirm({ ref: booking.bookingRef, ticketId, label: `seat ${seatLabel}` })
              }
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(confirm)}
        title="Cancel booking?"
        message={
          confirm
            ? `This will release ${confirm.label === "booking" ? "all seats in this booking" : confirm.label} and reverse the ticket ledger. This cannot be undone.`
            : ""
        }
        confirmLabel="Yes, cancel"
        busy={busy}
        onConfirm={runConfirm}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}

function BookingCard({
  booking,
  busy,
  onPay,
  onReserve,
  onCancelGroup,
  onCancelTicket,
}: {
  booking: MyBooking;
  busy: boolean;
  onPay: () => void;
  onReserve: (method: "station" | "online") => void;
  onCancelGroup: () => void;
  onCancelTicket: (seatLabel: string, ticketId: string) => void;
}) {
  const [reserving, setReserving] = useState(false);
  const [method, setMethod] = useState<"station" | "online">("station");
  const cancelled = booking.status === "cancelled";
  const held = booking.status === "held";
  const seatsLabel = booking.seats.map((s) => `${s.blc}${s.sna}`).join(", ");
  const canPay = !cancelled && booking.seats.length > 0 && booking.payment === "pending" && !held;
  const reservable = held && booking.seats.length > 0;

  return (
    <Card panel pad="5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-bold text-slate-900">
            {booking.bus ? `${booking.bus.bname} · ${booking.bus.plateNumber}` : "Bus"}
          </div>
          <div className="mt-1 text-sm text-slate-500">
            {booking.route ? `${booking.route.sp} → ${booking.route.fp}` : "Route"} ·{" "}
            {fmtDate(booking.trdate)} {booking.trtime}
          </div>
        </div>
        <div className="text-right">
          <Pill dot={STATUS_DOT[booking.status]}>{STATUS_LABEL[booking.status]}</Pill>
          <div className="mt-1 text-xl font-bold text-slate-900">Rs {booking.totalPrice}</div>
          <Pill dot={PAY_DOT[booking.payment]}>{PAY_LABEL[booking.payment]}</Pill>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
        <div>
          <span className="text-slate-400">Seats</span>
          <div className="font-medium text-slate-800">{seatsLabel}</div>
        </div>
        <div>
          <span className="text-slate-400">Passenger</span>
          <div className="font-medium text-slate-800">
            {booking.tickets[0]?.passengerName || "—"}
            {booking.tickets[0]?.passengerAge != null ? ` (${booking.tickets[0].passengerAge})` : ""}
            {booking.tickets[0]?.passengerPhone ? (
              <span className="ml-1 font-normal text-slate-400">
                · {booking.tickets[0].passengerPhone}
              </span>
            ) : null}
          </div>
        </div>
        <div>
          <span className="text-slate-400">Bus type</span>
          <div className="font-medium text-slate-800">{booking.bus?.busTypeName ?? "—"}</div>
        </div>
        <div>
          <span className="text-slate-400">Booking ref</span>
          <div className="truncate font-mono text-xs text-slate-500">{booking.bookingRef}</div>
        </div>
      </div>

      <div className="mt-3 divide-y divide-slate-100 border-t border-slate-100">
        {booking.seats.map((seat) => (
          <div key={seat.ticketId} className="flex items-center justify-between gap-3 py-2 text-sm">
            <span className="font-semibold text-slate-800">
              {seat.blc}
              {seat.sna}
            </span>
            <span className="flex-1 text-slate-500">
              {seat.passengerName || "—"}
              {seat.passengerPhone ? <span> · {seat.passengerPhone}</span> : null}
            </span>
            <span className="text-slate-700">Rs {seat.price}</span>
            {!cancelled && (
              <button
                type="button"
                disabled={busy}
                onClick={() => onCancelTicket(`${seat.blc}${seat.sna}`, seat.ticketId)}
                className="rounded-btn border border-red-200 px-2 py-0.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                Cancel seat
              </button>
            )}
          </div>
        ))}
      </div>

      {!cancelled && (
        <div className="mt-3 flex flex-col items-end gap-2 border-t border-slate-100 pt-3">
          {reservable && (
            <div className="w-full rounded-card border border-amber-300 bg-amber-50 p-3">
              <p className="text-xs leading-relaxed text-slate-600">
                These seats are on hold — reserve them as soon as possible or they will be
                released and you could lose them.
              </p>
              {reserving ? (
                <>
                  <div className="mt-3 space-y-2">
                    <label className="flex cursor-pointer items-start gap-2 rounded-card border border-brand-200 bg-white px-3 py-2 text-sm hover:bg-brand-50">
                      <input
                        type="radio"
                        name={`method-${booking.bookingRef}`}
                        checked={method === "station"}
                        onChange={() => setMethod("station")}
                        className="mt-1 accent-brand-600"
                      />
                      <span>
                        <span className="font-semibold text-slate-800">Pay at station</span>
                        <span className="block text-xs text-slate-500">
                          Seats become reserved now; pay cash at the counter later.
                        </span>
                      </span>
                    </label>
                    <label className="flex cursor-pointer items-start gap-2 rounded-card border border-brand-200 bg-white px-3 py-2 text-sm hover:bg-brand-50">
                      <input
                        type="radio"
                        name={`method-${booking.bookingRef}`}
                        checked={method === "online"}
                        onChange={() => setMethod("online")}
                        className="mt-1 accent-brand-600"
                      />
                      <span>
                        <span className="font-semibold text-slate-800">Pay online</span>
                        <span className="block text-xs text-slate-500">
                          Reserve now and pay through the online gateway right away.
                        </span>
                      </span>
                    </label>
                  </div>
                  <div className="mt-3 flex justify-end gap-2">
                    <Button
                      size="sm"
                      disabled={busy}
                      onClick={() => onReserve(method)}
                    >
                      {method === "online" ? "Reserve & pay online" : "Reserve seat"}
                    </Button>
                    <Button size="sm" variant="secondary" disabled={busy} onClick={() => setReserving(false)}>
                      Cancel
                    </Button>
                  </div>
                </>
              ) : (
                <div className="mt-2 flex justify-end">
                  <Button size="sm" disabled={busy} onClick={() => setReserving(true)}>
                    Reserve seat
                  </Button>
                </div>
              )}
            </div>
          )}
          <div className="flex gap-2">
            {canPay && (
              <Button variant="secondary" size="sm" disabled={busy} onClick={onPay}>
                Pay now
              </Button>
            )}
            <Button variant="danger" size="sm" disabled={busy} onClick={onCancelGroup}>
              Cancel booking
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
