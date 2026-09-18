import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { bookingsApi, type SearchParams, type SearchOrder } from "../api/bookings";
import { referenceApi } from "../api/reference";
import { serializeError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { todayPlusDays, fmtDate } from "../lib/date";
import type { BookingOffer, BookingResult, OfferSeat, PassengerInput } from "../types";
import { BusIcon, ChevronDownIcon, DashboardIcon, SearchIcon } from "../components/icons";
import OfferCard from "../components/booking/OfferCard";
import TicketDisplay from "../components/booking/TicketDisplay";
import { Legend, SeatMap } from "../components/booking/SeatMap";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import Input from "../components/ui/Input";
import Select from "../components/ui/Select";

const fieldLabel = "block px-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500";
const AMENITIES = ["wifi", "ac", "charging", "recliner", "blanket"];

interface FilterDraft {
  order: SearchOrder | "";
  busType: string[];
  amenities: string[];
  stops: string[];
  minPrice: string;
  maxPrice: string;
  fromTime: string;
  toTime: string;
}

const emptyDraft: FilterDraft = {
  order: "",
  busType: [],
  amenities: [],
  stops: [],
  minPrice: "",
  maxPrice: "",
  fromTime: "",
  toTime: "",
};

export default function BookingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [sp, setSp] = useState("");
  const [fp, setFp] = useState("");
  const [date, setDate] = useState(todayPlusDays(5));
  const [draft, setDraft] = useState<FilterDraft>(emptyDraft);
  const [query, setQuery] = useState<SearchParams | null>(null);

  const [pickedOffer, setPickedOffer] = useState<BookingOffer | null>(null);
  const [pickedSeats, setPickedSeats] = useState<OfferSeat[]>([]);
  const [expandedOffer, setExpandedOffer] = useState<BookingOffer | null>(null);
  const [booking, setBooking] = useState<BookingResult | null>(null);
  const [bookingStep, setBookingStep] = useState<"seats" | "passenger">("seats");
  const [pendingAction, setPendingAction] = useState<"pending" | "confirm">("confirm");
  const [actionError, setActionError] = useState("");
  const [passenger, setPassenger] = useState<{
    name: string;
    phone: string;
    age: string;
    gender: PassengerInput["gender"];
  }>({ name: "", phone: "", age: "", gender: "Male" });

  const locationsQuery = useQuery({
    queryKey: ["locations"],
    queryFn: () => referenceApi.locations().then((res) => [...res.data.locations].sort()),
  });

  const busTypesQuery = useQuery({
    queryKey: ["busTypes"],
    queryFn: () => referenceApi.busTypes().then((res) => res.data.busTypes),
    enabled: Boolean(query),
  });

  const searchQuery = useQuery({
    queryKey: ["offers", query],
    queryFn: () => bookingsApi.search(query!).then((res) => res.data.offers),
    enabled: Boolean(query),
    placeholderData: (previousData) => previousData,
  });

  const bookMutation = useMutation({
    mutationFn: (action: "pending" | "confirm") => {
      if (!pickedOffer || pickedSeats.length === 0) throw new Error("No seat picked");
      if (!passenger.name.trim() || passenger.age === "" || !/^\d{10}$/.test(passenger.phone.trim())) {
        throw new Error("Passenger details are required");
      }
      const payload = {
        arid: pickedOffer.arid,
        sno: pickedSeats.map((s) => s.sno),
        sp: pickedOffer.query.sp,
        fp: pickedOffer.query.fp,
        passenger: {
          name: passenger.name.trim(),
          phone: passenger.phone.trim(),
          age: Number(passenger.age),
          gender: passenger.gender,
        },
      };
      return action === "confirm"
        ? bookingsApi.confirm(payload)
        : bookingsApi.pending(payload);
    },
    onMutate: () => setActionError(""),
    onError: (err) => setActionError(serializeError(err)),
    onSuccess: (res) => {
      setBooking(res.data);
      setBookingStep("seats");
      setPendingAction("confirm");
      void queryClient.invalidateQueries({ queryKey: ["offers"] });
    },
  });

  const buildQuery = (d: FilterDraft): SearchParams | null => {
    if (!sp || !fp || !date) return null;
    const q: SearchParams = { sp, fp, date };
    if (d.order) q.order = d.order;
    if (d.busType.length) q.busType = d.busType;
    if (d.amenities.length) q.amenities = d.amenities;
    if (d.stops.length) q.stops = d.stops;
    if (d.minPrice !== "") q.minPrice = Number(d.minPrice);
    if (d.maxPrice !== "") q.maxPrice = Number(d.maxPrice);
    if (d.fromTime) q.fromTime = d.fromTime;
    if (d.toTime) q.toTime = d.toTime;
    return q;
  };

  const submitSearch = () => {
    if (!sp || !fp || !date) return;
    setDraft(emptyDraft);
    setQuery(buildQuery(emptyDraft));
    setPickedOffer(null);
    setPickedSeats([]);
    setExpandedOffer(null);
    setBooking(null);
    setBookingStep("seats");
    setPendingAction("confirm");
    setActionError("");
  };

  const commitFilters = (next: FilterDraft) => {
    setDraft(next);
    const q = buildQuery(next);
    if (q) {
      setQuery(q);
      setPickedOffer(null);
      setPickedSeats([]);
      setExpandedOffer(null);
      setBooking(null);
      setBookingStep("seats");
      setPendingAction("confirm");
      setActionError("");
    }
  };

  const toggleExpand = (offer: BookingOffer) => {
    if (expandedOffer?.arid === offer.arid) {
      setExpandedOffer(null);
      return;
    }
    setExpandedOffer(offer);
    setPickedOffer(offer);
    setPickedSeats([]);
    setBooking(null);
    setBookingStep("seats");
    setPendingAction("confirm");
    setActionError("");
  };

  const toggleOption = (key: "busType" | "amenities" | "stops", value: string) => {
    const list = draft[key];
    commitFilters({
      ...draft,
      [key]: list.includes(value) ? list.filter((v) => v !== value) : [...list, value],
    });
  };

  const toggleSeat = (offer: BookingOffer, seat: OfferSeat) => {
    if (!user) {
      void navigate("/login");
      return;
    }
    setBooking(null);
    setActionError("");
    if (!pickedOffer || pickedOffer.arid !== offer.arid) {
      setPickedOffer(offer);
      setPickedSeats([seat]);
      setBookingStep("seats");
      setPendingAction("confirm");
      return;
    }
    const removed = pickedSeats.some((s) => s.sno === seat.sno);
    const next = removed ? pickedSeats.filter((s) => s.sno !== seat.sno) : [...pickedSeats, seat];
    setPickedSeats(next);
    if (next.length === 0) setBookingStep("seats");
  };

  const startConfirm = () => {
    setPendingAction("confirm");
    setBookingStep("passenger");
  };

  const startHold = () => {
    setPendingAction("pending");
    setBookingStep("passenger");
  };

  const backToSeats = () => setBookingStep("seats");

  const backFromReceipt = () => {
    setBooking(null);
    setPickedSeats([]);
    setBookingStep("seats");
    setPendingAction("confirm");
    setActionError("");
    void queryClient.invalidateQueries({ queryKey: ["offers"] });
  };

  const offers: BookingOffer[] | null = searchQuery.data ?? null;
  const loading = searchQuery.isFetching;
  const busy = bookMutation.isPending;
  const passengerValid =
    passenger.name.trim().length > 0 &&
    passenger.phone.trim().length === 10 &&
    /^\d{10}$/.test(passenger.phone.trim()) &&
    passenger.age !== "" &&
    Number.isInteger(Number(passenger.age)) &&
    Number(passenger.age) >= 0 &&
    Number(passenger.age) <= 120;
  const errorOf = (e: unknown) => (e ? serializeError(e) : "");
  const error = errorOf(locationsQuery.error) || errorOf(searchQuery.error) || actionError;
  const sortedLocations = locationsQuery.data ?? [];
  const busTypes = busTypesQuery.data ?? [];

  const stopPool = useMemo(() => {
    const set = new Set<string>(draft.stops);
    offers?.forEach((o) => o.route.stops.forEach((s) => set.add(s)));
    return [...set].sort();
  }, [offers, draft.stops]);

  const activeFilterCount =
    (draft.busType.length ? 1 : 0) +
    (draft.amenities.length ? 1 : 0) +
    (draft.stops.length ? 1 : 0) +
    (draft.minPrice !== "" || draft.maxPrice !== "" ? 1 : 0) +
    (draft.fromTime !== "" || draft.toTime !== "" ? 1 : 0) +
    (draft.order !== "" ? 1 : 0);

  const searchActive = Boolean(query);

  return (
    <div className={searchActive ? "flex h-[calc(100dvh-6.5rem)] flex-col" : "mx-auto max-w-4xl"}>
      <Card panel pad={searchActive ? "4" : "6"} className={searchActive ? "shrink-0" : ""}>
        {!searchActive && (
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
        )}

        <form
          className={`${searchActive ? "" : "mt-5"} grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end`}
          onSubmit={(e) => {
            e.preventDefault();
            submitSearch();
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

      {error && (
        <p
          className={
            searchActive
              ? "shrink-0 rounded-card bg-red-50 px-4 py-2 text-sm text-red-700"
              : "mt-4 rounded-card bg-red-50 px-4 py-2 text-sm text-red-700"
          }
        >
          {error}
        </p>
      )}

      {booking && pickedOffer && (
        <div className={searchActive ? "flex-1 overflow-y-auto p-4" : "mt-6"}>
          <TicketDisplay result={booking} offer={pickedOffer} onBack={backFromReceipt} />
        </div>
      )}

      {searchActive && !booking && (
        <div className="flex min-h-0 flex-1">
          <Card pad="4" className="w-56 shrink-0 overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700">Filters</h3>
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={() => commitFilters(emptyDraft)}
                  className="text-xs font-medium text-brand-600 hover:text-brand-700"
                >
                  Reset ({activeFilterCount})
                </button>
              )}
            </div>

            <div className="mt-3 space-y-4">
              {busTypes.length > 0 && (
                <fieldset className="border-b border-slate-100 pb-3">
                  <legend className="pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Bus type
                  </legend>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-slate-600">
                    {busTypes.map((t) => (
                      <label key={t._id} className="inline-flex items-center gap-1">
                        <input
                          type="checkbox"
                          checked={draft.busType.includes(t._id)}
                          onChange={() => toggleOption("busType", t._id)}
                        />
                        {t.name}
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}

              <fieldset className="border-b border-slate-100 pb-3">
                <legend className="pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Amenities
                </legend>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-slate-600">
                  {AMENITIES.map((a) => (
                    <label key={a} className="inline-flex items-center gap-1 capitalize">
                      <input
                        type="checkbox"
                        checked={draft.amenities.includes(a)}
                        onChange={() => toggleOption("amenities", a)}
                      />
                      {a}
                    </label>
                  ))}
                </div>
              </fieldset>

              {stopPool.length > 0 && (
                <fieldset className="border-b border-slate-100 pb-3">
                  <legend className="pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Via stops
                  </legend>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-slate-600">
                    {stopPool.map((s) => (
                      <label key={s} className="inline-flex items-center gap-1">
                        <input
                          type="checkbox"
                          checked={draft.stops.includes(s)}
                          onChange={() => toggleOption("stops", s)}
                        />
                        {s}
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}

              <fieldset className="border-b border-slate-100 pb-3">
                <legend className="pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Price (Rs)
                </legend>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    placeholder="Min"
                    value={draft.minPrice}
                    onChange={(e) => setDraft({ ...draft, minPrice: e.target.value })}
                    className="w-full px-2 py-1 text-sm"
                  />
                  <span className="text-slate-400">–</span>
                  <Input
                    type="number"
                    min={0}
                    placeholder="Max"
                    value={draft.maxPrice}
                    onChange={(e) => setDraft({ ...draft, maxPrice: e.target.value })}
                    className="w-full px-2 py-1 text-sm"
                  />
                </div>
              </fieldset>

              <fieldset>
                <legend className="pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Departure (HH:MM)
                </legend>
                <div className="flex-wrap items-center gap-2">
                  <Input
                    type="time"
                    value={draft.fromTime}
                    onChange={(e) => setDraft({ ...draft, fromTime: e.target.value })}
                    className="w-full px-2 py-1 text-sm"
                  />
                  <span className="text-slate-400">–</span>
                  <Input
                    type="time"
                    value={draft.toTime}
                    onChange={(e) => setDraft({ ...draft, toTime: e.target.value })}
                    className="w-full px-2 py-1 text-sm"
                  />
                </div>
              </fieldset>

              <Button size="sm" className="w-full" onClick={() => commitFilters(draft)} disabled={loading}>
                Apply filters
              </Button>
            </div>
          </Card>

          <div className="flex ml-4 mt-4 min-w-0 flex-1 flex-col overflow-y-auto">
            {loading && !offers && (
              <p className="flex flex-1 items-center justify-center text-sm text-slate-400">
                Searching for buses…
              </p>
            )}
            {offers && expandedOffer && (
              <div className="sticky top-0 z-10 m-auto rounded-card border border-brand-200 bg-white p-4 min-h-[22rem]">
                <div className="flex flex-wrap items-center justify-between gap-3 ">
                  <div className="flex items-center justify-between gap-10 ">
                    <h3 className="text-base font-bold text-slate-900">
                      {expandedOffer.bus.plateNumber}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {expandedOffer.route.sp} <span className="text-slate-400">→</span>{" "}
                      {expandedOffer.route.fp} · {fmtDate(expandedOffer.trdate)}{" "}
                      {expandedOffer.trtime} · Rs {expandedOffer.price}
                    </p>
                    <div>
                      <Legend />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setExpandedOffer(null)}
                    className="rounded-btn border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Close
                  </button>
                </div>
                
                <div className="flex justify-end gap-10 border-t border-slate-100 mt-4 pt-3">
                  <div className="m-auto">
                    <SeatMap
                      offer={expandedOffer}
                      selectedSnos={
                        new Set(
                          (pickedOffer?.arid === expandedOffer.arid ? pickedSeats : []).map((s) => s.sno)
                        )
                      }
                      onPick={(seat) => toggleSeat(expandedOffer, seat)}
                    />
                  </div>
                  {pickedOffer?.arid === expandedOffer.arid && (
                    <div className="rounded-card border border-brand-200 bg-brand-50/70 p-3 pb-0 min-w-[22rem] max-w-[22rem] min-h-[16rem]">
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-brand-200 pb-2">
                        <div>
                          <h3 className="text-base font-bold text-slate-900">Confirm booking</h3>
                          <p className="text-xs text-slate-500">
                            {pickedOffer.bus.bname} · {fmtDate(pickedOffer.trdate)} {pickedOffer.trtime}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-slate-500">
                            {pickedSeats.length} seat{pickedSeats.length === 1 ? "" : "s"}
                          </p>
                          <p className="text-lg font-bold leading-6 text-slate-900">
                            Rs {pickedSeats.length * pickedOffer.price}
                          </p>
                        </div>
                      </div>
                      <div className="m-2 min-h-[8rem]">
                        {bookingStep === "passenger" ? (
                          <div className="mt-2 rounded-card border border-brand-200 bg-white p-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                                Passenger details
                              </h4>
                              <p className="text-[11px] font-semibold text-brand-700">
                                {pickedSeats.length} seat{pickedSeats.length === 1 ? "" : "s"} selected
                              </p>
                            </div>
                            <p className="mt-0.5 text-[11px] text-slate-400">
                              One passenger applies to all selected seats.
                            </p>
                            <div className="mt-2 grid grid-cols-[1fr_5rem] gap-2">
                              <Input
                                placeholder="Full name"
                                value={passenger.name}
                                maxLength={50}
                                onChange={(e) => setPassenger({ ...passenger, name: e.target.value })}
                                className="w-full px-2 py-1 text-sm"
                              />
                              <Input
                                type="number"
                                min={0}
                                max={120}
                                placeholder="Age"
                                value={passenger.age}
                                onChange={(e) => setPassenger({ ...passenger, age: e.target.value })}
                                className="w-full px-2 py-1 text-sm"
                              />
                            </div>
                            <div className="mt-2 grid grid-cols-[1fr_7rem] gap-2">
                              <Input
                                type="tel"
                                inputMode="numeric"
                                maxLength={10}
                                placeholder="Phone (10 digits)"
                                value={passenger.phone}
                                onChange={(e) =>
                                  setPassenger({
                                    ...passenger,
                                    phone: e.target.value.replace(/\D/g, "").slice(0, 10),
                                  })
                                }
                                className="w-full px-2 py-1 text-sm"
                              />
                              <Select
                                value={passenger.gender}
                                onChange={(e) =>
                                  setPassenger({
                                    ...passenger,
                                    gender: e.target.value as PassengerInput["gender"],
                                  })
                                }
                                className="w-full px-2 py-1 text-sm"
                              >
                                <option value="Female">Female</option>
                                <option value="Male">Male</option>
                                <option value="Other">Other</option>
                              </Select>
                            </div>
                          </div>
                        ) : pickedSeats.length > 0 ? (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {pickedSeats.map((s) => (
                              <button
                                key={s.sno}
                                type="button"
                                onClick={() => toggleSeat(pickedOffer, s)}
                                className="inline-flex items-center gap-0.5 rounded-full border border-brand-300 bg-white px-1 py-0.5 text-xs font-semibold text-brand-700 hover:bg-brand-50"
                                title="Remove seat"
                              >
                                {s.blc}{s.sna}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-2 text-sm text-slate-500">
                            Pick a seat from the map to proceed.
                          </p>
                        )}
                      </div>
                      <div className="mt-2 mb-2 flex flex-wrap items-center justify-end gap-2 border-t border-brand-200 pt-2">
                        {bookingStep === "passenger" ? (
                          <>
                            <Button variant="secondary" onClick={backToSeats} disabled={busy}>
                              Edit seats
                            </Button>
                            <Button
                              disabled={busy || pickedSeats.length === 0 || !passengerValid}
                              onClick={() => bookMutation.mutate(pendingAction)}
                            >
                              Confirm
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button disabled={busy || pickedSeats.length === 0} onClick={startConfirm}>
                              Reserve
                            </Button>
                            <Button
                              variant="secondary"
                              disabled={busy || pickedSeats.length === 0}
                              onClick={startHold}
                            >
                              On-hold
                            </Button>
                            <Button variant="secondary" onClick={setPickedSeats.bind(null, [])}>
                              <ChevronDownIcon className="h-4 w-4 rotate-180" /> Cancel
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
            {offers && !expandedOffer && (
              <div>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <BusIcon className="h-4 w-4" />
                    {offers.length === 0
                      ? "Sorry, no bus found for the given route and date."
                      : `${offers.length} bus${offers.length > 1 ? "es" : ""} found`}
                    {loading && <span className="text-slate-400">· Updating…</span>}
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-500">Order by</span>
                    <Select
                      value={draft.order}
                      onChange={(e) => commitFilters({ ...draft, order: e.target.value as SearchOrder | "" })}
                      className="px-2 py-1"
                    >
                      <option value="">Recommended</option>
                      <option value="price">Price: low to high</option>
                      <option value="time">Departure time</option>
                      <option value="arrival">Arrival time</option>
                      <option value="rating">Rating: high to low</option>
                    </Select>
                  </div>
                </div>
                <div className="space-y-4">
                  {offers.map((offer) => (
                    <OfferCard
                      key={String(offer.arid)}
                      offer={offer}
                      expanded={false}
                      onExpand={() => toggleExpand(offer)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}