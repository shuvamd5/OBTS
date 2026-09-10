import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { routesApi } from "../api/routes";
import { referenceApi } from "../api/reference";
import { serializeError } from "../api/client";

interface NewCheckpoint {
  route: string;
  price: string;
}

const inputClass = "input px-2 py-1.5 text-sm";

export default function AddRoutePage() {
  const locationsQuery = useQuery({
    queryKey: ["locations"],
    queryFn: () => referenceApi.locations().then(({ data }) => data.locations),
  });
  const locations = locationsQuery.data ?? [];
  const loading = locationsQuery.isLoading;
  const metaError = locationsQuery.isError ? "Failed to load towns" : "";

  const [sp, setSp] = useState("");
  const [fp, setFp] = useState("");
  const [checkpoints, setCheckpoints] = useState<NewCheckpoint[]>([]);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  function addCheckpointRow() {
    setCheckpoints((prev) => [...prev, { route: "", price: "" }]);
  }

  function removeCheckpointRow(index: number) {
    setCheckpoints((prev) => prev.filter((_, i) => i !== index));
  }

  function updateCheckpoint(index: number, field: "route" | "price", value: string) {
    setCheckpoints((prev) =>
      prev.map((c, i) => (i === index ? { ...c, [field]: value } : c))
    );
  }

  function availableForCheckpoint(index: number) {
    const chosen = [sp, fp, ...checkpoints.map((c) => c.route)];
    return locations.filter((t) => !chosen.includes(t) || checkpoints[index]?.route === t);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMsg("");

    if (!sp || !fp) {
      setError("Start point and end point are required.");
      return;
    }
    if (sp === fp) {
      setError("Start point and end point must be different towns.");
      return;
    }

    const filled = checkpoints.filter((c) => c.route || c.price !== "");
    if (filled.some((c) => !c.route || c.price === "")) {
      setError("Each checkpoint needs both a town and a price.");
      return;
    }

    const seen = new Set<string>();
    for (const c of filled) {
      if (seen.has(c.route)) {
        setError(`Checkpoint '${c.route}' appears more than once.`);
        return;
      }
      seen.add(c.route);
    }

    setBusy(true);
    try {
      const { data } = await routesApi.create(sp, fp);
      const routeId = data.route._id;

      for (const c of filled) {
        await routesApi.addCheckpoint(routeId, c.route, Number(c.price));
      }

      setSp("");
      setFp("");
      setCheckpoints([]);
      setMsg("Route created successfully. Add another below.");
    } catch (err) {
      setError(serializeError(err) as string);
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
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Add Route</h1>
        <Link className="text-sm font-medium text-brand-600 hover:text-brand-700" to="/routes">
          ← View Routes
        </Link>
      </div>

      {metaError && <div className="mb-4 rounded-card bg-red-50 px-3 py-2 text-sm text-red-600">{metaError}</div>}
      {error && <div className="mb-4 rounded-card bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}
      {msg && <div className="mb-4 rounded-card bg-green-50 px-3 py-2 text-sm text-green-600">{msg}</div>}

      <form onSubmit={submit} className="card rounded-panel p-6">
        <h2 className="font-semibold text-slate-800">Route Points</h2>
        <div className="mt-3 flex flex-wrap gap-3">
          <select className="input flex-1" value={sp} onChange={(e) => setSp(e.target.value)}>
            <option value="">Start point</option>
            {locations.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <select className="input flex-1" value={fp} onChange={(e) => setFp(e.target.value)}>
            <option value="">End point</option>
            {locations
              .filter((t) => t !== sp)
              .map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
          </select>
        </div>

        <div className="mt-5 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800">Checkpoints (optional)</h2>
          <button
            type="button"
            onClick={addCheckpointRow}
            className="btn-secondary px-2.5 py-1 text-xs"
          >
            + Add checkpoint
          </button>
        </div>
        <p className="mt-1 text-xs text-slate-400">
          You can skip checkpoints now and add them later from the routes page.
        </p>

        {checkpoints.length > 0 && (
          <div className="mt-3 space-y-2">
            {checkpoints.map((c, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <select
                  className="input flex-1"
                  value={c.route}
                  onChange={(e) => updateCheckpoint(i, "route", e.target.value)}
                >
                  <option value="">Checkpoint town...</option>
                  {availableForCheckpoint(i).map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                <input
                  type="number"
                  min="0"
                  placeholder="Price (Rs)"
                  className={`${inputClass} w-32`}
                  value={c.price}
                  onChange={(e) => updateCheckpoint(i, "price", e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => removeCheckpointRow(i)}
                  className="btn-danger"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="mt-5">
          <button type="submit" disabled={busy} className="btn-primary">
            {busy ? "Creating..." : "Create Route"}
          </button>
        </div>
      </form>
    </div>
  );
}