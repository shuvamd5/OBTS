import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { bookingsApi } from "../api/bookings";
import { referenceApi } from "../api/reference";
import { serializeError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { todayPlusDays } from "../lib/date";
import type { BookingOffer, BookingResult, OfferSeat } from "../types";
import { BusIcon, ChevronDownIcon, DashboardIcon, SearchIcon } from "../components/icons";
import OfferCard from "../components/booking/OfferCard";
import TicketDisplay from "../components/booking/TicketDisplay";
import { Legend } from "../components/booking/SeatMap";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import Input from "../components/ui/Input";
import Select from "../components/ui/Select";

const fieldLabel = "block px-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500";

export default function BookingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [sp, setSp] = useState("");
  const [fp, setFp] = useState("");
  const [date, setDate] = useState(todayPlusDays(5));
  const [order, setOrder] = useState<"price" | "time" | undefined>(undefined);
  const [query, setQuery] = useState<{
    sp: string;
    fp: string;
    date: string;
    order?: "price" | "time";
  } | null>(null);

  const [picked, setPicked] = useState<{ offer: BookingOffer; seat: OfferSeat } | null>(null);
  const [booking, setBooking] = useState<BookingResult | null>(null);
  const [actionError, setActionError] = useState("");

  const locationsQuery = useQuery({
    queryKey: ["locations"],
    queryFn: () => referenceApi.locations().then((res) => [...res.data.locations].sort()),
  });

  const searchQuery = useQuery({
    queryKey: ["offers", query?.sp, query?.fp, query?.date, query?.order],
    queryFn: () =>
      bookingsApi
        .search({
          sp: query!.sp,
          fp: query!.fp,
          date: query!.date,
          order: query!.order,
        })
        .then((res) => res.data.offers),
    enabled: Boolean(query),
  });

  const bookMutation = useMutation({
    mutationFn: (action: "pending" | "confirm") => {
      if (!picked) throw new Error("No seat picked");
      const payload = {
        arid: picked.offer.arid,
        sno: picked.seat.sno,
        sp: picked.offer.query.sp,
        fp: picked.offer.query.fp,
      };
      return action === "confirm"
        ? bookingsApi.confirm(payload)
        : bookingsApi.pending(payload);
    },
    onMutate: () => setActionError(""),
    onError: (err) => setActionError(serializeError(err)),
    onSuccess: (res) => setBooking(res.data),
  });

  const runSearch = (orderOverride?: "price" | "time") => {
    if (!sp || !fp || !date) return;
    setQuery({ sp, fp, date, order: orderOverride ?? order });
    setPicked(null);
    setBooking(null);
    setActionError("");
  };

  const offers = searchQuery.data ?? null;
  const loading = searchQuery.isFetching;
  const busy = bookMutation.isPending;
  const errorOf = (e: unknown) => (e ? serializeError(e) : "");
  const error = errorOf(locationsQuery.error) || errorOf(searchQuery.error) || actionError;
  const sortedLocations = locationsQuery.data ?? [];

  return (
    <div className="mx-auto max-w-4xl">
      <Card panel pad="6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              {user ? `Welcome, ${user.uname}` : "Where are you going?"}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Search a route, pick a seat, and book. Seats are held on-hold or reserved instantly.
            </p>
          </div>
          {user && (
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2 rounded-btn border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <DashboardIcon className="h-3.5 w-3.5" /> Dashboard
            </Link>
          )}
        </div>

        <form
          className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            runSearch();
          }}
        >
          <div>
            <label className={fieldLabel}>From</label>
            <Select value={sp} onChange={(e) => setSp(e.target.value)} className="w-full" required>
              <option value="">Select starting location</option>
              {sortedLocations.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className={fieldLabel}>To</label>
            <Select value={fp} onChange={(e) => setFp(e.target.value)} className="w-full" required>
              <option value="">Select final location</option>
              {sortedLocations.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className={fieldLabel}>Date</label>
            <Input
              type="date"
              value={date}
              min={todayPlusDays(0)}
              onChange={(e) => setDate(e.target.value)}
              className="w-full"
              required
            />
          </div>
          <Button type="submit" disabled={loading}>
            <SearchIcon className="h-4 w-4" />
            {user ? "Book" : "View"}
          </Button>
        </form>
      </Card>

      {error && <p className="mt-4 rounded-card bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}

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
          <div className="mt-6 rounded-panel border border-slate-200 bg-white p-6 shadow-pop">
            <h3 className="text-lg font-bold text-slate-900">Confirm booking</h3>
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
              <span className="font-semibold text-slate-900">Rs {picked.offer.price}</span>
              <span className="text-slate-500">Booked by</span>
              <span className="font-medium">{user?.uname}</span>
            </div>
            <div className="mt-4 flex justify-center gap-3">
              <Button disabled={busy} onClick={() => bookMutation.mutate("confirm")}>
                Reserve
              </Button>
              <Button variant="secondary" disabled={busy} onClick={() => bookMutation.mutate("pending")}>
                On-hold
              </Button>
              <Button variant="secondary" onClick={() => setPicked(null)}>
                <ChevronDownIcon className="h-4 w-4 rotate-180" /> Cancel
              </Button>
            </div>
          </div>
        ))}

      {offers && !loading && !picked && (
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
                  runSearch("price");
                }}
                className="rounded-btn border border-slate-300 px-3 py-1 font-medium text-slate-700 hover:bg-slate-100"
              >
                Price
              </button>
              <button
                type="button"
                onClick={() => {
                  setOrder("time");
                  runSearch("time");
                }}
                className="rounded-btn border border-slate-300 px-3 py-1 font-medium text-slate-700 hover:bg-slate-100"
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