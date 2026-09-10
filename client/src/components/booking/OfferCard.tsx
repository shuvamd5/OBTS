import type { BookingOffer, OfferSeat } from "../../types";
import { MapPinIcon } from "../icons";
import Card from "../ui/Card";
import { SeatMap } from "./SeatMap";

export default function OfferCard({
  offer,
  canBook,
  onPick,
}: {
  offer: BookingOffer;
  canBook: boolean;
  onPick: (seat: OfferSeat) => void;
}) {
  return (
    <Card pad="5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-lg font-bold text-slate-900">{offer.bname}</div>
          <div className="text-sm text-slate-500">
            {offer.bcd} {offer.bno} · {offer.btype} · {offer.stype} · {offer.nseat} seats
          </div>
          <div className="mt-1 flex items-center gap-1 text-sm text-slate-500">
            <MapPinIcon className="h-3.5 w-3.5" />
            {offer.route.sp} &gt; {offer.route.fp}
            <span className="mx-1 text-slate-300">·</span>
            {offer.trdate} <span className="font-medium text-slate-700">{offer.trtime}</span>
          </div>
        </div>
        <div className="text-right">
          <div className="stat-hero">Rs {offer.price}</div>
          <div className="text-xs text-slate-400">
            seats {offer.nseat} · Empty {offer.counts.E} · Pending {offer.counts.P} · Reserved{" "}
            {offer.counts.R}
          </div>
        </div>
      </div>

      <SeatMap offer={offer} onPick={onPick} />

      {!canBook && <p className="mt-3 text-xs text-slate-400">Login to select a seat and book.</p>}
    </Card>
  );
}