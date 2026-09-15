import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { busTypesApi, type BusTypePayload } from "../api/busTypes";
import type { SeatStyle } from "../types";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import Select from "../components/ui/Select";

const SEAT_STYLES: SeatStyle[] = ["standard", "semi-luxury", "luxury"];
const inputClass = "input px-2 py-1.5 text-sm";

function seatCountError(value: number): string | null {
  if (!Number.isInteger(value)) return "Seat count must be a whole number.";
  if (value <= 28) return "Seat count must be greater than 28.";
  if (value % 2 !== 1) return "Seat count must be an odd number.";
  return null;
}

export default function AddBusTypePage() {
  const [name, setName] = useState("");
  const [seatCount, setSeatCount] = useState("");
  const [seatStyle, setSeatStyle] = useState<SeatStyle>("standard");
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  const createMutation = useMutation({
    mutationFn: (payload: BusTypePayload) => busTypesApi.create(payload).then(({ data }) => data.busType),
    onSuccess: () => {
      setName("");
      setSeatCount("");
      setSeatStyle("standard");
      setMsg("Bus type created. Add another below.");
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMsg("");
    const n = Number(seatCount);
    const scErr = seatCount ? seatCountError(n) : "Seat count is required.";
    if (scErr) {
      setError(scErr);
      return;
    }
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    createMutation.mutate({ name: name.trim(), seatCount: n, seatStyle });
  }

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Add Bus Type</h1>
        <Link className="text-sm font-medium text-brand-600 hover:text-brand-700" to="/bus-types">
          ← View Bus Types
        </Link>
      </div>

      {error && <p className="mb-4 rounded-card bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      {msg && <p className="mb-4 rounded-card bg-green-50 px-3 py-2 text-sm text-green-600">{msg}</p>}

      <form onSubmit={handleSubmit} className="card rounded-panel p-6">
        <h2 className="font-semibold text-slate-800">Bus type details</h2>
        <p className="mt-1 text-xs text-slate-400">
          The seat count must be an odd number greater than 28 — it drives the seat map and bus capacity.
        </p>
        <div className="mt-3 space-y-3">
          <div>
            <label className="block px-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Name
            </label>
            <Input
              type="text"
              placeholder="e.g. Volvo A/C Seater"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`${inputClass} w-full`}
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
                value={seatCount}
                onChange={(e) => setSeatCount(e.target.value)}
                className={`${inputClass} w-full`}
              />
            </div>
            <div>
              <label className="block px-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Seat style
              </label>
              <Select
                value={seatStyle}
                onChange={(e) => setSeatStyle(e.target.value as SeatStyle)}
                className={`${inputClass} w-full`}
              >
                {SEAT_STYLES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </Select>
            </div>
          </div>
          <Button type="submit" className="mt-1" disabled={createMutation.isPending}>
            {createMutation.isPending ? "Adding..." : "Add bus type"}
          </Button>
        </div>
      </form>
    </div>
  );
}