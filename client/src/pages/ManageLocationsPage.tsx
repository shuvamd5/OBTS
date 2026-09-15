import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { locationsApi, type LocationDoc } from "../api/locations";
import { serializeError } from "../api/client";
import Card from "../components/ui/Card";
import CardActions from "../components/ui/CardActions";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import EditModal from "../components/ui/EditModal";
import Input from "../components/ui/Input";
import Button from "../components/ui/Button";

export default function ManageLocationsPage() {
  const queryClient = useQueryClient();

  const listQuery = useQuery({
    queryKey: ["locations", "admin"],
    queryFn: () => locationsApi.list().then(({ data }) => data.locations),
  });
  const listError = listQuery.isError ? serializeError(listQuery.error) : "";
  const locations: LocationDoc[] = listQuery.data ?? [];

  const [newName, setNewName] = useState("");
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  const [editId, setEditId] = useState("");
  const [editName, setEditName] = useState("");
  const [deleteId, setDeleteId] = useState("");
  const [busy, setBusy] = useState(false);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["locations", "admin"] });

  const editingLocation = locations.find((l) => l._id === editId);
  const deletingLocation = locations.find((l) => l._id === deleteId);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMsg("");
    if (!newName.trim()) {
      setError("Town name is required.");
      return;
    }
    setBusy(true);
    try {
      await locationsApi.create(newName.trim());
      setNewName("");
      setMsg("Town added.");
      invalidate();
    } catch (err) {
      setError(serializeError(err));
    } finally {
      setBusy(false);
    }
  }

  function openEdit(l: LocationDoc) {
    setEditId(l._id);
    setEditName(l.name);
    setError("");
    setMsg("");
  }

  async function handleEditSave() {
    if (!editName.trim()) {
      setError("Town name is required.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await locationsApi.update(editId, editName.trim());
      setEditId("");
      setMsg("Town updated.");
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
      await locationsApi.remove(deleteId);
      setDeleteId("");
      setMsg("Town deleted.");
      invalidate();
    } catch (err) {
      setError(serializeError(err));
      setBusy(false);
      setDeleteId("");
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Locations</h1>
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      {msg && <p className="mb-4 text-sm text-green-600">{msg}</p>}
      {listError && <p className="mb-4 text-sm text-red-600">{listError}</p>}

      <form onSubmit={handleCreate} className="card rounded-panel p-6">
        <h2 className="font-semibold text-slate-800">Add a town / place</h2>
        <p className="mt-1 text-xs text-slate-400">
          Used as route start/end points and checkpoints. Towns can be anywhere — including places
          outside Nepal on cross-border routes.
        </p>
        <div className="mt-3 flex gap-2">
          <Input
            type="text"
            placeholder="e.g. Gorakhpur"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="flex-1"
          />
          <Button type="submit" disabled={busy}>
            {busy ? "Adding..." : "Add town"}
          </Button>
        </div>
      </form>

      <div className="mt-5">
        {!listError && locations.length === 0 ? (
          <p className="text-slate-500">No towns yet — add one above.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {locations.map((l) => (
              <Card key={l._id} pad="4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900">{l.name}</p>
                    <p className="mt-1 text-xs text-slate-400">{l.usageCount ?? 0} route stop(s)</p>
                  </div>
                  <CardActions
                    canEdit={true}
                    onEdit={() => openEdit(l)}
                    onDelete={() => {
                      setDeleteId(l._id);
                      setMsg("");
                      setError("");
                    }}
                  />
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <EditModal
        open={editId !== ""}
        title={<>Edit town <span className="font-mono">{editingLocation?.name}</span></>}
        busy={busy}
        error={error}
        confirmNote={
          editingLocation && editingLocation.usageCount && editingLocation.usageCount > 0
            ? "This town is used by routes — the server will block the rename."
            : undefined
        }
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
              placeholder="Town name"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full"
            />
          </div>
        </div>
      </EditModal>

      <ConfirmDialog
        open={deleteId !== ""}
        title="Delete town?"
        message={
          <>
            Delete <span className="font-mono">{deletingLocation?.name}</span>? Towns used by any
            route cannot be deleted.
          </>
        }
        busy={busy}
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteId("")}
      />
    </div>
  );
}