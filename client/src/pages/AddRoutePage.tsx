import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { routesApi } from "../api/routes";
import { referenceApi } from "../api/reference";
import { serializeError } from "../api/client";

interface NewCheckpoint {
  route: string;
  price: string;
}

const inputClass =
  "rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none";

export default function AddRoutePage() {
  const [locations, setLocations] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const [sp, setSp] = useState("");
  const [fp, setFp] = useState("");
  const [checkpoints, setCheckpoints] = useState<NewCheckpoint[]>([]);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    referenceApi
      .locations()
      .then(({ data }) => setLocations(data.locations))
      .catch(() => setError("Failed to load towns"))
      .finally(() => setLoading(false));
  }, []);

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
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-blue-600">Add Route</h1>
        <Link className="text-blue-600 underline" to="/routes">
          ← View Routes
        </Link>
      </div>

      {error && <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}
      {msg && <div className="mb-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-600">{msg}</div>}

      <form onSubmit={submit} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="font-semibold text-slate-800">Route Points</h2>
        <div className="mt-3 flex gap-3">
          <select
            className="w-full border rounded px-3 py-2 text-sm"
            value={sp}
            onChange={(e) => setSp(e.target.value)}
          >
            <option value="">Start point</option>
            {locations.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <select
            className="w-full border rounded px-3 py-2 text-sm"
            value={fp}
            onChange={(e) => setFp(e.target.value)}
          >
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
            className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
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
              <div key={i} className="flex items-center gap-2">
                <select
                  className="flex-1 border rounded px-3 py-1.5 text-sm"
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
                  className="rounded-lg border border-red-300 px-2.5 py-1 text-xs text-red-600 hover:bg-red-50"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="mt-5">
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {busy ? "Creating..." : "Create Route"}
          </button>
        </div>
      </form>
    </div>
  );
}
