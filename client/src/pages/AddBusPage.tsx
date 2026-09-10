import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthContext";
import { busesApi, type BusCreatePayload } from "../api/buses";
import { referenceApi } from "../api/reference";

const inputClass = "input px-2 py-1.5 text-sm";

export default function AddBusPage() {
  const { user } = useAuth();

  const metaQuery = useQuery({
    queryKey: ["bus-meta"],
    queryFn: () => referenceApi.busMeta().then(({ data }) => data),
  });
  const meta = metaQuery.data;
  const loading = metaQuery.isLoading;
  const metaError = metaQuery.isError ? "Failed to load bus metadata" : "";

  const [bcd0, setBcd0] = useState("");
  const [bcd1, setBcd1] = useState("");
  const [bcd2, setBcd2] = useState("");
  const [bno, setBno] = useState("");
  const [bname, setBname] = useState("");
  const [btype, setBtype] = useState<"A/C" | "Deluxe" | "Suspension" | "">("");
  const [nseat, setNseat] = useState<number | "">("");
  const [stype, setStype] = useState<BusCreatePayload["stype"] | "">("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!bcd0 || !bcd1 || !bcd2 || !bno || !bname || !btype || nseat === "" || !stype) {
      setError("Fill in all fields of the form.");
      return;
    }
    setBusy(true);
    setError("");
    setMsg("");
    try {
      await busesApi.create({ bcd0, bcd1, bcd2, bno, bname, btype, nseat, stype });
      setBcd0("");
      setBcd1("");
      setBcd2("");
      setBno("");
      setBname("");
      setBtype("");
      setNseat("");
      setStype("");
      setMsg(user?.ustatus === "operator" ? "Bus registered to you." : "Bus registered.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to register bus");
    } finally {
      setBusy(false);
    }
  }

  const radio = (name: string, value: string) => (
    <>
      <input
        type="radio"
        name={name}
        value={value}
        checked={
          name === "btype"
            ? btype === value
            : name === "nseat"
            ? nseat === Number(value)
            : stype === value
        }
        onChange={() => {
          if (name === "btype") setBtype(value as "A/C" | "Deluxe" | "Suspension");
          else if (name === "nseat") setNseat(Number(value));
          else setStype(value as BusCreatePayload["stype"]);
        }}
      />{" "}
      {value}
    </>
  );

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl">
        <p className="text-slate-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Add Bus</h1>
        <Link className="text-sm font-medium text-brand-600 hover:text-brand-700" to="/buses">
          ← View Buses
        </Link>
      </div>

      {metaError && <p className="mb-4 text-sm text-red-600">{metaError}</p>}
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {meta && (
        <form onSubmit={submit} className="card rounded-panel p-6">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <select className="input px-2 py-1.5 text-sm" value={bcd0} onChange={(e) => setBcd0(e.target.value)}>
              <option value="">Zone...</option>
              {meta.zoneCodes.map((z) => (
                <option key={z.code} value={z.code}>
                  {z.code} / {z.label}
                </option>
              ))}
            </select>
            <input
              type="text"
              inputMode="numeric"
              placeholder="1-2 digits"
              value={bcd1}
              onChange={(e) => setBcd1(e.target.value)}
              className={`${inputClass} w-20`}
            />
            <select className="input px-2 py-1.5 text-sm" value={bcd2} onChange={(e) => setBcd2(e.target.value)}>
              <option value="">Type...</option>
              {meta.vehicleTypes.map((v) => (
                <option key={v.code} value={v.code}>
                  {v.code} / {v.label}
                </option>
              ))}
            </select>
            <input
              type="text"
              inputMode="numeric"
              placeholder="0000"
              value={bno}
              onChange={(e) => setBno(e.target.value)}
              className={`${inputClass} w-20`}
            />
            <input
              type="text"
              placeholder="NAME"
              value={bname}
              onChange={(e) => setBname(e.target.value)}
              className={`${inputClass} min-w-40`}
            />
          </div>

          <div className="mb-2 space-x-4 text-sm text-slate-600">
            {(["A/C", "Deluxe", "Suspension"] as const).map((t) => (
              <label key={t} className="inline-flex items-center gap-1">
                {radio("btype", t)}
              </label>
            ))}
            <span className="text-xs text-slate-400">features</span>
          </div>
          <div className="mb-2 space-x-4 text-sm text-slate-600">
            {([37, 39] as const).map((n) => (
              <label key={n} className="inline-flex items-center gap-1">
                {radio("nseat", String(n))}
              </label>
            ))}
            <span className="text-xs text-slate-400">no. of seats</span>
          </div>
          <div className="mb-3 space-x-4 text-sm text-slate-600">
            {(["foldable", "semi-foldable", "unfoldable"] as const).map((s) => (
              <label key={s} className="inline-flex items-center gap-1">
                {radio("stype", s)}
              </label>
            ))}
            <span className="text-xs text-slate-400">seat type</span>
          </div>

          <div className="flex items-center gap-3">
            <button type="submit" disabled={busy} className="btn-primary">
              {busy ? "Adding..." : "Add bus"}
            </button>
            {error && <p className="text-sm text-red-600">{error}</p>}
            {msg && <p className="text-sm text-green-600">{msg}</p>}
          </div>
        </form>
      )}
    </div>
  );
}