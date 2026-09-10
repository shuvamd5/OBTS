import { useMemo, useState } from "react";
import { pricesApi } from "../../api/prices";
import { serializeError } from "../../api/client";
import type { PriceStatus, Route, Schedule } from "../../types";
import Button from "../ui/Button";
import Input from "../ui/Input";
import Select from "../ui/Select";
import StatusPill from "./StatusPill";

const highestCheckpointFare = (route?: Route) =>
  (route?.checkpoints ?? []).reduce((max, c) => Math.max(max, c.price), 0);

const compactClass = "px-2 py-1.5";

export default function PriceSection({
  s,
  isAdminRole,
  routes,
  editing,
  onPriceChanged,
}: {
  s: Schedule;
  isAdminRole: boolean;
  routes: Route[];
  editing: boolean;
  onPriceChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  const [assigning, setAssigning] = useState(false);
  const [newRid, setNewRid] = useState("");
  const [newPrice, setNewPrice] = useState("");

  const [editingPrice, setEditingPrice] = useState(false);
  const [editRid, setEditRid] = useState("");
  const [editPrice, setEditPrice] = useState("");

  const selectedEditRoute = useMemo(
    () => routes.find((r) => r._id === (editingPrice ? editRid : s.price?.rid._id)),
    [routes, editingPrice, editRid, s.price]
  );
  const minFare = highestCheckpointFare(selectedEditRoute);

  async function changePriceStatus(arstatus: PriceStatus) {
    if (!s.price || arstatus === s.price.arstatus) return;
    setBusy(true);
    setError("");
    try {
      await pricesApi.updateStatus(s.price._id, arstatus);
      setMsg("Price status updated.");
      onPriceChanged();
    } catch (err) {
      setError(serializeError(err));
    } finally {
      setBusy(false);
    }
  }

  async function assignFare(e: React.FormEvent) {
    e.preventDefault();
    if (!s || !newRid || newPrice === "") {
      setError("Select a route and enter a fare.");
      return;
    }
    setBusy(true);
    setError("");
    setMsg("");
    try {
      await pricesApi.assign({ bsid: s._id, rid: newRid, price: Number(newPrice) });
      setAssigning(false);
      setNewRid("");
      setNewPrice("");
      setMsg("Fare assigned — needs admin approval before passengers can book it.");
      onPriceChanged();
    } catch (err) {
      setError(serializeError(err));
    } finally {
      setBusy(false);
    }
  }

  async function savePriceEdits() {
    if (!s.price) return;
    setBusy(true);
    setError("");
    setMsg("");
    try {
      if (editRid && editRid !== s.price.rid._id) {
        await pricesApi.updateRoute(s.price._id, editRid);
      }
      if (editPrice !== "" && Number(editPrice) !== s.price.price) {
        await pricesApi.updatePrice(s.price._id, Number(editPrice));
      }
      setEditingPrice(false);
      setMsg("Fare updated — it goes back to unchecked for re-approval.");
      onPriceChanged();
    } catch (err) {
      setError(serializeError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleDeletePrice() {
    if (!s.price) return;
    setBusy(true);
    setError("");
    try {
      await pricesApi.remove(s.price._id);
      setConfirm(false);
      onPriceChanged();
    } catch (err) {
      setError(serializeError(err));
      setBusy(false);
    }
  }

  if (!s.price) {
    if (!editing) {
      return (
        <div className="mt-3 border-t border-slate-100 pt-3 text-sm">
          <p className="text-xs text-slate-400">No fare/route assigned yet.</p>
        </div>
      );
    }
    return (
      <div className="mt-3 border-t border-slate-100 pt-3 text-sm">
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-600">Assign a route and fare to this schedule.</p>
          {assigning ? (
            <Button variant="secondary" size="xs" onClick={() => setAssigning(false)}>
              Cancel
            </Button>
          ) : (
            <Button variant="secondary" size="xs" onClick={() => setAssigning(true)}>
              Assign route + fare
            </Button>
          )}
        </div>
        {assigning && (
          <form onSubmit={assignFare} className="mt-2 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Select value={newRid} onChange={(e) => setNewRid(e.target.value)} className={compactClass}>
                <option value="">Select route...</option>
                {routes.map((r) => (
                  <option key={r._id} value={r._id}>
                    {r.sp} → {r.fp}
                  </option>
                ))}
              </Select>
              <Input
                type="number"
                min="0"
                step="1"
                placeholder="Fare (Rs.)"
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                className={`${compactClass} w-28`}
              />
              <Button type="submit" size="sm" disabled={busy}>
                {busy ? "Assigning..." : "Assign"}
              </Button>
            </div>
            {routes.length === 0 && (
              <p className="text-xs text-slate-400">Add routes first — a fare is tied to a route.</p>
            )}
            {error && <p className="text-sm text-red-600">{error}</p>}
            {msg && <p className="text-sm text-green-600">{msg}</p>}
          </form>
        )}
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-2 border-t border-slate-100 pt-3 text-sm text-slate-600">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-slate-800">
          {s.price.rid.sp} → {s.price.rid.fp}
          {" · "}
          <span className="font-semibold text-slate-900">Rs. {s.price.price}</span>
        </p>
        <StatusPill status={s.price.arstatus} />
      </div>

      {!editing && <p className="text-xs text-slate-400">Click the pen to manage the fare.</p>}

      {editing && isAdminRole && (
        <div className="flex items-center gap-2">
          <Select
            value={s.price.arstatus}
            disabled={busy}
            onChange={(e) => void changePriceStatus(e.target.value as PriceStatus)}
            className={compactClass}
          >
            <option value="unchecked">unchecked</option>
            <option value="not ok">not ok</option>
            <option value="ok">ok</option>
          </Select>
          <span className="text-xs text-slate-400">approve fare for booking</span>
        </div>
      )}

      {editing && (
        <div className="flex flex-wrap items-center gap-2">
          {!editingPrice ? (
            <>
              <Button
                variant="secondary"
                size="xs"
                onClick={() => {
                  setEditRid(s.price!.rid._id);
                  setEditPrice(String(s.price!.price));
                  setEditingPrice(true);
                }}
              >
                Edit route / fare
              </Button>
              {!confirm ? (
                <Button variant="danger" onClick={() => setConfirm(true)}>
                  Delete fare
                </Button>
              ) : (
                <>
                  <span className="text-xs text-red-600">Delete this fare?</span>
                  <button
                    type="button"
                    onClick={() => void handleDeletePrice()}
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
            </>
          ) : (
            <>
              <Select value={editRid} onChange={(e) => setEditRid(e.target.value)} className={compactClass}>
                {routes.map((r) => (
                  <option key={r._id} value={r._id}>
                    {r.sp} → {r.fp}
                  </option>
                ))}
              </Select>
              <Input
                type="number"
                min="0"
                step="1"
                value={editPrice}
                onChange={(e) => setEditPrice(e.target.value)}
                className={`${compactClass} w-28`}
              />
              <Button size="sm" onClick={() => void savePriceEdits()} disabled={busy}>
                Save
              </Button>
              <Button variant="secondary" size="xs" onClick={() => setEditingPrice(false)}>
                Cancel
              </Button>
            </>
          )}
          {editingPrice && minFare > 0 && editPrice !== "" && Number(editPrice) <= minFare && (
            <span className="text-xs font-medium text-red-600">
              must exceed highest checkpoint fare (Rs. {minFare})
            </span>
          )}
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      {msg && <p className="text-sm text-green-600">{msg}</p>}
    </div>
  );
}