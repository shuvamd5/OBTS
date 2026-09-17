import type { KeyboardEvent } from "react";
import type { BookingOffer } from "../../types";
import Card from "../ui/Card";
import { ChevronDownIcon } from "../icons";

export default function OfferCard({
  offer,
  expanded,
  onExpand,
}: {
  offer: BookingOffer;
  expanded: boolean;
  onExpand: () => void;
}) {
  const rating = offer.bus.rating > 0 ? `★ ${offer.bus.rating.toFixed(1)}` : null;

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onExpand();
    }
  };

  return (
    <Card
      role="button"
      tabIndex={0}
      aria-expanded={expanded}
      onClick={onExpand}
      onKeyDown={handleKeyDown}
      className={`cursor-pointer select-none transition-shadow hover:shadow-md ${
        expanded ? "border-brand-300 ring-2 ring-brand-200" : ""
      }`}
    >
      <div className="flex items-center gap-4">
        <div className="w-14 shrink-0 text-center">
          <p className="text-base font-bold leading-5 text-slate-900">{offer.trtime}</p>
          {offer.arrival && (
            <p className="mt-0.5 text-xs leading-4 text-slate-500">Arr {offer.arrival}</p>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-sm font-semibold text-slate-900">{offer.bus.bname}</p>
            {rating && <span className="shrink-0 text-xs text-amber-500">{rating}</span>}
          </div>
          <p className="truncate text-xs text-slate-500">
            {offer.bus.busType?.name ?? "—"} · {offer.bus.plateNumber}
          </p>
        </div>

        <div className="shrink-0 text-right">
          <p className="text-base font-bold leading-5 text-slate-900">Rs {offer.price}</p>
          <p className="text-xs text-emerald-600">
            {offer.counts.available} seat{offer.counts.available === 1 ? "" : "s"} left
          </p>
        </div>

        <ChevronDownIcon
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </div>
    </Card>
  );
}