import { useState } from "react";
import { schedulesApi } from "../../api/schedules";
import { serializeError } from "../../api/client";
import { fmtDate } from "../../lib/date";
import type { Route, Schedule, ScheduleStatus } from "../../types";
import { PenIcon } from "../icons";
import Button from "../ui/Button";
import Card from "../ui/Card";
import Select from "../ui/Select";
import PriceSection from "./PriceSection";
import StatusPill from "./StatusPill";

const compactClass = "px-2 py-1.5";

export default function ScheduleCard({
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
    <Card>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-mono text-lg font-bold tracking-wide text-slate-900">
            {s.bus?.bcd} {s.bus?.bno}
          </p>
          <p className="text-sm font-medium text-slate-600">{s.bus?.bname}</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusPill status={s.bsstatus} />
          <button
            type="button"
            onClick={() => {
              setEditing((e) => !e);
              setError("");
              setMsg("");
            }}
            className="rounded-btn p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-brand-600"
            title="Manage schedule"
          >
            <PenIcon />
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
              <Select
                value={s.bsstatus}
                disabled={busy}
                onChange={(e) => void changeStatus(e.target.value as ScheduleStatus)}
                className={compactClass}
              >
                <option value="not approved">not approved</option>
                <option value="going">going</option>
                <option value="not going">not going</option>
                <option value="pending">pending</option>
              </Select>
              <span className="text-xs text-slate-400">approve schedule</span>
            </div>
          ) : (
            <p className="text-xs font-medium text-slate-500">
              Schedule status can only be set by an Admin.
            </p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
            {!confirm ? (
              <Button variant="danger" onClick={() => setConfirm(true)}>
                Delete schedule
              </Button>
            ) : (
              <>
                <span className="text-xs text-red-600">Delete this schedule?</span>
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
    </Card>
  );
}