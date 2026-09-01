import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { routesApi } from "../api/routes";
import { referenceApi } from "../api/reference";
import type { Route } from "../types";

export default function AdminRoutesPage() {
  const [locations, setLocations] = useState<string[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [error, setError] = useState("");

  // create-route form state
  const [newSp, setNewSp] = useState("");
  const [newFp, setNewFp] = useState("");

  // per-route checkpoint add state
  const [cpAdd, setCpAdd] = useState<{ [routeId: string]: { route: string; price: string } }>({});

  useEffect(() => {
    let cancelled = false;
    referenceApi
      .locations()
      .then(({ data }) => !cancelled && setLocations(data.locations))
      .catch(() => !cancelled && setError("Failed to load towns"));
    routesApi
      .list()
      .then(({ data }) => !cancelled && setRoutes(data.routes))
      .catch(() => !cancelled && setError("Failed to load routes"));
    return () => {
      cancelled = true;
    };
  }, []);

  function availableTowns(r: Route) {
    return locations.filter((t) => t !== r.sp && t !== r.fp);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (newSp === newFp) {
      setError("Start and end point must be different towns");
      return;
    }
    try {
      const { data } = await routesApi.create(newSp, newFp);
      setRoutes((prev) => [...prev, data.route]);
      setNewSp("");
      setNewFp("");
    } catch {
      setError("Failed to create route");
    }
  }

  async function handleAddCheckpoint(routeId: string) {
    const entry = cpAdd[routeId];
    if (!entry || !entry.route || entry.price === "") return;
    setError("");
    try {
      const { data } = await routesApi.addCheckpoint(routeId, entry.route, Number(entry.price));
      setRoutes((prev) => prev.map((r) => (r._id === routeId ? data.route : r)));
      setCpAdd((prev) => ({ ...prev, [routeId]: { route: "", price: "" } }));
    } catch {
      setError("Failed to add checkpoint");
    }
  }

  function updateCpField(routeId: string, field: "route" | "price", value: string) {
    setCpAdd((prev) => ({ ...prev, [routeId]: { ...prev[routeId], [field]: value } }));
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-blue-600">Manage Routes</h1>
          <Link className="text-blue-600 underline" to="/routes">
            View Routes
          </Link>
        </div>

        {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

        {/* Create route form */}
        <form onSubmit={handleCreate} className="bg-white rounded-lg shadow p-4 mb-6">
          <h2 className="font-semibold mb-3">Add Route</h2>
          <div className="flex gap-3 mb-3">
            <select
              className="w-full border rounded px-3 py-2"
              value={newSp}
              onChange={(e) => setNewSp(e.target.value)}
              required
            >
              <option value="">Start point</option>
              {locations.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <select
              className="w-full border rounded px-3 py-2"
              value={newFp}
              onChange={(e) => setNewFp(e.target.value)}
              required
            >
              <option value="">End point</option>
              {locations
                .filter((t) => t !== newSp)
                .map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
            </select>
          </div>
          <button className="bg-blue-600 text-white rounded px-4 py-2 hover:bg-blue-700">
            Create Route
          </button>
        </form>

        {/* Route list */}
        <div className="space-y-4">
          {routes.map((r) => (
            <div key={r._id} className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold">
                  {r.sp} <span className="text-gray-400">→</span> {r.fp}
                </span>
                <span className="text-xs text-gray-500">{r.checkpoints.length} checkpoint(s)</span>
              </div>

              {/* checkpoint chain */}
              {r.checkpoints.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {r.checkpoints.map((c) => (
                    <span key={c._id} className="px-2 py-1 bg-blue-100 rounded text-sm">
                      {c.route} (Rs {c.price})
                    </span>
                  ))}
                </div>
              )}

              {/* add checkpoint */}
              <div className="flex gap-2 items-center border-t pt-3">
                <select
                  className="border rounded px-2 py-1"
                  value={cpAdd[r._id]?.route ?? ""}
                  onChange={(e) => updateCpField(r._id, "route", e.target.value)}
                >
                  <option value="">Add checkpoint...</option>
                  {availableTowns(r).map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                <input
                  type="number"
                  min={0}
                  placeholder="Price (Rs)"
                  className="border rounded px-2 py-1 w-32"
                  value={cpAdd[r._id]?.price ?? ""}
                  onChange={(e) => updateCpField(r._id, "price", e.target.value)}
                />
                <button
                  onClick={() => handleAddCheckpoint(r._id)}
                  className="bg-green-600 text-white rounded px-3 py-1 hover:bg-green-700"
                >
                  Add
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}