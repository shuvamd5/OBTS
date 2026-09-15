import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthContext";
import { busesApi } from "../api/buses";
import { referenceApi } from "../api/reference";
import { serializeError } from "../api/client";

const AMENITIES = ["wifi", "ac", "charging", "recliner", "blanket"];

const inputClass = "input px-2 py-1.5 text-sm";

export default function AddBusPage() {
  const { user } = useAuth();

  const typesQuery = useQuery({
    queryKey: ["bus-types", "reference"],
    queryFn: () => referenceApi.busTypes().then(({ data }) => data.busTypes),
  });
  const busTypes = typesQuery.data ?? [];
  const typesError = typesQuery.isError ? "Failed to load bus types" : "";

  const [plateNumber, setPlateNumber] = useState("");
  const [busTypeId, setBusTypeId] = useState("");
  const [bname, setBname] = useState("");
  const [amenities, setAmenities] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  const selectedType = busTypes.find((t) => t._id === busTypeId) ?? null;

  function toggleAmenity(value: string) {
    setAmenities((prev) =>
      prev.includes(value) ? prev.filter((a) => a !== value) : [...prev, value]
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!plateNumber.trim() || !busTypeId || !bname.trim()) {
      setError("Fill in all fields of the form.");
      return;
    }
    setBusy(true);
    setError("");
    setMsg("");
    try {
      await busesApi.create({
        plateNumber: plateNumber.trim(),
        busTypeId,
        bname: bname.trim(),
        amenities,
      });
      setPlateNumber("");
      setBusTypeId("");
      setBname("");
      setAmenities([]);
      setMsg(user?.ustatus === "operator" ? "Bus registered to you." : "Bus registered.");
    } catch (err) {
      setError(serializeError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Add Bus</h1>
        <Link className="text-sm font-medium text-brand-600 hover:text-brand-700" to="/buses">
          ← View Buses
        </Link>
      </div>

      {typesError && <p className="mb-4 text-sm text-red-600">{typesError}</p>}
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <div className="card rounded-panel p-6">
        <p className="mb-3 text-sm text-slate-500">
          Bus type, seat count, and seat style come from the available bus types.
        </p>
        {busTypes.length === 0 ? (
          <p className="text-slate-500">
            No bus types available. An admin needs to{" "}
            <Link to="/bus-types" className="font-medium text-brand-600 hover:text-brand-700">
              create a bus type
            </Link>{" "}
            first.
          </p>
        ) : (
          <form onSubmit={submit}>
            <div className="mb-3 flex flex-wrap items-end gap-3">
              <div>
                <label className="block px-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Bus type
                </label>
                <select
                  className={inputClass}
                  value={busTypeId}
                  onChange={(e) => setBusTypeId(e.target.value)}
                >
                  <option value="">Select bus type...</option>
                  {busTypes.map((t) => (
                    <option key={t._id} value={t._id}>
                      {t.name} / {t.seatCount} seats / {t.seatStyle}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block px-1 pb-1 text-slate-400">Seat count</label>
                <span className="input w-20 px-2 py-1.5 text-sm text-slate-400">
                  {selectedType ? selectedType.seatCount : "—"}
                </span>
              </div>
              <div className="flex-1">
                <label className="block px-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Plate number
                </label>
                <input
                  type="text"
                  placeholder="e.g. BA 1 JA 2345"
                  value={plateNumber}
                  onChange={(e) => setPlateNumber(e.target.value.toUpperCase())}
                  className={`${inputClass} w-full`}
                />
              </div>
              <div className="flex-1">
                <label className="block px-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Bus name
                </label>
                <input
                  type="text"
                  placeholder="NAME"
                  value={bname}
                  onChange={(e) => setBname(e.target.value)}
                  className={`${inputClass} w-full`}
                />
              </div>
            </div>

            <fieldset className="mb-4">
              <legend className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Amenities
              </legend>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
                {AMENITIES.map((a) => (
                  <label key={a} className="inline-flex items-center gap-1 capitalize">
                    <input
                      type="checkbox"
                      checked={amenities.includes(a)}
                      onChange={() => toggleAmenity(a)}
                    />
                    {a}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="flex items-center gap-3">
              <button type="submit" disabled={busy} className="btn-primary">
                {busy ? "Adding..." : "Add bus"}
              </button>
              {msg && <p className="text-sm text-green-600">{msg}</p>}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}