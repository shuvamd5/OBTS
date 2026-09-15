import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { schedulesApi } from "../api/schedules";
import { busesApi } from "../api/buses";
import { routesApi } from "../api/routes";
import { pricesApi } from "../api/prices";
import { serializeError } from "../api/client";
import { todayPlusDays } from "../lib/date";
import type { Route } from "../types";

const inputClass = "input px-2 py-1.5 text-sm";

const highestCheckpointFare = (route?: Route) =>
  (route?.checkpoints ?? []).reduce((max, c) => Math.max(max, c.price), 0);

export default function AddSchedulePage() {
  const queryClient = useQueryClient();

  const busesQuery = useQuery({
    queryKey: ["buses"],
    queryFn: () => busesApi.list().then(({ data }) => data.buses),
  });

  const routesQuery = useQuery({
    queryKey: ["routes"],
    queryFn: () => routesApi.list().then(({ data }) => data.routes),
  });

  const buses = busesQuery.data ?? [];
  const routes = routesQuery.data ?? [];
  const loading = busesQuery.isLoading || routesQuery.isLoading;
  const loadError = busesQuery.error || routesQuery.error ? "Failed to load buses or routes" : "";

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
      void queryClient.invalidateQueries({ queryKey: ["schedules"] });
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
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Add Schedule</h1>
        <Link className="text-sm font-medium text-brand-600 hover:text-brand-700" to="/schedules">
          ← View Schedules
        </Link>
      </div>

      {error && <div className="mb-4 rounded-card bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}
      {loadError && <div className="mb-4 rounded-card bg-red-50 px-3 py-2 text-sm text-red-600">{loadError}</div>}
      {msg && <div className="mb-4 rounded-card bg-green-50 px-3 py-2 text-sm text-green-600">{msg}</div>}

      <form onSubmit={submit} className="card rounded-panel p-6">
        <h2 className="font-semibold text-slate-800">Schedule Details</h2>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <div>
            <label className="block px-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Bus
            </label>
            <select value={bid} onChange={(e) => setBid(e.target.value)} className={inputClass}>
              <option value="">Select bus...</option>
              {buses.map((b) => (
                <option key={b._id} value={b._id}>
                  {b.plateNumber} — {b.bname}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block px-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Travelling date
            </label>
            <input
              type="date"
              min={minDate}
              value={trdate}
              onChange={(e) => setTrdate(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block px-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Time
            </label>
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
            <label className="block px-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Route
            </label>
            <select
              value={rid}
              onChange={(e) => {
                setRid(e.target.value);
                setPrice("");
              }}
              className={inputClass}
            >
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
              <label className="block px-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Fare (Rs.)
              </label>
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
          <button type="submit" disabled={busy} className="btn-primary">
            {busy ? "Adding..." : "Add schedule"}
          </button>
        </div>
      </form>
    </div>
  );
}