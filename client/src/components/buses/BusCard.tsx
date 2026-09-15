import { useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { busesApi, type BusEditPayload } from "../../api/buses";
import { serializeError } from "../../api/client";
import type { Bus, BusStatus, BusType } from "../../types";
import type { PillDot } from "../ui/Pill";
import Card from "../ui/Card";
import CardActions from "../ui/CardActions";
import ConfirmDialog from "../ui/ConfirmDialog";
import EditModal from "../ui/EditModal";
import StatusChangeDialog, { type StatusOption } from "../ui/StatusChangeDialog";
import Input from "../ui/Input";
import Select from "../ui/Select";

const AMENITIES = ["wifi", "ac", "charging", "recliner", "blanket"];

const busDot = (status: BusStatus): PillDot =>
  status === "active" ? "green" : status === "inactive" ? "red" : "amber";

const STATUS_OPTIONS: StatusOption<BusStatus>[] = [
  { value: "pending", label: "pending", dot: "amber" },
  { value: "active", label: "active", dot: "green" },
  { value: "inactive", label: "inactive", dot: "red" },
];

export default function BusCard({
  bus,
  canEdit,
  isAdminRole,
  busTypes,
  onStatus,
  onUpdated,
  onDeleted,
}: {
  bus: Bus;
  canEdit: boolean;
  isAdminRole: boolean;
  busTypes: BusType[];
  onStatus: (bstatus: BusStatus) => void;
  onUpdated: (bus: Bus) => void;
  onDeleted: () => void;
}) {
  const queryClient = useQueryClient();

  const [editOpen, setEditOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  const [plateNumber, setPlateNumber] = useState(bus.plateNumber);
  const [busTypeId, setBusTypeId] = useState(bus.busTypeId ?? "");
  const [bname, setBname] = useState(bus.bname);
  const [amenities, setAmenities] = useState<string[]>(bus.amenities ?? []);

  const openEdit = () => {
    setPlateNumber(bus.plateNumber);
    setBusTypeId(bus.busTypeId ?? "");
    setBname(bus.bname);
    setAmenities(bus.amenities ?? []);
    setError("");
    setMsg("");
    setEditOpen(true);
  };

  async function changeStatus(next: BusStatus) {
    setBusy(true);
    setError("");
    setMsg("");
    try {
      const { data } = await busesApi.updateStatus(bus._id, next);
      onStatus(data.bus.bstatus);
      if (data.bus.bsapby) setMsg(`Approved by ${data.bus.bsapby}`);
    } catch (err) {
      setError(serializeError(err));
    } finally {
      setBusy(false);
      setStatusOpen(false);
    }
  }

  async function handleEditSave() {
    if (!plateNumber.trim() || !busTypeId || !bname.trim()) {
      setError("Plate number, bus type, and bus name are required.");
      return;
    }
    const changes: BusEditPayload = {};
    const plate = plateNumber.trim().toUpperCase();
    if (plate !== bus.plateNumber) changes.plateNumber = plate;
    if (busTypeId !== bus.busTypeId) changes.busTypeId = busTypeId;
    if (bname.trim() !== bus.bname) changes.bname = bname.trim();
    const cur = bus.amenities ?? [];
    if (amenities.length !== cur.length || amenities.some((a) => !cur.includes(a))) {
      changes.amenities = amenities;
    }

    if (Object.keys(changes).length === 0) {
      setError("No changes to save.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      const { data } = await busesApi.update(bus._id, changes);
      onUpdated(data.bus);
      setEditOpen(false);
      setMsg(data.bus.bstatus === "pending" ? "Saved — status reset to pending for approval." : "Bus updated.");
      await queryClient.invalidateQueries({ queryKey: ["buses"] });
    } catch (err) {
      setError(serializeError(err));
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
      setError(serializeError(err));
      setBusy(false);
      setDeleteOpen(false);
    }
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-2">
        <div>
          <Link
            to={`/buses/${bus._id}`}
            className="font-mono text-lg font-bold tracking-wide text-slate-900 hover:text-brand-700"
          >
            {bus.plateNumber}
          </Link>
          <p className="text-sm font-medium text-slate-600">
            {bus.bname}
            {bus.ownerName && <span className="ml-2 text-xs text-slate-400">owned by {bus.ownerName}</span>}
          </p>
        </div>
        <CardActions
          status={bus.bstatus}
          dot={busDot(bus.bstatus)}
          canChangeStatus={isAdminRole}
          onStatus={() => setStatusOpen(true)}
          canEdit={canEdit}
          onEdit={openEdit}
          onDelete={() => setDeleteOpen(true)}
        />
      </div>
      <div className="mt-2 text-sm text-slate-600">
        <p className="min-h-5 leading-5">
          {bus.busType ? (
            <>
              {bus.busType.name} · {bus.busType.seatCount} seats
            </>
          ) : (
            ""
          )}
        </p>
        <div className="flex min-h-10 flex-wrap items-center gap-1 text-xs">
          {(bus.amenities ?? []).map((a) => (
            <span key={a} className="rounded-btn bg-slate-100 px-2 py-0.5 capitalize text-slate-500">
              {a}
            </span>
          ))}
        </div>
        <p className="mt-1 min-h-4 text-right text-xs leading-4 text-slate-400">
          {msg ? msg : bus.bsapby && bus.bsapby !== "none" ? `by ${bus.bsapby}` : ""}
        </p>
      </div>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {/* {msg && <p className="mt-2 text-sm text-green-600">{msg}</p>} */}

      <StatusChangeDialog
        open={statusOpen}
        title={<>Change status for <span className="font-mono">{bus.plateNumber}</span></>}
        current={bus.bstatus}
        options={STATUS_OPTIONS}
        busy={busy}
        onConfirm={(next) => void changeStatus(next)}
        onCancel={() => setStatusOpen(false)}
      />

      <EditModal
        open={editOpen}
        title={<>Edit bus <span className="font-mono">{bus.plateNumber}</span></>}
        busy={busy}
        confirmNote="Saving will reset the status to pending for approval. Save these changes?"
        error={error}
        onSave={() => void handleEditSave()}
        onClose={() => setEditOpen(false)}
      >
        <div className="space-y-3">
          <div>
            <label className="block px-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Bus type
            </label>
            <Select value={busTypeId} onChange={(e) => setBusTypeId(e.target.value)} className="w-full">
              <option value="">Select bus type...</option>
              {busTypes.map((t) => (
                <option key={t._id} value={t._id}>
                  {t.name} / {t.seatCount} seats / {t.seatStyle}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="block px-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Plate number
            </label>
            <Input
              type="text"
              placeholder="e.g. BA 1 JA 2345"
              value={plateNumber}
              onChange={(e) => setPlateNumber(e.target.value.toUpperCase())}
              className="w-full"
            />
          </div>
          <div>
            <label className="block px-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Bus name
            </label>
            <Input
              type="text"
              placeholder="NAME"
              value={bname}
              onChange={(e) => setBname(e.target.value)}
              className="w-full"
            />
          </div>
          <fieldset>
            <legend className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Amenities
            </legend>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
              {AMENITIES.map((a) => (
                <label key={a} className="inline-flex items-center gap-1 capitalize">
                  <input
                    type="checkbox"
                    checked={amenities.includes(a)}
                    onChange={() =>
                      setAmenities((prev) =>
                        prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]
                      )
                    }
                  />
                  {a}
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      </EditModal>

      <ConfirmDialog
        open={deleteOpen}
        title="Delete bus?"
        message={
          <>
            Delete <span className="font-mono">{bus.plateNumber}</span> ({bus.bname})? This cannot be undone.
          </>
        }
        busy={busy}
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteOpen(false)}
      />
    </Card>
  );
}