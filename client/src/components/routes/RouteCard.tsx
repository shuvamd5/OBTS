import { useState } from "react";
import { routesApi } from "../../api/routes";
import { serializeError } from "../../api/client";
import type { Checkpoint, Route, RouteStatus } from "../../types";
import type { PillDot } from "../ui/Pill";
import Card from "../ui/Card";
import CardActions from "../ui/CardActions";
import ConfirmDialog from "../ui/ConfirmDialog";
import EditModal from "../ui/EditModal";
import StatusChangeDialog, { type StatusOption } from "../ui/StatusChangeDialog";
import Button from "../ui/Button";
import Input from "../ui/Input";
import Select from "../ui/Select";

const routeDot = (status: RouteStatus): PillDot =>
  status === "active" ? "green" : status === "inactive" ? "red" : "amber";

const STATUS_OPTIONS: StatusOption<RouteStatus>[] = [
  { value: "pending", label: "pending", dot: "amber" },
  { value: "active", label: "active", dot: "green" },
  { value: "inactive", label: "inactive", dot: "red" },
];

const compactClass = "px-2 py-1.5";

export default function RouteCard({
  route,
  canEdit,
  isAdminRole,
  locations,
  onChanged,
}: {
  route: Route;
  canEdit: boolean;
  isAdminRole: boolean;
  locations: string[];
  onChanged: () => void;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  const [sp, setSp] = useState(route.sp);
  const [fp, setFp] = useState(route.fp);
  const [distance, setDistance] = useState(String(route.distance ?? 0));
  const [duration, setDuration] = useState(route.duration ?? "TBD");

  const [cpAddRoute, setCpAddRoute] = useState("");
  const [cpAddPrice, setCpAddPrice] = useState("");

  const [editingCpId, setEditingCpId] = useState<string | null>(null);
  const [editCpRoute, setEditCpRoute] = useState("");
  const [editCpPrice, setEditCpPrice] = useState("");

  const [deleteCpId, setDeleteCpId] = useState<string | null>(null);

  const openEdit = () => {
    setSp(route.sp);
    setFp(route.fp);
    setDistance(String(route.distance ?? 0));
    setDuration(route.duration ?? "TBD");
    setCpAddRoute("");
    setCpAddPrice("");
    setEditingCpId(null);
    setError("");
    setMsg("");
    setEditOpen(true);
  };

  function townsExcluding(exclude: string[]) {
    return locations.filter((t) => !exclude.includes(t));
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

  async function handleStatusChange(next: RouteStatus) {
    setBusy(true);
    setError("");
    try {
      const { data } = await routesApi.updateStatus(route._id, next);
      setMsg(
        data.message === "No change"
          ? "No change"
          : data.route.rsapby && data.route.rsapby !== "none"
          ? `Status updated by ${data.route.rsapby}`
          : "Status updated"
      );
      onChanged();
    } catch (err) {
      setError(serializeError(err));
    } finally {
      setBusy(false);
      setStatusOpen(false);
    }
  }

  async function handleEditSave() {
    const changes: { sp?: string; fp?: string; distance?: number; duration?: string } = {};
    if (sp && sp !== route.sp) changes.sp = sp;
    if (fp && fp !== route.fp) changes.fp = fp;

    const numDistance = Number(distance);
    if (distance !== "") {
      if (!Number.isFinite(numDistance) || numDistance <= 0) {
        setError("Distance must be a positive number of km.");
        return;
      }
      if (numDistance !== route.distance) changes.distance = numDistance;
    }
    if (duration && duration.trim() !== "") {
      if (duration.trim() !== route.duration) changes.duration = duration.trim();
    }

    if (Object.keys(changes).length === 0) {
      setError("No changes to save.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      const { data } = await routesApi.update(route._id, changes);
      setEditOpen(false);
      setMsg(
        route.rstatus === "active" && data.route.rstatus === "pending"
          ? "Route updated — status reset to pending for approval."
          : "Route updated."
      );
      onChanged();
    } catch (err) {
      setError(serializeError(err));
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
      setBusy(false);
      setDeleteOpen(false);
    }
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

  async function handleDeleteCp() {
    if (!deleteCpId) return;
    setBusy(true);
    setError("");
    try {
      const cpid = deleteCpId;
      setDeleteCpId(null);
      await routesApi.removeCheckpoint(route._id, cpid);
      onChanged();
    } catch (err) {
      setError(serializeError(err));
      setBusy(false);
      setDeleteCpId(null);
    }
  }

  const cpTowns = route.checkpoints.map((c) => c.route);
  const spOptions = townsExcluding([fp, ...cpTowns]);
  const fpOptions = townsExcluding([sp, ...cpTowns]);
  const availableTowns = townsExcluding([sp, fp, ...cpTowns]);

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1">{renderChain()}</div>
        <CardActions
          status={route.rstatus}
          dot={routeDot(route.rstatus)}
          canChangeStatus={isAdminRole}
          onStatus={() => setStatusOpen(true)}
          canEdit={canEdit}
          onEdit={openEdit}
          onDelete={() => setDeleteOpen(true)}
        />
      </div>
      <p className="mt-2 text-xs text-slate-500">
        {route.sp} → {route.fp} · {route.distance > 0 && route.duration !== "TBD" ? `${route.distance} km · ${route.duration}` : "—"} · {route.checkpoints.length} checkpoint(s)
      </p>
      <p className="mt-1 min-h-4 text-right text-xs leading-4 text-slate-400">
        {msg ? msg : route.rsapby && route.rsapby !== "none" ? `by ${route.rsapby}` : ""}
      </p>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <StatusChangeDialog
        open={statusOpen}
        title={<>Change status for <span className="font-mono">{route.sp} → {route.fp}</span></>}
        current={route.rstatus}
        options={STATUS_OPTIONS}
        busy={busy}
        onConfirm={(next) => void handleStatusChange(next)}
        onCancel={() => setStatusOpen(false)}
      />

      <EditModal
        open={editOpen}
        title={<>Edit route <span className="font-mono">{route.sp} → {route.fp}</span></>}
        busy={busy}
        confirmNote="Saving will reset the status to pending for approval. Save these changes?"
        error={error}
        onSave={() => void handleEditSave()}
        onClose={() => setEditOpen(false)}
      >
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block px-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Start point
              </label>
              <Select value={sp} onChange={(e) => setSp(e.target.value)}>
                <option value="">Start point</option>
                {spOptions.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </Select>
            </div>
            <div>
              <label className="block px-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                End point
              </label>
              <Select value={fp} onChange={(e) => setFp(e.target.value)}>
                <option value="">End point</option>
                {fpOptions.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block px-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Distance (km)
              </label>
              <Input type="number" min="0" placeholder="200" value={distance} onChange={(e) => setDistance(e.target.value)} />
            </div>
            <div>
              <label className="block px-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Estimated duration
              </label>
              <Input type="text" placeholder="6h 30m" value={duration} onChange={(e) => setDuration(e.target.value)} />
            </div>
          </div>

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
                        {townsExcluding([sp, fp]).map((t) => (
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
                        className="icon-btn"
                        title="Edit checkpoint"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteCpId(c._id)}
                        className="icon-btn-danger"
                        title="Delete checkpoint"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
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
              {availableTowns.map((t) => (
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
        </div>
      </EditModal>

      <ConfirmDialog
        open={deleteOpen}
        title="Delete route?"
        message={
          <>
            Delete the <span className="font-mono">{route.sp} → {route.fp}</span> route and all its
            checkpoints? This cannot be undone.
          </>
        }
        busy={busy}
        onConfirm={() => void handleDeleteRoute()}
        onCancel={() => setDeleteOpen(false)}
      />

      <ConfirmDialog
        open={deleteCpId !== null}
        title="Delete checkpoint?"
        message={
          <>
            Remove this checkpoint from the <span className="font-mono">{route.sp} → {route.fp}</span> route?
          </>
        }
        busy={busy}
        onConfirm={() => void handleDeleteCp()}
        onCancel={() => setDeleteCpId(null)}
      />
    </Card>
  );
}