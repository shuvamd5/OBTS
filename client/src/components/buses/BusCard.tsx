import { useState } from "react";
import { busesApi } from "../../api/buses";
import type { Bus, BusStatus } from "../../types";
import { PenIcon } from "../icons";
import Button from "../ui/Button";
import Card from "../ui/Card";
import Pill from "../ui/Pill";
import Select from "../ui/Select";

function StatusPill({ status }: { status: BusStatus }) {
  const dot: "green" | "red" | "amber" =
    status === "active" ? "green" : status === "inactive" ? "red" : "amber";
  return (
    <Pill className="capitalize" dot={dot}>
      {status}
    </Pill>
  );
}

export default function BusCard({
  bus,
  canEdit,
  isAdminRole,
  onStatus,
  onDeleted,
}: {
  bus: Bus;
  canEdit: boolean;
  isAdminRole: boolean;
  onStatus: (bstatus: BusStatus) => void;
  onDeleted: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  async function changeStatus(bstatus: BusStatus) {
    if (bstatus === bus.bstatus) return;
    setBusy(true);
    setError("");
    setMsg("");
    try {
      const { data } = await busesApi.updateStatus(bus._id, bstatus);
      onStatus(data.bus.bstatus);
      setEditing(false);
      if (data.bus.bsapby) setMsg(`Approved by ${data.bus.bsapby}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    setBusy(true);
    setError("");
    try {
      await busesApi.remove(bus._id);
      onDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
      setBusy(false);
    }
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-mono text-lg font-bold tracking-wide text-slate-900">
            {bus.bcd} {bus.bno}
          </p>
          <p className="text-sm font-medium text-slate-600">
            {bus.bname}
            {bus.ownerName && <span className="ml-2 text-xs text-slate-400">owned by {bus.ownerName}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusPill status={bus.bstatus} />
          {canEdit && (
            <button
              type="button"
              onClick={() => setEditing((e) => !e)}
              className="rounded-btn p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-brand-600"
              title="Edit status"
            >
              <PenIcon />
            </button>
          )}
        </div>
      </div>
      <div className="mt-2 space-y-1 text-sm text-slate-600">
        <p>
          Type: {bus.btype} · Seats: {bus.nseat} ({bus.stype})
        </p>
        {bus.bsapby !== "none" && <p className="text-xs text-slate-400">by {bus.bsapby}</p>}
      </div>

      {editing && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
          {isAdminRole ? (
            <Select
              value={bus.bstatus}
              disabled={busy}
              onChange={(e) => void changeStatus(e.target.value as BusStatus)}
              className="px-2 py-1"
            >
              <option value="unchecked">unchecked</option>
              <option value="active">active</option>
              <option value="inactive">inactive</option>
            </Select>
          ) : (
            <span className="text-xs font-medium text-slate-500">Status can only be set by an Admin.</span>
          )}
          <Button variant="secondary" size="xs" onClick={() => setEditing(false)}>
            Close
          </Button>
          {!confirm ? (
            <Button variant="danger" className="ml-auto" onClick={() => setConfirm(true)}>
              Delete
            </Button>
          ) : (
            <>
              <span className="text-xs text-red-600">Delete this bus?</span>
              <button
                type="button"
                onClick={() => void handleDelete()}
                disabled={busy}
                className="rounded-btn bg-red-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                Yes
              </button>
              <Button variant="secondary" size="xs" onClick={() => setConfirm(false)}>
                No
              </Button>
            </>
          )}
        </div>
      )}

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {msg && <p className="mt-2 text-sm text-green-600">{msg}</p>}
    </Card>
  );
}