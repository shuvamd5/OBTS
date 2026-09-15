import type { BookingOffer, BookingResult, OfferSeat } from "../../types";
import { BackIcon, PrinterIcon } from "../icons";
import Button from "../ui/Button";

export default function TicketDisplay({
  result,
  offer,
  seat,
  onBack,
}: {
  result: BookingResult;
  offer: BookingOffer;
  seat: OfferSeat;
  onBack: () => void;
}) {
  const rows: [string, string][] = [
    ["Name", result.ticket.treby],
    ["Bus name", result.bus.bname],
    ["Plate number", result.bus.plateNumber],
    ["Bus type", result.bus.busType?.name ?? "—"],
    ["Seats", result.bus.busType ? String(result.bus.busType.seatCount) : "—"],
    ["Travel", `${offer.query.sp} > ${offer.query.fp}`],
    ["date and time", `${offer.trdate} ${offer.trtime}`],
    ["Seat no", `${seat.blc} ${seat.sna}`],
    ["Price", `Rs ${result.price}`],
    ["Seat status", result.ticket.tstatus === "R" ? "Reserved" : "Pending"],
    ["Payment", result.ticket.payment],
  ];
  return (
    <div className="mx-auto max-w-sm rounded-panel border border-slate-200 bg-white p-6">
      <h3 className="mb-3 text-center text-lg font-bold text-slate-900">{result.message}</h3>
      <div className="divide-y divide-slate-100 border-y border-slate-200">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between py-1.5 text-sm">
            <span className="text-slate-500">{k}</span>
            <span className="font-medium text-slate-800">{v}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 flex justify-center gap-3">
        <Button type="button" onClick={() => window.print()}>
          <PrinterIcon className="h-4 w-4" /> Print
        </Button>
        <Button variant="secondary" onClick={onBack}>
          <BackIcon className="h-4 w-4" /> Back
        </Button>
      </div>
      <p className="mt-4 text-center text-xs leading-relaxed text-slate-400">
        Thank you for choosing eYatra — please arrive at the bus station 10–15 min before departure.
        Payment is taken at the time of departure.
      </p>
    </div>
  );
}