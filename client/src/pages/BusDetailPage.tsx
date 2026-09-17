import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthContext";
import { busesApi } from "../api/buses";
import { serializeError } from "../api/client";
import { isAdmin, isStaff, isOperator } from "../lib/roles";
import type { Bus, BusStatus } from "../types";
import Card from "../components/ui/Card";
import Pill from "../components/ui/Pill";
import Select from "../components/ui/Select";
import Button from "../components/ui/Button";

const AMENITIES = ["wifi", "ac", "charging", "recliner", "blanket"];

function StatusPill({ status }: { status: BusStatus }) {
  const dot: "green" | "red" | "amber" =
    status === "active" ? "green" : status === "inactive" ? "red" : "amber";
  return (
    <Pill className="capitalize" dot={dot}>
      {status}
    </Pill>
  );
}

export default function BusDetailPage() {
  const { id = "" } = useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const admin = isAdmin(user);
  const staff = isStaff(user);
  const ownBus = isOperator(user);

  const busQuery = useQuery({
    queryKey: ["bus", id],
    queryFn: () => busesApi.get(id).then(({ data }) => data.bus),
  });
  const bus = busQuery.data;
  const loadError = busQuery.isError ? serializeError(busQuery.error) : "";

  const patchBus = (b: Bus) => queryClient.setQueryData<Bus>(["bus", id], b);

  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [editing, setEditing] = useState(false);
  const [bname, setBname] = useState("");
  const [amenities, setAmenities] = useState<string[]>([]);
  const [rating, setRating] = useState(0);
  const [confirm, setConfirm] = useState(false);

  const updateMutation = useMutation({
    mutationFn: (payload: { bname?: string; amenities?: string[]; rating?: number }) =>
      busesApi.update(id, payload).then(({ data }) => data.bus),
    onSuccess: (b) => {
      patchBus(b);
      setEditing(false);
      setMsg("Bus details updated.");
    },
    onError: () => setError("Failed to update bus"),
  });

  const statusMutation = useMutation({
    mutationFn: (bstatus: BusStatus) => busesApi.updateStatus(id, bstatus).then(({ data }) => data.bus),
    onSuccess: (b) => {
      patchBus(b);
      if (b.bsapby) setMsg(`Approved by ${b.bsapby}`);
    },
    onError: () => setError("Failed to update status"),
  });

  const deleteMutation = useMutation({
    mutationFn: () => busesApi.remove(id).then(({ data }) => data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["buses"] });
      queryClient.setQueryData(["bus", id], null);
      setMsg("Bus deleted.");
      setConfirm(false);
    },
    onError: () => setError("Failed to delete bus"),
  });

  if (!bus) {
    return (
      <div className="mx-auto max-w-3xl">
        <p className="text-sm text-slate-400">{loadError || "Loading..."}</p>
      </div>
    );
  }

  const startEdit = () => {
    setBname(bus.bname);
    setAmenities(bus.amenities ?? []);
    setRating(bus.rating ?? 0);
    setEditing(true);
  };

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <Link className="text-sm font-medium text-brand-600 hover:text-brand-700" to="/buses">
            ← View Buses
          </Link>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            <span className="font-mono">{bus.plateNumber}</span>
          </h1>
          <p className="text-sm text-slate-500">{bus.bname}</p>
        </div>
        <StatusPill status={bus.bstatus} />
      </div>

      {(error || loadError) && <p className="mb-4 text-sm text-red-600">{error || loadError}</p>}
      {msg && <p className="mb-4 text-sm text-green-600">{msg}</p>}

      <Card pad="6" panel>
        <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          {bus.busType && (
            <>
              <div className="flex justify-between sm:block">
                <span className="text-slate-500">Bus type</span>
                <span className="font-medium text-slate-800">{bus.busType.name}</span>
              </div>
              <div className="flex justify-between sm:block">
                <span className="text-slate-500">Seats</span>
                <span className="font-medium text-slate-800">{bus.busType.seatCount}</span>
              </div>
            </>
          )}
          <div className="flex justify-between sm:block">
            <span className="text-slate-500">Amenities</span>
            <span className="font-medium text-slate-800">
              {(bus.amenities ?? []).length > 0 ? (bus.amenities ?? []).map((a) => a).join(", ") : "—"}
            </span>
          </div>
          <div className="flex justify-between sm:block">
            <span className="text-slate-500">Rating</span>
            <span className="font-medium text-slate-800">{bus.rating > 0 ? `★ ${bus.rating}` : "—"}</span>
          </div>
          {bus.ownerName && (
            <div className="flex justify-between sm:block">
              <span className="text-slate-500">Owned by</span>
              <span className="font-medium text-slate-800">{bus.ownerName}</span>
            </div>
          )}
          <div className="flex justify-between sm:block">
            <span className="text-slate-500">Approved by</span>
            <span className="font-medium text-slate-800">{bus.bsapby}</span>
          </div>
          {bus.updatedAt && (
            <div className="flex justify-between sm:block">
              <span className="text-slate-500">Updated</span>
              <span className="font-medium text-slate-800">{new Date(bus.updatedAt).toLocaleString()}</span>
            </div>
          )}
        </div>

        {staff && (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
            {admin && (
              <Select
                value={bus.bstatus}
                disabled={statusMutation.isPending}
                onChange={(e) => void statusMutation.mutate(e.target.value as BusStatus)}
                className="px-2 py-1"
              >
                <option value="pending">pending</option>
                <option value="active">active</option>
                <option value="inactive">inactive</option>
              </Select>
            )}
            <Button variant="secondary" size="sm" onClick={startEdit}>
              Edit
            </Button>
            {!confirm ? (
              <Button
                variant="danger"
                size="sm"
                className="ml-auto"
                disabled={ownBus ? false : !admin}
                onClick={() => setConfirm(true)}
              >
                Delete
              </Button>
            ) : (
              <>
                <span className="text-xs text-red-600">Delete this bus?</span>
                <Button
                  variant="danger"
                  size="sm"
                  disabled={deleteMutation.isPending}
                  onClick={() => void deleteMutation.mutate()}
                >
                  Yes
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setConfirm(false)}>
                  No
                </Button>
              </>
            )}
          </div>
        )}

        {editing && (
          <div className="mt-4 border-t border-slate-100 pt-4">
            <div className="mb-3">
              <label className="block px-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Bus name
              </label>
              <input
                type="text"
                value={bname}
                onChange={(e) => setBname(e.target.value)}
                className="input px-2 py-1.5 text-sm"
              />
            </div>
            <div className="mb-3">
              <label className="mb-1 block px-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Amenities
              </label>
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
            </div>
            <div className="mb-3">
              <label className="mb-1 block px-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Rating (0–5)
              </label>
              <input
                type="number"
                min={0}
                max={5}
                step="0.5"
                value={rating}
                onChange={(e) => setRating(Number(e.target.value))}
                className="input px-2 py-1.5 text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                disabled={updateMutation.isPending}
                onClick={() => void updateMutation.mutate({ bname: bname.trim(), amenities, rating })}
              >
                Save
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}