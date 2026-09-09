import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { bookingsApi } from "../api/bookings";
import { referenceApi } from "../api/reference";
import { serializeError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { todayPlusDays } from "../lib/date";
import type { BookingOffer, BookingResult, OfferSeat } from "../types";

function Icon({ path, className = "h-4 w-4" }: { path: string; className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d={path} />
    </svg>
  );
}

const BusIcon = ({ className }: { className?: string }) => (
  <Icon className={className} path="M4 16V8a3 3 0 013-3h10a3 3 0 013 3v8m-16 0h16m-16 0a1 1 0 01-1 1H4a1 1 0 01-1-1v-1m16 0a1 1 0 011 1v1a1 1 0 01-1 1h-1m-14-2v2a1 1 0 001 1h1m10-3v2a1 1 0 01-1 1h-1M7 12h.01M17 12h.01" />
);
const MapPinIcon = ({ className }: { className?: string }) => (
  <Icon className={className} path="M12 21s-7-6.2-7-11a7 7 0 1114 0c0 4.8-7 11-7 11zm0-8.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
);
const SearchIcon = ({ className }: { className?: string }) => (
  <Icon className={className} path="M21 21l-4.35-4.35m0 0A7.5 7.5 0 105.4 5.4 7.5 7.5 0 0016.65 16.65z" />
);
const PrinterIcon = ({ className }: { className?: string }) => (
  <Icon className={className} path="M6 9V3h12v6M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2m-12 0h12v3a2 2 0 01-2 2H8a2 2 0 01-2-2v-3z" />
);
const BackIcon = ({ className }: { className?: string }) => (
  <Icon className={className} path="M3 12h18M13 6l-6 6 6 6" />
);
const ChevronDownIcon = ({ className }: { className?: string }) => (
  <Icon className={className} path="M6 9l6 6 6-6" />
);
const DashboardIcon = ({ className }: { className?: string }) => (
  <Icon className={className} path="M3 4h8v8H3V4zm10 0h8v5h-8V4zM3 14h8v6H3v-6zm10 0h8v6h-8v-6z" />
);

const SEAT_STYLE: Record<string, string> = {
  E: "border-slate-300 bg-white text-slate-700 hover:bg-blue-50",
  R: "border-red-600 bg-red-600 text-white",
  P: "border-yellow-500 bg-yellow-400 text-slate-800",
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
      className={`flex h-9 min-w-9 items-center justify-center rounded-md border text-xs font-semibold ${
        SEAT_STYLE[seat.status]
      } ${blocked ? "cursor-not-allowed" : "cursor-pointer"}`}
    >
      {label}
    </button>
  );
}

function SeatMap({ offer, onPick }: { offer: BookingOffer; onPick: (seat: OfferSeat) => void }) {
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

function OfferCard({
  offer,
  canBook,
  onPick,
}: {
  offer: BookingOffer;
  canBook: boolean;
  onPick: (seat: OfferSeat) => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-lg font-bold text-slate-800">{offer.bname}</div>
          <div className="text-sm text-slate-500">
            {offer.bcd} {offer.bno} · {offer.btype} · {offer.stype} · {offer.nseat} seats
          </div>
          <div className="mt-1 flex items-center gap-1 text-sm text-slate-500">
            <MapPinIcon className="h-3.5 w-3.5" />
            {offer.route.sp} &gt; {offer.route.fp}
            <span className="mx-1 text-slate-300">·</span>
            {offer.trdate} {offer.trtime}
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-blue-600">Rs {offer.price}</div>
          <div className="text-xs text-slate-400">
            seats {offer.nseat} · Empty {offer.counts.E} · Pending {offer.counts.P} · Reserved{" "}
            {offer.counts.R}
          </div>
        </div>
      </div>

      <SeatMap offer={offer} onPick={onPick} />

      {!canBook && <p className="mt-3 text-xs text-slate-400">Login to select a seat and book.</p>}
    </div>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-4 w-4 rounded border border-slate-300 bg-white" /> Empty
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-4 w-4 rounded bg-red-600" /> Reserved
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-4 w-4 rounded bg-yellow-400" /> Pending
      </span>
    </div>
  );
}

function TicketDisplay({
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
    ["Num plate", result.bus.bcd],
    ["type", result.bus.btype],
    ["seat type", result.bus.stype],
    ["Travel", `${offer.query.sp} > ${offer.query.fp}`],
    ["date and time", `${offer.trdate} ${offer.trtime}`],
    ["Seat no", `${seat.blc} ${seat.sna}`],
    ["Price", `Rs ${result.price}`],
    ["Seat status", result.ticket.tstatus === "R" ? "Reserved" : "Pending"],
    ["Payment", result.ticket.payment],
  ];
  return (
    <div className="mx-auto max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="mb-3 text-center text-lg font-bold text-slate-800">{result.message}</h3>
      <div className="divide-y divide-slate-100 border-y border-slate-200">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between py-1.5 text-sm">
            <span className="text-slate-500">{k}</span>
            <span className="font-medium text-slate-800">{v}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 flex justify-center gap-3">
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          <PrinterIcon className="h-4 w-4" /> Print
        </button>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-100"
        >
          <BackIcon className="h-4 w-4" /> Back
        </button>
      </div>
      <p className="mt-4 text-center text-xs leading-relaxed text-slate-400">
        Thank you for choosing OBTS - please arrive at the bus station 10-15 min before departure.
        Payment is taken at the time of departure. Thank you!
      </p>
    </div>
  );
}

export default function BookingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [locations, setLocations] = useState<string[]>([]);
  const [sp, setSp] = useState("");
  const [fp, setFp] = useState("");
  const [date, setDate] = useState(todayPlusDays(5));
  const [order, setOrder] = useState<"price" | "time" | undefined>(undefined);

  const [offers, setOffers] = useState<BookingOffer[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [picked, setPicked] = useState<{ offer: BookingOffer; seat: OfferSeat } | null>(null);
  const [booking, setBooking] = useState<BookingResult | null>(null);
  const [busy, setBusy] = useState(false);

  const sortedLocations = useMemo(() => [...locations].sort(), [locations]);

  useEffect(() => {
    referenceApi
      .locations()
      .then((res) => setLocations(res.data.locations))
      .catch((err) => setError(serializeError(err)));
  }, []);

  const search = async (orderOverride?: "price" | "time") => {
    if (!sp || !fp || !date) return;
    setLoading(true);
    setError("");
    setOffers(null);
    setPicked(null);
    setBooking(null);
    try {
      const res = await bookingsApi.search({ sp, fp, date, order: orderOverride ?? order });
      setOffers(res.data.offers);
    } catch (err) {
      setError(serializeError(err));
    } finally {
      setLoading(false);
    }
  };

  const book = async (action: "pending" | "confirm") => {
    if (!picked) return;
    setBusy(true);
    setError("");
    try {
      const res =
        action === "confirm"
          ? await bookingsApi.confirm({
              arid: picked.offer.arid,
              sno: picked.seat.sno,
              sp: picked.offer.query.sp,
              fp: picked.offer.query.fp,
            })
          : await bookingsApi.pending({
              arid: picked.offer.arid,
              sno: picked.seat.sno,
              sp: picked.offer.query.sp,
              fp: picked.offer.query.fp,
            });
      setBooking(res.data);
    } catch (err) {
      setError(serializeError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <section className="rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 p-8 text-white shadow-lg">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Welcome{user ? `, ${user.uname}` : " to OBTS"}</h1>
            <p className="mt-1 text-sm text-blue-100">
              Search a route, pick a seat, and book. Seats are held on-hold or reserved instantly.
            </p>
          </div>
          {user && (
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2 rounded-lg border border-white/30 bg-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/20"
            >
              <DashboardIcon className="h-3.5 w-3.5" /> Dashboard
            </Link>
          )}
        </div>

        <form
          className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]"
          onSubmit={(e) => {
            e.preventDefault();
            void search();
          }}
        >
          <div className="rounded-lg bg-white/10 p-2">
            <label className="block px-1 text-[10px] font-semibold uppercase tracking-wider text-blue-200">
              Leaving from
            </label>
            <select
              value={sp}
              onChange={(e) => setSp(e.target.value)}
              required
              className="w-full bg-transparent py-1 font-medium text-white outline-none [&>option]:text-slate-900"
            >
              <option value="">-- SELECT STARTING LOCATION --</option>
              {sortedLocations.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
          </div>
          <div className="rounded-lg bg-white/10 p-2">
            <label className="block px-1 text-[10px] font-semibold uppercase tracking-wider text-blue-200">
              Going to
            </label>
            <select
              value={fp}
              onChange={(e) => setFp(e.target.value)}
              required
              className="w-full bg-transparent py-1 font-medium text-white outline-none [&>option]:text-slate-900"
            >
              <option value="">-- SELECT FINAL LOCATION --</option>
              {sortedLocations.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
          </div>
          <div className="rounded-lg bg-white/10 p-2">
            <label className="block px-1 text-[10px] font-semibold uppercase tracking-wider text-blue-200">
              Date
            </label>
            <input
              type="date"
              value={date}
              min={todayPlusDays(0)}
              onChange={(e) => setDate(e.target.value)}
              required
              className="w-full bg-transparent py-1 font-medium text-white outline-none [&::-webkit-calendar-picker-indicator]:invert"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-6 py-2 font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-60"
          >
            <SearchIcon className="h-4 w-4" />
            {user ? "Book" : "View"}
          </button>
        </form>
      </section>

      {error && <p className="mt-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}

      {loading && <p className="mt-6 text-sm text-slate-400">Searching for buses…</p>}

      {picked &&
        (booking ? (
          <div className="mt-6">
            <TicketDisplay
              result={booking}
              offer={picked.offer}
              seat={picked.seat}
              onBack={() => setBooking(null)}
            />
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-bold text-slate-800">Confirm booking</h3>
            <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
              <span className="text-slate-500">Bus</span>
              <span className="font-medium">
                {picked.offer.bname} ({picked.offer.bcd} {picked.offer.bno})
              </span>
              <span className="text-slate-500">Travel</span>
              <span className="font-medium">
                {picked.offer.query.sp} &gt; {picked.offer.query.fp} · {picked.offer.trdate}{" "}
                {picked.offer.trtime}
              </span>
              <span className="text-slate-500">Seat</span>
              <span className="font-medium">
                {picked.seat.blc} {picked.seat.sna}
              </span>
              <span className="text-slate-500">Price</span>
              <span className="font-bold text-blue-600">Rs {picked.offer.price}</span>
              <span className="text-slate-500">Booked by</span>
              <span className="font-medium">{user?.uname}</span>
            </div>
            <div className="mt-4 flex justify-center gap-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => void book("confirm")}
                className="rounded-lg bg-green-600 px-5 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
              >
                Reserve
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void book("pending")}
                className="rounded-lg bg-yellow-500 px-5 py-2 text-sm font-semibold text-slate-900 hover:bg-yellow-600 disabled:opacity-50"
              >
                On-hold
              </button>
              <button
                type="button"
                onClick={() => setPicked(null)}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-100"
              >
                <ChevronDownIcon className="h-4 w-4 rotate-180" /> Cancel
              </button>
            </div>
          </div>
        ))}

      {offers && !picked && (
        <div className="mt-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <BusIcon className="h-4 w-4" />
              {offers.length === 0
                ? "Sorry, no bus found for the given route and date."
                : `${offers.length} bus${offers.length > 1 ? "es" : ""} found`}
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500">Order by:</span>
              <button
                type="button"
                onClick={() => {
                  setOrder("price");
                  void search("price");
                }}
                className="rounded-lg border border-slate-300 px-3 py-1 font-medium hover:bg-slate-100"
              >
                Price
              </button>
              <button
                type="button"
                onClick={() => {
                  setOrder("time");
                  void search("time");
                }}
                className="rounded-lg border border-slate-300 px-3 py-1 font-medium hover:bg-slate-100"
              >
                Time
              </button>
            </div>
          </div>
          {offers.length > 0 && <Legend />}
          <div className="mt-3 space-y-4">
            {offers.map((offer) => (
              <OfferCard
                key={String(offer.arid)}
                offer={offer}
                canBook={Boolean(user)}
                onPick={(seat) => {
                  if (!user) {
                    void navigate("/login");
                    return;
                  }
                  setBooking(null);
                  setPicked({ offer, seat });
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
