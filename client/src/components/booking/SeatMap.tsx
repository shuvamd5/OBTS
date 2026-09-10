import type { BookingOffer, OfferSeat } from "../../types";

const SEAT_STYLE: Record<string, string> = {
  E: "border-slate-300 bg-white text-slate-700 hover:bg-brand-50",
  R: "border-red-600 bg-red-600 text-white",
  P: "border-amber-500 bg-amber-400 text-slate-800",
};

function SeatCell({
  seat,
  blocked,
  onClick,
}: {
  seat: OfferSeat;
  blocked: boolean;
  onClick: () => void;
}) {
  const label = `${seat.blc} ${seat.sna}`;
  return (
    <button
      type="button"
      disabled={blocked}
      title={seat.status === "R" ? "reserved" : seat.status === "P" ? "pending" : undefined}
      onClick={onClick}
      className={`flex h-9 min-w-9 items-center justify-center rounded-btn border text-xs font-semibold ${
        SEAT_STYLE[seat.status]
      } ${blocked ? "cursor-not-allowed" : "cursor-pointer"}`}
    >
      {label}
    </button>
  );
}

export function SeatMap({ offer, onPick }: { offer: BookingOffer; onPick: (seat: OfferSeat) => void }) {
  const seatsBySno = new Map(offer.seats.map((s) => [s.sno, s]));
  return (
    <div className="overflow-x-auto">
      <div className="inline-flex flex-col gap-2">
        {offer.rows.map((row, ri) => (
          <div key={ri} className="flex items-end gap-2">
            <div className="w-12 text-[10px] font-semibold uppercase leading-none text-slate-400">
              {row.left ?? ""}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {row.seats.map((iter) => {
                const seat = seatsBySno.get(iter + 1)!;
                return (
                  <SeatCell
                    key={seat.sno}
                    seat={seat}
                    blocked={seat.status !== "E"}
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
        <span className="inline-block h-4 w-4 rounded border border-slate-300 bg-white" /> Empty
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-4 w-4 rounded bg-red-600" /> Reserved
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-4 w-4 rounded bg-amber-400" /> Pending
      </span>
    </div>
  );
}