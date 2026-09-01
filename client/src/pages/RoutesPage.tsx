import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { routesApi } from "../api/routes";
import { isStaff } from "../lib/roles";
import type { Route } from "../types";

export default function RoutesPage() {
  const { user } = useAuth();
  const [routes, setRoutes] = useState<Route[]>([]);
  const [error, setError] = useState("");

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
    return () => {
      cancelled = true;
    };
  }, []);

  function renderChain(r: Route) {
    const stops = [r.sp, ...r.checkpoints.map((c) => c.route), r.fp];
    return stops.map((stop, i) => {
      // fare to this stop: cumulative price if it's a checkpoint, else last checkpoint price for fp
      const cp = r.checkpoints.find((c) => c.route === stop);
      let fare: number | null = null;
      if (cp) fare = cp.price;
      else if (stop === r.fp && r.checkpoints.length > 0) {
        fare = Math.max(...r.checkpoints.map((c) => c.price));
      }
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

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-blue-600">Routes</h1>
          <div className="flex gap-3">
            {isStaff(user) && (
              <Link className="text-blue-600 underline" to="/admin/routes">
                Manage Routes
              </Link>
            )}
            <Link className="text-blue-600 underline" to="/">
              Home
            </Link>
          </div>
        </div>

        {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

        <div className="space-y-3">
          {routes.map((r) => (
            <div key={r._id} className="bg-white rounded-lg shadow p-4">
              <div className="flex flex-wrap items-center gap-1 mb-2">{renderChain(r)}</div>
              <p className="text-xs text-gray-500">
                {r.sp} → {r.fp} · {r.checkpoints.length} checkpoint(s)
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}