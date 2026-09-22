import { fmtDate } from "../../lib/date";
import type { BookingOffer, BookingResult } from "../../types";
import { BackIcon, PrinterIcon } from "../icons";
import Button from "../ui/Button";

export default function TicketDisplay({
  result,
  offer,
  onBack,
}: {
  result: BookingResult;
  offer: BookingOffer;
  onBack: () => void;
}) {
  const tickets = result.tickets ?? [result.ticket];
  const seatsLabel = tickets.map((t) => `${t.blc}${t.sna}`).join(", ");
  const statusLabel =
    result.ticket.tstatus === "reserved"
      ? "Reserved"
      : result.ticket.tstatus === "cancelled"
        ? "Cancelled"
        : "On-hold";
  const paymentLabel =
    result.ticket.paymentStatus === "paid"
      ? "Paid"
      : result.ticket.paymentStatus === "refunded"
        ? "Refunded"
        : result.ticket.paymentStatus === "failed"
          ? "Failed"
          : "Pending";
  const rows: [string, string][] = [
    ["Name", result.ticket.treby],
    ["Ticket code", result.ticket._id],
    ["Bus name", result.bus.bname],
    ["Plate number", result.bus.plateNumber],
    ["Bus type", result.bus.busType?.name ?? "—"],
    ["Travel", `${offer.query.sp} > ${offer.query.fp}`],
    ["date and time", `${fmtDate(offer.trdate)} ${offer.trtime}`],
    ["Seats", seatsLabel],
    ["Total price", `Rs ${result.price}`],
    ["Seat status", statusLabel],
    ["Payment", paymentLabel],
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