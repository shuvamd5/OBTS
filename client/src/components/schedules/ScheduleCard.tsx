import { useState } from "react";
import { schedulesApi } from "../../api/schedules";
import { pricesApi } from "../../api/prices";
import { serializeError } from "../../api/client";
import { fmtDate, todayPlusDays } from "../../lib/date";
import type { Route, Schedule, ScheduleStatus } from "../../types";
import type { PillDot } from "../ui/Pill";
import Card from "../ui/Card";
import CardActions from "../ui/CardActions";
import ConfirmDialog from "../ui/ConfirmDialog";
import EditModal from "../ui/EditModal";
import StatusChangeDialog, { type StatusOption } from "../ui/StatusChangeDialog";
import Input from "../ui/Input";
import PriceSection from "./PriceSection";

const schedDot = (status: ScheduleStatus): PillDot =>
  status === "approved"
    ? "green"
    : status === "not_going"
    ? "red"
    : status === "expired"
    ? "slate"
    : "amber";

const STATUS_OPTIONS: StatusOption<ScheduleStatus>[] = [
  { value: "pending", label: "Pending", dot: "amber" },
  { value: "approved", label: "Approved", dot: "green" },
  { value: "not_going", label: "Not Going", dot: "red" },
];

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
  const [editOpen, setEditOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  const [trdate, setTrdate] = useState("");
  const [trtime, setTrtime] = useState("");
  const [editRid, setEditRid] = useState("");
  const [editPrice, setEditPrice] = useState("");

  const openEdit = () => {
    setTrdate(fmtDate(s.trdate));
    setTrtime(s.trtime);
    setEditRid(s.price?.rid?._id ?? "");
    setEditPrice("");
    setError("");
    setMsg("");
    setEditOpen(true);
  };

  async function changeStatus(bsstatus: ScheduleStatus) {
    setBusy(true);
    setError("");
    setMsg("");
    try {
      const { data } = await schedulesApi.updateStatus(s._id, bsstatus);
      onUpdate({ ...s, bsstatus, bssapby: data.schedule.bssapby });
      setMsg(data.message === "No change" ? "No change" : `Status updated by ${data.schedule.bssapby}`);
    } catch (err) {
      setError(serializeError(err));
    } finally {
      setBusy(false);
      setStatusOpen(false);
    }
  }

  async function handleEditSave() {
    const schedChanges: { trdate?: string; trtime?: string } = {};
    if (trdate && trdate !== fmtDate(s.trdate)) schedChanges.trdate = trdate;
    if (trtime !== s.trtime) schedChanges.trtime = trtime;

    const ridChanged = s.price != null && editRid !== "" && editRid !== (s.price.rid?._id ?? "");
    const priceChanged = s.price != null && editPrice !== "" && Number(editPrice) !== s.price.price;

    if (Object.keys(schedChanges).length === 0 && !ridChanged && !priceChanged) {
      setError("No changes to save.");
      return;
    }

    setBusy(true);
    setError("");
    setMsg("");
    try {
      if (Object.keys(schedChanges).length > 0) {
        const { data } = await schedulesApi.update(s._id, schedChanges);
        onUpdate({
          ...s,
          trdate: data.schedule.trdate,
          trtime: data.schedule.trtime,
          bsstatus: data.schedule.bsstatus,
          bssapby: data.schedule.bssapby,
        });
      }
      if (s.price) {
        if (ridChanged) {
          await pricesApi.updateRoute(s.price._id, editRid);
        }
        if (priceChanged) {
          await pricesApi.updatePrice(s.price._id, Number(editPrice));
        }
        if (ridChanged || priceChanged) {
          onPriceChanged();
        }
      }
      setEditOpen(false);
      if (Object.keys(schedChanges).length > 0 && (ridChanged || priceChanged)) {
        setMsg("Schedule and fare updated — both reset to pending for approval.");
      } else if (Object.keys(schedChanges).length > 0) {
        setMsg("Schedule updated — status reset to pending for approval.");
      } else {
        setMsg("Fare updated — it goes back to pending for re-approval.");
      }
    } catch (err) {
      setError(serializeError(err));
      setBusy(false);
    }
  }

  const handleAssigned = () => {
    setEditOpen(false);
    setMsg(
      s.bsstatus === "approved"
        ? "Fare assigned and approved."
        : "Fare assigned — needs approval before passengers can book it."
    );
  };

  async function handleDelete() {
    setBusy(true);
    setError("");
    setMsg("");
    try {
      await schedulesApi.remove(s._id);
      onDeleted();
    } catch (err) {
      setError(serializeError(err));
      setBusy(false);
      setDeleteOpen(false);
    }
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-mono text-lg font-bold tracking-wide text-slate-900">
            {s.bus?.plateNumber}
          </p>
          <p className="text-sm font-medium text-slate-600">{s.bus?.bname}</p>
        </div>
        <CardActions
          status={s.bsstatus}
          dot={schedDot(s.bsstatus)}
          canChangeStatus={isAdminRole}
          onStatus={() => setStatusOpen(true)}
          canEdit={true}
          onEdit={openEdit}
          onDelete={() => setDeleteOpen(true)}
        />
      </div>
      <div className="mt-2 text-sm text-slate-600">
        {s.price?.rid && (
          <p className="min-h-5 leading-5 font-medium text-slate-700">
            {s.price.rid.sp} <span className="text-slate-400">→</span> {s.price.rid.fp}
          </p>
        )}
        <p className="min-h-5 leading-5">
          {fmtDate(s.trdate)} at {s.trtime}
        </p>
        <p className="min-h-5 text-xs leading-5 text-slate-400">
          {s.bus?.busType ? `${s.bus.busType.name} · ${s.bus.busType.seatCount} seats` : ""}
        </p>
        <PriceSection s={s} routes={routes} editing={false} onPriceChanged={onPriceChanged} />
        <p className="mt-1 min-h-5 text-right text-xs leading-5 text-slate-400">
          {msg ? msg : s.bssapby !== "none" ? `by ${s.bssapby}` : ""}
        </p>
      </div>

      

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {/* {msg && <p className="mt-2 text-sm text-green-600">{msg}</p>} */}

      <StatusChangeDialog
        open={statusOpen}
        title={<>Change schedule status for <span className="font-mono">{s.bus?.plateNumber}</span></>}
        current={s.bsstatus}
        options={STATUS_OPTIONS}
        busy={busy}
        onConfirm={(next) => void changeStatus(next)}
        onCancel={() => setStatusOpen(false)}
      />

      <EditModal
        open={editOpen}
        title={<>Edit schedule <span className="font-mono">{s.bus?.plateNumber}</span></>}
        busy={busy}
        confirmNote="Any edits reset the schedule and fare to pending for approval. Save these changes?"
        error={error}
        onSave={() => void handleEditSave()}
        onClose={() => setEditOpen(false)}
      >
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block px-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Travelling date
              </label>
              <Input
                type="date"
                min={todayPlusDays(4)}
                value={trdate}
                onChange={(e) => setTrdate(e.target.value)}
              />
            </div>
            <div>
              <label className="block px-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Time
              </label>
              <Input type="time" value={trtime} onChange={(e) => setTrtime(e.target.value)} />
            </div>
          </div>
          <PriceSection
            s={s}
            routes={routes}
            editing={true}
            onPriceChanged={onPriceChanged}
            onAssigned={handleAssigned}
            editRid={editRid}
            onEditRidChange={setEditRid}
            editPrice={editPrice}
            onEditPriceChange={setEditPrice}
          />
        </div>
      </EditModal>

      <ConfirmDialog
        open={deleteOpen}
        title="Delete schedule?"
        message={
          <>
            Delete the <span className="font-mono">{s.bus?.plateNumber}</span> schedule on{" "}
            {fmtDate(s.trdate)} at {s.trtime}? This cannot be undone.
          </>
        }
        busy={busy}
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteOpen(false)}
      />
    </Card>
  );
}