import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { schedulesApi } from "../api/schedules";
import { busesApi } from "../api/buses";
import { routesApi } from "../api/routes";
import { pricesApi } from "../api/prices";
import { serializeError } from "../api/client";
import { todayPlusDays } from "../lib/date";
import type { Bus, Route } from "../types";

const inputClass =
  "rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none";

const highestCheckpointFare = (route?: Route) =>
  (route?.checkpoints ?? []).reduce((max, c) => Math.max(max, c.price), 0);

export default function AddSchedulePage() {
  const [buses, setBuses] = useState<Bus[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);

  const [bid, setBid] = useState("");
  const [trdate, setTrdate] = useState("");
  const [trtime, setTrtime] = useState("");
  const [rid, setRid] = useState("");
  const [price, setPrice] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  const minDate = todayPlusDays(4);
  const selectedRoute = useMemo(() => routes.find((r) => r._id === rid), [routes, rid]);
  const minFare = highestCheckpointFare(selectedRoute);

  useEffect(() => {
    Promise.all([busesApi.list(), routesApi.list()])
      .then(([b, r]) => {
        setBuses(b.data.buses);
        setRoutes(r.data.routes);
      })
      .catch(() => setError("Failed to load buses or routes"))
      .finally(() => setLoading(false));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!bid || !trdate || !trtime) {
      setError("Bus, travelling date, and time are required.");
      return;
    }
    if (rid && (price === "" || Number(price) <= 0)) {
      setError("When a route is selected, a valid fare is required.");
      return;
    }
    if (rid && Number(price) <= minFare) {
      setError(`Fare must be greater than the highest checkpoint fare (Rs. ${minFare}).`);
      return;
    }

    setBusy(true);
    setError("");
    setMsg("");
    try {
      const { data } = await schedulesApi.create({ bid, trdate, trtime });
      if (rid && price !== "") {
        await pricesApi.assign({ bsid: data.schedule._id, rid, price: Number(price) });
        setMsg("Schedule and fare added. Add another below.");
      } else {
        setMsg("Schedule added (no fare). Add another below.");
      }
      setBid("");
      setTrdate("");
      setTrtime("");
      setRid("");
      setPrice("");
    } catch (err) {
      setError(serializeError(err));
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl">
        <p className="text-slate-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-blue-600">Add Schedule</h1>
        <Link className="text-blue-600 underline" to="/schedules">
          ← View Schedules
        </Link>
      </div>

      {error && <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}
      {msg && <div className="mb-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-600">{msg}</div>}

      <form onSubmit={submit} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="font-semibold text-slate-800">Schedule Details</h2>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <div>
            <label className="block text-[11px] font-medium text-slate-400">Bus</label>
            <select value={bid} onChange={(e) => setBid(e.target.value)} className={inputClass}>
              <option value="">Select bus...</option>
              {buses.map((b) => (
                <option key={b._id} value={b._id}>
                  {b.bcd} {b.bno} — {b.bname}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-400">Travelling date</label>
            <input
              type="date"
              min={minDate}
              value={trdate}
              onChange={(e) => setTrdate(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-400">Time</label>
            <input
              type="time"
              value={trtime}
              onChange={(e) => setTrtime(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        <h2 className="mt-5 font-semibold text-slate-800">Route + Fare (optional)</h2>
        <p className="mt-1 text-xs text-slate-400">
          You can skip this and assign a route later from the schedules page.
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <div>
            <label className="block text-[11px] font-medium text-slate-400">Route</label>
            <select value={rid} onChange={(e) => { setRid(e.target.value); setPrice(""); }} className={inputClass}>
              <option value="">No route (add later)</option>
              {routes.map((r) => (
                <option key={r._id} value={r._id}>
                  {r.sp} → {r.fp}
                </option>
              ))}
            </select>
          </div>
          {rid && (
            <div>
              <label className="block text-[11px] font-medium text-slate-400">Fare (Rs.)</label>
              <input
                type="number"
                min="0"
                step="1"
                placeholder="fare"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className={`${inputClass} w-28`}
              />
            </div>
          )}
        </div>
        {selectedRoute && (
          <p className="mt-2 text-xs text-slate-500">
            {minFare > 0
              ? `Fare must be greater than the highest checkpoint fare on this route (Rs. ${minFare}).`
              : "This route has no checkpoints yet — any reasonable fare is allowed."}
          </p>
        )}

        <div className="mt-5">
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {busy ? "Adding..." : "Add schedule"}
          </button>
        </div>
      </form>
    </div>
  );
}
