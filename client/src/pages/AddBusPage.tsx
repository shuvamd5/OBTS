import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { busesApi, type BusCreatePayload } from "../api/buses";
import { referenceApi } from "../api/reference";
import type { BusMeta } from "../types";

const inputClass =
  "rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none";

export default function AddBusPage() {
  const { user } = useAuth();
  const [meta, setMeta] = useState<BusMeta | null>(null);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    referenceApi
      .busMeta()
      .then(({ data }) => setMeta(data))
      .catch(() => setError("Failed to load bus metadata"))
      .finally(() => setLoading(false));
  }, []);

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
      setMsg(user?.ustatus === "Manager" ? "Bus registered to you." : "Bus registered.");
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
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-blue-600">Add Bus</h1>
        <Link className="text-blue-600 underline" to="/buses">
          ← View Buses
        </Link>
      </div>

      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

      {meta && (
        <form onSubmit={submit} className="bg-white rounded-lg shadow p-4">
          <div className="flex flex-wrap gap-3 mb-3">
            <select className="border rounded px-2 py-1.5 text-sm" value={bcd0} onChange={(e) => setBcd0(e.target.value)}>
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
            <select className="border rounded px-2 py-1.5 text-sm" value={bcd2} onChange={(e) => setBcd2(e.target.value)}>
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
            <input type="text" placeholder="NAME" value={bname} onChange={(e) => setBname(e.target.value)} className={inputClass} />
          </div>

          <div className="mb-2 text-sm text-gray-600 space-x-4">
            {(["A/C", "Deluxe", "Suspension"] as const).map((t) => (
              <label key={t} className="inline-flex items-center gap-1">
                {radio("btype", t)}
              </label>
            ))}
            <span className="text-xs text-gray-400">features</span>
          </div>
          <div className="mb-2 text-sm text-gray-600 space-x-4">
            {([37, 39] as const).map((n) => (
              <label key={n} className="inline-flex items-center gap-1">
                {radio("nseat", String(n))}
              </label>
            ))}
            <span className="text-xs text-gray-400">no. of seats</span>
          </div>
          <div className="mb-3 text-sm text-gray-600 space-x-4">
            {(["foldable", "semi-foldable", "unfoldable"] as const).map((s) => (
              <label key={s} className="inline-flex items-center gap-1">
                {radio("stype", s)}
              </label>
            ))}
            <span className="text-xs text-gray-400">seat type</span>
          </div>

          <div className="flex items-center gap-3">
            <button type="submit" disabled={busy} className="bg-blue-600 text-white rounded px-4 py-2 hover:bg-blue-700 disabled:opacity-50">
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
