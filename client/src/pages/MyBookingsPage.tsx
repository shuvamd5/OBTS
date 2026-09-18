import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { bookingsApi } from "../api/bookings";
import { serializeError } from "../api/client";
import { fmtDate } from "../lib/date";
import type { MyBooking, TicketStatus } from "../types";
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

export default function MyBookingsPage() {
  const queryClient = useQueryClient();
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

  const busy = groupCancel.isPending || ticketCancel.isPending;
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
  onCancelGroup,
  onCancelTicket,
}: {
  booking: MyBooking;
  busy: boolean;
  onCancelGroup: () => void;
  onCancelTicket: (seatLabel: string, ticketId: string) => void;
}) {
  const cancelled = booking.status === "cancelled";
  const seatsLabel = booking.seats.map((s) => `${s.blc}${s.sna}`).join(", ");

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
          <div className="text-xs text-slate-500">Payment: {booking.payment}</div>
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
            <span className="flex-1 text-slate-500">{seat.passengerName || "—"}</span>
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
        <div className="mt-3 flex justify-end border-t border-slate-100 pt-3">
          <Button variant="danger" size="sm" disabled={busy} onClick={onCancelGroup}>
            Cancel booking
          </Button>
        </div>
      )}
    </Card>
  );
}
