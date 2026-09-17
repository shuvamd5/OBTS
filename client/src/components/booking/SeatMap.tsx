import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { BookingOffer, OfferSeat } from "../../types";

const SEAT_STYLE: Record<string, string> = {
  available: "border-slate-300 bg-white text-slate-700 hover:bg-brand-50",
  reserved: "border-red-600 bg-red-600 text-white",
  held: "border-amber-500 bg-amber-400 text-slate-800",
};

function HoldBadge({ lockExpiry }: { lockExpiry: string | null | undefined }) {
  const queryClient = useQueryClient();
  const [now, setNow] = useState(() => Date.now());
  const firedRef = useRef(false);

  useEffect(() => {
    if (!lockExpiry) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [lockExpiry]);

  const msLeft = lockExpiry ? new Date(lockExpiry).getTime() - now : 0;

  useEffect(() => {
    if (lockExpiry && msLeft <= 0 && !firedRef.current) {
      firedRef.current = true;
      void queryClient.invalidateQueries({ queryKey: ["offers"] });
    }
  }, [lockExpiry, msLeft, queryClient]);

  if (!lockExpiry) return null;
  const total = Math.max(0, Math.floor(msLeft / 1000));
  const mm = String(Math.floor(total / 60)).padStart(2, "0");
  const ss = String(total % 60).padStart(2, "0");
  return (
    <span className="pointer-events-none absolute -top-1.5 right-0 rounded bg-amber-500 px-1 text-[8px] font-bold leading-tight text-white">
      {mm}:{ss}
    </span>
  );
}

function SeatCell({
  seat,
  blocked,
  selected,
  onClick,
}: {
  seat: OfferSeat;
  blocked: boolean;
  selected: boolean;
  onClick: () => void;
}) {
  const label = `${seat.blc}${seat.sna}`;
  return (
    <div className="relative aspect-square w-full">
      <button
        type="button"
        disabled={blocked}
        aria-label={`Seat ${seat.blc}${seat.sna}, ${seat.status}`}
        title={seat.status === "reserved" ? "reserved" : seat.status === "held" ? "held" : undefined}
        onClick={onClick}
        aria-pressed={selected}
        className={`flex h-full w-full items-center justify-center rounded-btn border text-[15px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 ${
          selected
            ? "border-brand-500 bg-brand-100 text-brand-700 ring-2 ring-brand-400"
            : SEAT_STYLE[seat.status]
        } ${blocked ? "cursor-not-allowed" : "cursor-pointer"}`}
      >
        {label}
      </button>
      {seat.status === "held" && <HoldBadge lockExpiry={seat.lockExpiry} />}
    </div>
  );
}


export function SeatMap({
  offer,
  selectedSnos,
  onPick,
}: {
  offer: BookingOffer;
  selectedSnos: Set<number>;
  onPick: (seat: OfferSeat) => void;
}) {
  const seatsBySno = new Map(offer.seats.map((s) => [s.sno, s]));
  const maxSeats = Math.max(...offer.rows.map((r) => r.seats.length));
  return (
    <div
      role="grid"
      aria-label={`Seat map for ${offer.bus.bname} from ${offer.route.sp} to ${offer.route.fp}`}
      className="mx-auto w-full max-w-[22rem] space-y-1.5"
    >
      {offer.rows.map((row, ri) => {
        const corridor = row.left === "Corridor";
        const pads = corridor ? maxSeats - row.seats.length : 0;
        return (
          <div
            key={ri}
            role="row"
            className="grid items-stretch gap-1"
            style={{ gridTemplateColumns: `3rem repeat(${maxSeats}, minmax(0, 1fr))` }}
          >
            <div
              role="rowheader"
              className={
                corridor
                  ? "flex items-center"
                  : "flex items-center text-[12px] font-semibold uppercase leading-none tracking-wide text-slate-400"
              }
            >
              {corridor ? "" : (row.left ?? "")}
            </div>
            {Array.from({ length: maxSeats }).map((_, col) => {
              const iter = row.seats[col - pads];
              if (iter === undefined) {
                if (corridor && col === 0) {
                  return (
                    <div
                      key="corridor"
                      aria-hidden
                      className="flex items-center justify-center text-[12px] font-semibold uppercase tracking-[0.3em] text-slate-500"
                      style={{ gridColumn: `2 / ${maxSeats + 1}` }}
                    >
                      {row.left}
                    </div>
                  );
                }
                if (corridor) return null;
                return <div key={`gap-${col}`} aria-hidden />;
              }
              const seat = seatsBySno.get(iter + 1)!;
              return (
                <SeatCell
                  key={seat.sno}
                  seat={seat}
                  blocked={seat.status !== "available"}
                  selected={selectedSnos.has(seat.sno)}
                  onClick={() => onPick(seat)}
                />
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

export function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-4 w-4 rounded border border-slate-300 bg-white" /> Available
      </span>
            <span className="flex items-center gap-1.5">
        <span className="inline-block h-4 w-4 rounded bg-amber-400" /> Held
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-4 w-4 rounded bg-red-600" /> Reserved
      </span>

    </div>
  );
}