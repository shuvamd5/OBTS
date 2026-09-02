import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { schedulesApi } from "../api/schedules";
import { routesApi } from "../api/routes";
import { pricesApi } from "../api/prices";
import { serializeError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { fmtDate } from "../lib/date";
import { isAdmin, isStaff } from "../lib/roles";
import type { PriceStatus, Route, Schedule, ScheduleStatus } from "../types";

const inputClass =
  "rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none";
const statusBadge = (s: ScheduleStatus) =>
  s === "going"
    ? "bg-green-50 text-green-700"
    : s === "not going"
    ? "bg-red-50 text-red-700"
    : s === "Expired"
    ? "bg-slate-100 text-slate-500"
    : "bg-amber-50 text-amber-700";
const priceBadge = (s: PriceStatus) =>
  s === "ok"
    ? "bg-green-50 text-green-700"
    : s === "not ok"
    ? "bg-red-50 text-red-700"
    : s === "Expired"
    ? "bg-slate-100 text-slate-500"
    : "bg-amber-50 text-amber-700";
const highestCheckpointFare = (route?: Route) =>
  (route?.checkpoints ?? []).reduce((max, c) => Math.max(max, c.price), 0);

const penIcon = (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
  </svg>
);

function PriceSection({
  s,
  isAdminRole,
  routes,
  editing,
  onPriceChanged,
}: {
  s: Schedule;
  isAdminRole: boolean;
  routes: Route[];
  editing: boolean;
  onPriceChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  const [assigning, setAssigning] = useState(false);
  const [newRid, setNewRid] = useState("");
  const [newPrice, setNewPrice] = useState("");

  const [editingPrice, setEditingPrice] = useState(false);
  const [editRid, setEditRid] = useState("");
  const [editPrice, setEditPrice] = useState("");

  const selectedEditRoute = useMemo(
    () => routes.find((r) => r._id === (editingPrice ? editRid : s.price?.rid._id)),
    [routes, editingPrice, editRid, s.price]
  );
  const minFare = highestCheckpointFare(selectedEditRoute);

  async function changePriceStatus(arstatus: PriceStatus) {
    if (!s.price || arstatus === s.price.arstatus) return;
    setBusy(true);
    setError("");
    try {
      await pricesApi.updateStatus(s.price._id, arstatus);
      setMsg("Price status updated.");
      onPriceChanged();
    } catch (err) {
      setError(serializeError(err));
    } finally {
      setBusy(false);
    }
  }

  async function assignFare(e: React.FormEvent) {
    e.preventDefault();
    if (!s || !newRid || newPrice === "") {
      setError("Select a route and enter a fare.");
      return;
    }
    setBusy(true);
    setError("");
    setMsg("");
    try {
      await pricesApi.assign({ bsid: s._id, rid: newRid, price: Number(newPrice) });
      setAssigning(false);
      setNewRid("");
      setNewPrice("");
      setMsg("Fare assigned — needs admin approval before passengers can book it.");
      onPriceChanged();
    } catch (err) {
      setError(serializeError(err));
    } finally {
      setBusy(false);
    }
  }

  async function savePriceEdits() {
    if (!s.price) return;
    setBusy(true);
    setError("");
    setMsg("");
    try {
      if (editRid && editRid !== s.price.rid._id) {
        await pricesApi.updateRoute(s.price._id, editRid);
      }
      if (editPrice !== "" && Number(editPrice) !== s.price.price) {
        await pricesApi.updatePrice(s.price._id, Number(editPrice));
      }
      setEditingPrice(false);
      setMsg("Fare updated — it goes back to unchecked for re-approval.");
      onPriceChanged();
    } catch (err) {
      setError(serializeError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleDeletePrice() {
    if (!s.price) return;
    setBusy(true);
    setError("");
    try {
      await pricesApi.remove(s.price._id);
      setConfirm(false);
      onPriceChanged();
    } catch (err) {
      setError(serializeError(err));
      setBusy(false);
    }
  }

  if (!s.price) {
    if (!editing) {
      return (
        <div className="mt-3 border-t border-slate-100 pt-3 text-sm">
          <p className="text-xs text-slate-400">No fare/route assigned yet.</p>
        </div>
      );
    }
    return (
      <div className="mt-3 border-t border-slate-100 pt-3 text-sm">
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-600">Assign a route and fare to this schedule.</p>
          {assigning ? (
            <button
              onClick={() => setAssigning(false)}
              className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs text-slate-600"
            >
              Cancel
            </button>
          ) : (
            <button
              onClick={() => setAssigning(true)}
              className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
            >
              Assign route + fare
            </button>
          )}
        </div>
        {assigning && (
          <form onSubmit={assignFare} className="mt-2 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <select value={newRid} onChange={(e) => setNewRid(e.target.value)} className={inputClass}>
                <option value="">Select route...</option>
                {routes.map((r) => (
                  <option key={r._id} value={r._id}>
                    {r.sp} → {r.fp}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min="0"
                step="1"
                placeholder="Fare (Rs.)"
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                className={`${inputClass} w-28`}
              />
              <button
                type="submit"
                disabled={busy}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
              >
                {busy ? "Assigning..." : "Assign"}
              </button>
            </div>
            {routes.length === 0 && (
              <p className="text-xs text-slate-400">Add routes first — a fare is tied to a route.</p>
            )}
            {error && <p className="text-sm text-red-600">{error}</p>}
            {msg && <p className="text-sm text-green-600">{msg}</p>}
          </form>
        )}
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-2 border-t border-slate-100 pt-3 text-sm text-slate-600">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-slate-800">
          <span className="text-red-600">
            {s.price.rid.sp} → {s.price.rid.fp}
          </span>{" "}
          · <span className="font-semibold text-blue-600">Rs. {s.price.price}</span>
        </p>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${priceBadge(s.price.arstatus)}`}>
          {s.price.arstatus}
        </span>
      </div>

      {!editing && <p className="text-xs text-slate-400">Click the pen to manage the fare.</p>}

      {editing && isAdminRole && (
        <div className="flex items-center gap-2">
          <select
            value={s.price.arstatus}
            disabled={busy}
            onChange={(e) => void changePriceStatus(e.target.value as PriceStatus)}
            className={inputClass}
          >
            <option value="unchecked">unchecked</option>
            <option value="not ok">not ok</option>
            <option value="ok">ok</option>
          </select>
          <span className="text-xs text-slate-400">approve fare for booking</span>
        </div>
      )}

      {editing && (
        <div className="flex flex-wrap items-center gap-2">
          {!editingPrice ? (
            <>
              <button
                onClick={() => {
                  setEditRid(s.price!.rid._id);
                  setEditPrice(String(s.price!.price));
                  setEditingPrice(true);
                }}
                className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
              >
                Edit route / fare
              </button>
              {!confirm ? (
                <button
                  onClick={() => setConfirm(true)}
                  className="rounded-lg border border-red-300 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                >
                  Delete fare
                </button>
              ) : (
                <>
                  <span className="text-xs text-red-600">Delete this fare?</span>
                  <button
                    onClick={() => void handleDeletePrice()}
                    disabled={busy}
                    className="rounded-lg bg-red-600 px-2.5 py-1 text-xs font-medium text-white disabled:opacity-50"
                  >
                    Yes
                  </button>
                  <button
                    onClick={() => setConfirm(false)}
                    className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs text-slate-600"
                  >
                    No
                  </button>
                </>
              )}
            </>
          ) : (
            <>
              <select
                value={editRid}
                onChange={(e) => setEditRid(e.target.value)}
                className={inputClass}
              >
                {routes.map((r) => (
                  <option key={r._id} value={r._id}>
                    {r.sp} → {r.fp}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min="0"
                step="1"
                value={editPrice}
                onChange={(e) => setEditPrice(e.target.value)}
                className={`${inputClass} w-28`}
              />
              <button
                onClick={() => void savePriceEdits()}
                disabled={busy}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
              >
                Save
              </button>
              <button
                onClick={() => setEditingPrice(false)}
                className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs text-slate-600"
              >
                Cancel
              </button>
            </>
          )}
          {editingPrice && minFare > 0 && editPrice !== "" && Number(editPrice) <= minFare && (
            <span className="text-xs font-medium text-red-600">
              must exceed highest checkpoint fare (Rs. {minFare})
            </span>
          )}
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      {msg && <p className="text-sm text-green-600">{msg}</p>}
    </div>
  );
}

function ScheduleCard({
  s,
  isAdminRole,
  routes,
  onUpdate,
  onDeleted,
  onPriceChanged,
}: {
  s: Schedule;
  isAdminRole: boolean;
  routes: Route[];
  onUpdate: (next: Schedule) => void;
  onDeleted: () => void;
  onPriceChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  const [editing, setEditing] = useState(false);

  async function changeStatus(bsstatus: ScheduleStatus) {
    if (bsstatus === s.bsstatus) return;
    setBusy(true);
    setError("");
    try {
      const { data } = await schedulesApi.updateStatus(s._id, bsstatus);
      onUpdate({ ...s, bsstatus, bssapby: data.schedule.bssapby });
      setMsg(data.message === "No change" ? "No change" : `Status updated by ${data.schedule.bssapby}`);
    } catch (err) {
      setError(serializeError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    setBusy(true);
    setError("");
    try {
      await schedulesApi.remove(s._id);
      onDeleted();
    } catch (err) {
      setError(serializeError(err));
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-lg font-bold tracking-wide text-slate-800">
            {s.bus?.bcd} <span className="text-blue-600">{s.bus?.bno}</span>
          </p>
          <p className="text-sm font-medium text-slate-600">{s.bus?.bname}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge(s.bsstatus)}`}>
            {s.bsstatus}
          </span>
          <button
            onClick={() => {
              setEditing((e) => !e);
              setError("");
              setMsg("");
            }}
            className="rounded-md border border-slate-300 p-1.5 text-slate-500 hover:bg-slate-100"
            title="Manage schedule"
          >
            {penIcon}
          </button>
        </div>
      </div>
      <div className="mt-2 space-y-1 text-sm text-slate-600">
        <p>
          {fmtDate(s.trdate)} at {s.trtime}
        </p>
        {s.bus && (
          <p className="text-xs text-slate-400">
            {s.bus.btype} · {s.bus.nseat} seats
          </p>
        )}
        {s.bssapby !== "none" && <p className="text-xs text-slate-400">by {s.bssapby}</p>}
      </div>

      {editing && (
        <div className="mt-3 border-t border-slate-100 pt-3">
          {isAdminRole ? (
            <div className="flex items-center gap-2">
              <select
                value={s.bsstatus}
                disabled={busy}
                onChange={(e) => void changeStatus(e.target.value as ScheduleStatus)}
                className={inputClass}
              >
                <option value="not approved">not approved</option>
                <option value="going">going</option>
                <option value="not going">not going</option>
                <option value="pending">pending</option>
              </select>
              <span className="text-xs text-slate-400">approve schedule</span>
            </div>
          ) : (
            <p className="text-xs font-medium text-blue-600">
              Schedule status can only be set by an Admin.
            </p>
          )}

          <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3">
            {!confirm ? (
              <button
                onClick={() => setConfirm(true)}
                className="rounded-lg border border-red-300 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
              >
                Delete schedule
              </button>
            ) : (
              <>
                <span className="text-xs text-red-600">Delete this schedule?</span>
                <button
                  onClick={() => void handleDelete()}
                  disabled={busy}
                  className="rounded-lg bg-red-600 px-2.5 py-1 text-xs font-medium text-white disabled:opacity-50"
                >
                  Yes
                </button>
                <button
                  onClick={() => setConfirm(false)}
                  className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs text-slate-600"
                >
                  No
                </button>
              </>
            )}
          </div>
        </div>
      )}

      <PriceSection
        s={s}
        isAdminRole={isAdminRole}
        routes={routes}
        editing={editing}
        onPriceChanged={onPriceChanged}
      />

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {msg && <p className="mt-2 text-sm text-green-600">{msg}</p>}
    </div>
  );
}

function UserView({ schedules, loading, error }: { schedules: Schedule[]; loading: boolean; error: string }) {
  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800">Schedules</h1>
      <p className="mt-1 text-sm text-slate-500">Upcoming scheduled departures with their fares.</p>
      {error && <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}
      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-36 animate-pulse rounded-xl bg-slate-200" />
            ))
          : schedules.map((s) => (
              <div key={s._id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-lg font-bold tracking-wide text-slate-800">
                      {s.bus?.bcd} <span className="text-blue-600">{s.bus?.bno}</span>
                    </p>
                    <p className="text-sm font-medium text-slate-600">{s.bus?.bname}</p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge(s.bsstatus)}`}
                  >
                    {s.bsstatus}
                  </span>
                </div>
                <div className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-sm text-slate-600">
                  <p>
                    {fmtDate(s.trdate)} at {s.trtime}
                  </p>
                  <p>
                    {s.bus?.btype} · {s.bus?.nseat} seats
                  </p>
                  {s.price ? (
                    <p className="text-slate-800">
                      {s.price.rid.sp} → {s.price.rid.fp}:{" "}
                      <span className="font-semibold text-blue-600">Rs. {s.price.price}</span>
                    </p>
                  ) : (
                    <p className="text-xs text-slate-400">price not set yet</p>
                  )}
                </div>
              </div>
            ))}
      </div>
    </div>
  );
}

export default function SchedulesPage() {
  const { user } = useAuth();
  const staff = isStaff(user);
  const isAdminRole = isAdmin(user);

  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const reloadSchedules = async () => {
    const res = await schedulesApi.list();
    setSchedules(res.data.schedules);
  };

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const calls = [schedulesApi.list()] as Promise<unknown>[];
        if (staff) {
          calls.push(routesApi.list());
        }
        const [s, r] = (await Promise.all(calls)) as [
          { data: { schedules: Schedule[] } },
          { data: { routes: Route[] } } | undefined,
        ];
        if (!active) return;
        setSchedules(s.data.schedules);
        if (r) setRoutes(r.data.routes);
      } catch (err) {
        if (active) setError(serializeError(err));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [staff]);

  const byDate = useMemo(
    () => [...schedules].sort((a, b) => (a.trdate < b.trdate ? -1 : a.trdate > b.trdate ? 1 : 0)),
    [schedules]
  );

  function upsert(next: Schedule) {
    setSchedules((prev) => {
      const exists = prev.some((x) => x._id === next._id);
      return exists ? prev.map((x) => (x._id === next._id ? next : x)) : [next, ...prev];
    });
  }

  if (!staff) return <UserView schedules={byDate} loading={loading} error={error} />;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Schedules</h1>
          <p className="mt-1 text-sm text-slate-500">
            Upcoming departures. Click the pen icon to edit a schedule or assign its fare.
          </p>
        </div>
        <Link
          to="/schedules/add"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          + Add Schedule
        </Link>
      </div>

      {error && <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}

      {!loading && (
        <div className="mt-5">
          {byDate.length === 0 ? (
            <p className="text-slate-400">No schedules yet — add one above.</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {byDate.map((s) => (
                <ScheduleCard
                  key={s._id}
                  s={s}
                  isAdminRole={isAdminRole}
                  routes={routes}
                  onUpdate={upsert}
                  onDeleted={() => setSchedules((prev) => prev.filter((x) => x._id !== s._id))}
                  onPriceChanged={() => void reloadSchedules()}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
