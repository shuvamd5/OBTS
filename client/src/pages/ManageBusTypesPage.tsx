import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { busTypesApi, type BusTypePayload } from "../api/busTypes";
import { serializeError } from "../api/client";
import type { BusType, SeatStyle } from "../types";
import Card from "../components/ui/Card";
import CardActions from "../components/ui/CardActions";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import EditModal from "../components/ui/EditModal";
import Input from "../components/ui/Input";
import Select from "../components/ui/Select";

const SEAT_STYLES: SeatStyle[] = ["standard", "semi-luxury", "luxury"];

function seatCountError(value: number): string | null {
  if (!Number.isInteger(value)) return "Seat count must be a whole number.";
  if (value <= 28) return "Seat count must be greater than 28.";
  if (value % 2 !== 1) return "Seat count must be an odd number.";
  return null;
}

export default function ManageBusTypesPage() {
  const queryClient = useQueryClient();

  const listQuery = useQuery({
    queryKey: ["bus-types", "admin"],
    queryFn: () => busTypesApi.list().then(({ data }) => data.busTypes),
  });
  const listError = listQuery.isError ? serializeError(listQuery.error) : "";
  const busTypes: BusType[] = listQuery.data ?? [];

  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  const [editId, setEditId] = useState("");
  const [editName, setEditName] = useState("");
  const [editSeatCount, setEditSeatCount] = useState("");
  const [editSeatStyle, setEditSeatStyle] = useState<SeatStyle>("standard");
  const [deleteId, setDeleteId] = useState("");
  const [busy, setBusy] = useState(false);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["bus-types", "admin"] });

  const editingType = busTypes.find((t) => t._id === editId);

  function openEdit(t: BusType) {
    setEditId(t._id);
    setEditName(t.name);
    setEditSeatCount(String(t.seatCount));
    setEditSeatStyle(t.seatStyle);
    setError("");
    setMsg("");
  }

  async function handleEditSave() {
    if (!editingType) return;
    const n = Number(editSeatCount);
    const scErr = seatCountError(n);
    if (scErr) {
      setError(scErr);
      return;
    }
    if (!editName.trim()) {
      setError("Name is required.");
      return;
    }
    const payload: Partial<BusTypePayload> = {};
    if (editName.trim() !== editingType.name) payload.name = editName.trim();
    if (n !== editingType.seatCount) payload.seatCount = n;
    if (editSeatStyle !== editingType.seatStyle) payload.seatStyle = editSeatStyle;

    if (Object.keys(payload).length === 0) {
      setError("No changes to save.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      await busTypesApi.update(editId, payload);
      setEditId("");
      setMsg("Bus type updated.");
      invalidate();
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
      await busTypesApi.remove(deleteId);
      setDeleteId("");
      setMsg("Bus type deleted.");
      invalidate();
    } catch (err) {
      setError(serializeError(err));
      setBusy(false);
      setDeleteId("");
    }
  }

  const deletingType = busTypes.find((t) => t._id === deleteId);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Bus Types</h1>
        <Link to="/bus-types/add" className="btn-primary">
          + Add Bus Type
        </Link>
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      {msg && <p className="mb-4 text-sm text-green-600">{msg}</p>}

      {listError && <p className="mb-4 text-sm text-red-600">{listError}</p>}

      {!listError && busTypes.length === 0 ? (
        <p className="text-slate-500">No bus types yet — add one above.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {busTypes.map((t) => (
            <Card key={t._id} pad="4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">{t.name}</p>
                  <p className="text-sm text-slate-500">
                    {t.seatCount} seats · {t.seatStyle}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">{t.busCount ?? 0} bus(es)</p>
                </div>
                <CardActions
                  canEdit={true}
                  onEdit={() => openEdit(t)}
                  onDelete={() => {
                    setDeleteId(t._id);
                    setMsg("");
                    setError("");
                  }}
                />
              </div>
            </Card>
          ))}
        </div>
      )}

      <EditModal
        open={editId !== ""}
        title={<>Edit bus type <span className="font-mono">{editingType?.name}</span></>}
        busy={busy}
        error={error}
        onSave={() => void handleEditSave()}
        onClose={() => setEditId("")}
      >
        <div className="space-y-3">
          <div>
            <label className="block px-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Name
            </label>
            <Input
              type="text"
              placeholder="e.g. Volvo A/C Seater"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block px-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Seat count
              </label>
              <Input
                type="number"
                placeholder="odd, > 28"
                value={editSeatCount}
                onChange={(e) => setEditSeatCount(e.target.value)}
                className="w-full"
              />
            </div>
            <div>
              <label className="block px-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Seat style
              </label>
              <Select
                value={editSeatStyle}
                onChange={(e) => setEditSeatStyle(e.target.value as SeatStyle)}
                className="w-full"
              >
                {SEAT_STYLES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </Select>
            </div>
          </div>
          {editingType && editingType.busCount !== undefined && editingType.busCount > 0 && (
            <p className="text-xs text-amber-600">
              This type is used by {editingType.busCount} bus(es) — the server may reject the edit.
            </p>
          )}
        </div>
      </EditModal>

      <ConfirmDialog
        open={deleteId !== ""}
        title="Delete bus type?"
        message={
          <>
            Delete <span className="font-mono">{deletingType?.name}</span> ({deletingType?.seatCount} seats)?
            This cannot be undone.
          </>
        }
        busy={busy}
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteId("")}
      />
    </div>
  );
}