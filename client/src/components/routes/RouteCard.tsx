import { useState } from "react";
import { routesApi } from "../../api/routes";
import { serializeError } from "../../api/client";
import type { Checkpoint, Route } from "../../types";
import { PenIcon } from "../icons";
import Button from "../ui/Button";
import Card from "../ui/Card";
import Input from "../ui/Input";
import Select from "../ui/Select";

const compactClass = "px-2 py-1.5";

export default function RouteCard({
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
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");

  const [cpAddRoute, setCpAddRoute] = useState("");
  const [cpAddPrice, setCpAddPrice] = useState("");

  const [editingCpId, setEditingCpId] = useState<string | null>(null);
  const [editCpRoute, setEditCpRoute] = useState("");
  const [editCpPrice, setEditCpPrice] = useState("");

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
          <span className="rounded-btn bg-slate-100 px-3 py-1 font-medium text-slate-700">
            {stop}
            {fare !== null && <span className="text-xs text-slate-400"> (Rs {fare})</span>}
          </span>
          {i < stops.length - 1 && <span className="mx-1 text-slate-300">→</span>}
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

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1">{renderChain()}</div>
        {canEdit && (
          <button
            type="button"
            onClick={() => setEditing((e) => !e)}
            className="shrink-0 rounded-btn p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-brand-600"
            title="Manage route"
          >
            <PenIcon />
          </button>
        )}
      </div>
      <p className="mt-2 text-xs text-slate-500">
        {route.sp} → {route.fp} · {route.checkpoints.length} checkpoint(s)
      </p>

      {editing && (
        <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
          {error && <p className="text-sm text-red-600">{error}</p>}

          {route.checkpoints.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-slate-400">Checkpoints</p>
              {route.checkpoints.map((c) => (
                <div key={c._id} className="flex items-center gap-2">
                  {editingCpId === c._id ? (
                    <>
                      <Select
                        className={`${compactClass} flex-1`}
                        value={editCpRoute}
                        onChange={(e) => setEditCpRoute(e.target.value)}
                      >
                        <option value="">Town...</option>
                        {locations
                          .filter((t) => t === editCpRoute || (t !== route.sp && t !== route.fp))
                          .map((t) => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                      </Select>
                      <Input
                        type="number"
                        min="0"
                        placeholder="Price"
                        className={`${compactClass} w-24`}
                        value={editCpPrice}
                        onChange={(e) => setEditCpPrice(e.target.value)}
                      />
                      <Button size="sm" onClick={(e) => void saveEditCp(e)} disabled={busy}>
                        Save
                      </Button>
                      <Button variant="secondary" size="xs" onClick={() => setEditingCpId(null)}>
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-sm text-slate-700">{c.route}</span>
                      <span className="text-sm font-medium text-slate-800">Rs {c.price}</span>
                      <button
                        type="button"
                        onClick={() => startEditCp(c)}
                        className="rounded-btn p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-brand-600"
                        title="Edit checkpoint"
                      >
                        <PenIcon className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDeleteCp(c._id)}
                        disabled={busy}
                        className="rounded-btn px-2 py-0.5 text-xs text-red-600 transition-colors hover:bg-red-50"
                      >
                        ×
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          <form onSubmit={handleAddCheckpoint} className="flex items-center gap-2 border-t border-slate-100 pt-3">
            <Select
              className={`${compactClass} flex-1`}
              value={cpAddRoute}
              onChange={(e) => setCpAddRoute(e.target.value)}
            >
              <option value="">Add checkpoint...</option>
              {availableTowns().map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </Select>
            <Input
              type="number"
              min="0"
              placeholder="Price (Rs)"
              className={`${compactClass} w-24`}
              value={cpAddPrice}
              onChange={(e) => setCpAddPrice(e.target.value)}
            />
            <Button type="submit" size="sm" disabled={busy}>
              Add
            </Button>
          </form>

          <div className="flex items-center gap-2 border-t border-slate-100 pt-3">
            {!confirmDelete ? (
              <Button variant="danger" onClick={() => setConfirmDelete(true)}>
                Delete route
              </Button>
            ) : (
              <>
                <span className="text-xs text-red-600">Delete this route and all its checkpoints?</span>
                <button
                  type="button"
                  onClick={() => void handleDeleteRoute()}
                  disabled={busy}
                  className="rounded-btn bg-red-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                >
                  Yes
                </button>
                <Button variant="secondary" size="xs" onClick={() => setConfirmDelete(false)}>
                  No
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}