import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { routesApi } from "../api/routes";
import { referenceApi } from "../api/reference";
import { serializeError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { isStaff } from "../lib/roles";
import type { Checkpoint, Route } from "../types";

const inputClass =
  "rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none";

const penIcon = (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
  </svg>
);

function RouteCard({
  route,
  canEdit,
  locations,
  onChanged,
}: {
  route: Route;
  canEdit: boolean;
  locations: string[];
  onChanged: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");

  const [cpAddRoute, setCpAddRoute] = useState("");
  const [cpAddPrice, setCpAddPrice] = useState("");

  const [editingCpId, setEditingCpId] = useState<string | null>(null);
  const [editCpRoute, setEditCpRoute] = useState("");
  const [editCpPrice, setEditCpPrice] = useState("");

  useEffect(() => {
    setLoading(false);
  }, []);

  function availableTowns() {
    const taken = [route.sp, route.fp, ...route.checkpoints.map((c) => c.route)];
    return locations.filter((t) => !taken.includes(t));
  }

  function renderChain() {
    const stops = [route.sp, ...route.checkpoints.map((c) => c.route), route.fp];
    return stops.map((stop, i) => {
      const cp = route.checkpoints.find((c) => c.route === stop);
      const fare = cp ? cp.price : null;
      return (
        <span key={i} className="inline-flex items-center">
          <span className="px-3 py-1 bg-blue-100 rounded">
            {stop}
            {fare !== null && <span className="text-xs text-gray-500"> (Rs {fare})</span>}
          </span>
          {i < stops.length - 1 && <span className="mx-1 text-gray-400">→</span>}
        </span>
      );
    });
  }

  async function handleAddCheckpoint(e: React.FormEvent) {
    e.preventDefault();
    if (!cpAddRoute || cpAddPrice === "") {
      setError("Select a checkpoint town and enter a price.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await routesApi.addCheckpoint(route._id, cpAddRoute, Number(cpAddPrice));
      setCpAddRoute("");
      setCpAddPrice("");
      onChanged();
    } catch (err) {
      setError(serializeError(err));
    } finally {
      setBusy(false);
    }
  }

  function startEditCp(cp: Checkpoint) {
    setEditingCpId(cp._id);
    setEditCpRoute(cp.route);
    setEditCpPrice(String(cp.price));
  }

  async function saveEditCp(e: React.FormEvent) {
    e.preventDefault();
    if (!editingCpId) return;
    setBusy(true);
    setError("");
    try {
      await routesApi.updateCheckpoint(route._id, editingCpId, {
        route: editCpRoute,
        price: Number(editCpPrice),
      });
      setEditingCpId(null);
      onChanged();
    } catch (err) {
      setError(serializeError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteCp(cpid: string) {
    setBusy(true);
    setError("");
    try {
      await routesApi.removeCheckpoint(route._id, cpid);
      onChanged();
    } catch (err) {
      setError(serializeError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteRoute() {
    setBusy(true);
    setError("");
    try {
      await routesApi.remove(route._id);
      onChanged();
    } catch (err) {
      setError(serializeError(err));
      setConfirmDelete(false);
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="h-24 animate-pulse rounded-xl bg-slate-200" />
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex flex-wrap items-center gap-1">{renderChain()}</div>
        {canEdit && (
          <button
            onClick={() => setEditing((e) => !e)}
            className="rounded-md border border-slate-300 p-1.5 text-slate-500 hover:bg-slate-100"
            title="Manage route"
          >
            {penIcon}
          </button>
        )}
      </div>
      <p className="mt-2 text-xs text-slate-500">
        {route.sp} → {route.fp} · {route.checkpoints.length} checkpoint(s)
      </p>

      {editing && (
        <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
          {error && <p className="text-sm text-red-600">{error}</p>}

          {/* Checkpoint list with edit/delete */}
          {route.checkpoints.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-slate-400">Checkpoints</p>
              {route.checkpoints.map((c) => (
                <div key={c._id} className="flex items-center gap-2">
                  {editingCpId === c._id ? (
                    <>
                      <select
                        className={`${inputClass} flex-1`}
                        value={editCpRoute}
                        onChange={(e) => setEditCpRoute(e.target.value)}
                      >
                        <option value="">Town...</option>
                        {locations
                          .filter((t) => t === editCpRoute || (t !== route.sp && t !== route.fp))
                          .map((t) => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                      </select>
                      <input
                        type="number"
                        min="0"
                        placeholder="Price"
                        className={`${inputClass} w-24`}
                        value={editCpPrice}
                        onChange={(e) => setEditCpPrice(e.target.value)}
                      />
                      <button
                        onClick={(e) => void saveEditCp(e)}
                        disabled={busy}
                        className="rounded-lg bg-blue-600 px-2 py-1 text-xs text-white disabled:opacity-50"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingCpId(null)}
                        className="rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-600"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-sm">{c.route}</span>
                      <span className="text-sm text-slate-600">Rs {c.price}</span>
                      <button
                        onClick={() => startEditCp(c)}
                        className="rounded border border-slate-300 p-1 text-slate-500 hover:bg-slate-100"
                        title="Edit checkpoint"
                      >
                        {penIcon}
                      </button>
                      <button
                        onClick={() => void handleDeleteCp(c._id)}
                        disabled={busy}
                        className="rounded border border-red-300 px-2 py-0.5 text-xs text-red-600 hover:bg-red-50"
                      >
                        ×
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Add checkpoint */}
          <form onSubmit={handleAddCheckpoint} className="flex items-center gap-2 border-t border-slate-100 pt-3">
            <select
              className={`${inputClass} flex-1`}
              value={cpAddRoute}
              onChange={(e) => setCpAddRoute(e.target.value)}
            >
              <option value="">Add checkpoint...</option>
              {availableTowns().map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <input
              type="number"
              min="0"
              placeholder="Price (Rs)"
              className={`${inputClass} w-24`}
              value={cpAddPrice}
              onChange={(e) => setCpAddPrice(e.target.value)}
            />
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-green-600 px-3 py-1 text-xs text-white hover:bg-green-700 disabled:opacity-50"
            >
              Add
            </button>
          </form>

          {/* Delete route */}
          <div className="flex items-center gap-2 border-t border-slate-100 pt-3">
            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                className="rounded-lg border border-red-300 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
              >
                Delete route
              </button>
            ) : (
              <>
                <span className="text-xs text-red-600">Delete this route and all its checkpoints?</span>
                <button
                  onClick={() => void handleDeleteRoute()}
                  disabled={busy}
                  className="rounded-lg bg-red-600 px-2.5 py-1 text-xs font-medium text-white disabled:opacity-50"
                >
                  Yes
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs text-slate-600"
                >
                  No
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function RoutesPage() {
  const { user } = useAuth();
  const staff = isStaff(user);

  const [routes, setRoutes] = useState<Route[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [error, setError] = useState("");

  const load = async () => {
    const [r, l] = await Promise.all([routesApi.list(), referenceApi.locations()]);
    setRoutes(r.data.routes);
    setLocations(l.data.locations);
  };

  useEffect(() => {
    let cancelled = false;
    routesApi
      .list()
      .then(({ data }) => {
        if (!cancelled) setRoutes(data.routes);
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load routes");
      });
    if (staff) {
      referenceApi
        .locations()
        .then(({ data }) => {
          if (!cancelled) setLocations(data.locations);
        })
        .catch(() => {});
    }
    return () => {
      cancelled = true;
    };
  }, [staff]);

  async function reload() {
    try {
      await load();
    } catch {
      setError("Failed to reload routes");
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-blue-600">Routes</h1>
        {staff && (
          <Link
            to="/routes/add"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            + Add Route
          </Link>
        )}
      </div>

      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

      <div className="space-y-4">
        {routes.map((r) => (
          <RouteCard
            key={r._id}
            route={r}
            canEdit={staff}
            locations={locations}
            onChanged={() => void reload()}
          />
        ))}
      </div>
    </div>
  );
}
