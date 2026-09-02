import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { busesApi } from "../api/buses";
import { isAdmin, isStaff } from "../lib/roles";
import type { Bus, BusStatus } from "../types";

const statusBadge = (s: BusStatus) =>
  s === "active"
    ? "bg-green-50 text-green-700"
    : s === "inactive"
    ? "bg-red-50 text-red-700"
    : "bg-amber-50 text-amber-700";

const penIcon = (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
  </svg>
);

function BusCard({
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
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className="text-lg font-bold tracking-wide text-slate-800">
            {bus.bcd} <span className="text-blue-600">{bus.bno}</span>
          </p>
          <p className="text-sm font-medium text-slate-600">
            {bus.bname}
            {bus.ownerName && <span className="ml-2 text-xs text-slate-400">owned by {bus.ownerName}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusBadge(bus.bstatus)}`}>
            {bus.bstatus}
          </span>
          {canEdit && (
            <button
              onClick={() => setEditing((e) => !e)}
              className="rounded-md border border-slate-300 p-1.5 text-slate-500 hover:bg-slate-100"
              title="Edit status"
            >
              {penIcon}
            </button>
          )}
        </div>
      </div>
      <div className="mt-2 text-sm text-slate-600 space-y-1">
        <p>
          Type: {bus.btype} · Seats: {bus.nseat} ({bus.stype})
        </p>
        {bus.bsapby !== "none" && <p className="text-xs text-slate-400">by {bus.bsapby}</p>}
      </div>

      {editing && (
        <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3">
          {isAdminRole ? (
            <select
              value={bus.bstatus}
              disabled={busy}
              onChange={(e) => void changeStatus(e.target.value as BusStatus)}
              className="rounded-lg border border-slate-300 px-2 py-1 text-sm"
            >
              <option value="unchecked">unchecked</option>
              <option value="active">active</option>
              <option value="inactive">inactive</option>
            </select>
          ) : (
            <span className="text-xs font-medium text-blue-600">Status can only be set by an Admin.</span>
          )}
          <button
            onClick={() => setEditing(false)}
            className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs text-slate-600"
          >
            Close
          </button>
          {!confirm ? (
            <button
              onClick={() => setConfirm(true)}
              className="ml-auto rounded-lg border border-red-300 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
            >
              Delete
            </button>
          ) : (
            <>
              <span className="text-xs text-red-600">Delete this bus?</span>
              <button
                onClick={() => void handleDelete()}
                disabled={busy}
                className="rounded-lg bg-red-600 px-2.5 py-1 text-xs font-medium text-white disabled:opacity-50"
              >
                Yes
              </button>
              <button
                onClick={() => setConfirm(false)}
                className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs text-slate-600"
              >
                No
              </button>
            </>
          )}
        </div>
      )}

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {msg && <p className="mt-2 text-sm text-green-600">{msg}</p>}
    </div>
  );
}

export default function BusesPage() {
  const { user } = useAuth();
  const isAdminRole = isAdmin(user);
  const staff = isStaff(user);

  const [buses, setBuses] = useState<Bus[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    busesApi
      .list()
      .then(({ data }) => {
        if (!cancelled) setBuses(data.buses);
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load buses");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function upsert(bus: Bus) {
    setBuses((prev) => {
      const exists = prev.some((x) => x._id === bus._id);
      return exists ? prev.map((x) => (x._id === bus._id ? bus : x)) : [bus, ...prev];
    });
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-blue-600">Buses</h1>
        {staff && (
          <Link
            to="/buses/add"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            + Add Bus
          </Link>
        )}
      </div>

      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

      {buses.length === 0 ? (
        <p className="text-slate-500">No buses available.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {buses.map((b) => (
            <BusCard
              key={b._id}
              bus={b}
              canEdit={staff}
              isAdminRole={isAdminRole}
              onStatus={(bstatus) => upsert({ ...b, bstatus })}
              onDeleted={() => setBuses((prev) => prev.filter((x) => x._id !== b._id))}
            />
          ))}
        </div>
      )}
    </div>
  );
}
