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

function SeatCell({ seat, blocked, onClick }: { seat: OfferSeat; blocked: boolean; onClick: () => void }) {
  const label = `${seat.blc} ${seat.sna}`;
  return (
    <div className="relative">
      <button
        type="button"
        disabled={blocked}
        aria-label={`Seat ${seat.blc} ${seat.sna}, ${seat.status}`}
        title={seat.status === "reserved" ? "reserved" : seat.status === "held" ? "held" : undefined}
        onClick={onClick}
        className={`flex h-9 min-w-9 items-center justify-center rounded-btn border text-xs font-semibold outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 ${
          SEAT_STYLE[seat.status]
        } ${blocked ? "cursor-not-allowed" : "cursor-pointer"}`}
      >
        {label}
      </button>
      {seat.status === "held" && <HoldBadge lockExpiry={seat.lockExpiry} />}
    </div>
  );
}


export function SeatMap({ offer, onPick }: { offer: BookingOffer; onPick: (seat: OfferSeat) => void }) {
  const seatsBySno = new Map(offer.seats.map((s) => [s.sno, s]));
  return (
    <div className="overflow-x-auto">
      <div
        role="grid"
        aria-label={`Seat map for ${offer.bus.bname} from ${offer.route.sp} to ${offer.route.fp}`}
        className="inline-flex flex-col gap-2"
      >
        {offer.rows.map((row, ri) => (
          <div key={ri} role="row" className="flex items-end gap-2">
            <div role="rowheader" className="w-12 text-[10px] font-semibold uppercase leading-none text-slate-400">
              {row.left ?? ""}
            </div>
            <div role="rowgroup" className="flex flex-wrap gap-1.5">
              {row.seats.map((iter) => {
                const seat = seatsBySno.get(iter + 1)!;
                return (
                  <SeatCell
                    key={seat.sno}
                    seat={seat}
                    blocked={seat.status !== "available"}
                    onClick={() => onPick(seat)}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
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