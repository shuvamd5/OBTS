import { useMemo, useState } from "react";
import { pricesApi } from "../../api/prices";
import { serializeError } from "../../api/client";
import type { Route, Schedule } from "../../types";
import Button from "../ui/Button";
import Input from "../ui/Input";
import Select from "../ui/Select";

const highestCheckpointFare = (route?: Route) =>
  (route?.checkpoints ?? []).reduce((max, c) => Math.max(max, c.price), 0);

const compactClass = "px-2 py-1.5";

export default function PriceSection({
  s,
  routes,
  editing,
  onPriceChanged,
  onAssigned,
  editRid,
  onEditRidChange,
  editPrice,
  onEditPriceChange,
}: {
  s: Schedule;
  routes: Route[];
  editing: boolean;
  onPriceChanged: () => void;
  onAssigned?: () => void;
  editRid?: string;
  onEditRidChange?: (v: string) => void;
  editPrice?: string;
  onEditPriceChange?: (v: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  const [assigning, setAssigning] = useState(false);
  const [newRid, setNewRid] = useState("");
  const [newPrice, setNewPrice] = useState("");

  const selectedEditRoute = useMemo(
    () => routes.find((r) => r._id === (editRid || (s.price?.rid?._id ?? ""))),
    [routes, editRid, s.price]
  );
  const minFare = highestCheckpointFare(selectedEditRoute);

  const selectedNewRoute = useMemo(() => routes.find((r) => r._id === newRid), [routes, newRid]);
  const newMinFare = highestCheckpointFare(selectedNewRoute);

  async function assignFare(e: React.FormEvent) {
    e.preventDefault();
    if (!s || !newRid || newPrice === "") {
      setError("Select a route and enter a fare.");
      return;
    }
    if (Number(newPrice) <= newMinFare) {
      setError(`Fare must exceed the highest checkpoint fare (Rs. ${newMinFare}).`);
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
      if (onAssigned) {
        onAssigned();
      } else {
        setMsg("Fare assigned — needs admin approval before passengers can book it.");
      }
      onPriceChanged();
    } catch (err) {
      setError(serializeError(err));
    } finally {
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
              <Button type="submit" size="sm" disabled={busy || routes.length === 0}>
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
    <div className="mt-1 mb-2 space-y-2 border-t border-slate-100 pt-1 text-sm text-slate-600">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-slate-800">
          <span className="text-xs text-slate-500">Fare </span>
          <span className="font-semibold text-slate-900">Rs. {s.price.price}</span>
        </p>
      </div>

      {/* {!editing && <p className="text-xs text-slate-400">Click the pen to manage the fare.</p>} */}

      {editing && onEditRidChange && onEditPriceChange && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-40">
              <label className="block px-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Route
              </label>
              <Select value={editRid} onChange={(e) => onEditRidChange(e.target.value)} className={compactClass}>
                {routes.map((r) => (
                  <option key={r._id} value={r._id}>
                    {r.sp} → {r.fp}
                  </option>
                ))}
              </Select>
            </div>
            <div className="min-w-32">
              <label className="block px-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                New fare (Rs.)
              </label>
              <Input
                type="number"
                min="0"
                step="1"
                placeholder={`${s.price.price}`}
                value={editPrice}
                onChange={(e) => onEditPriceChange(e.target.value)}
                className={`${compactClass} w-28`}
              />
            </div>
          </div>
          {minFare > 0 && editPrice !== "" && Number(editPrice) <= minFare && (
            <p className="text-xs font-medium text-red-600">
              must exceed highest checkpoint fare (Rs. {minFare})
            </p>
          )}
          <p className="text-xs text-slate-400">Leave the fare empty to keep it unchanged.</p>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      {msg && <p className="text-sm text-green-600">{msg}</p>}
    </div>
  );
}