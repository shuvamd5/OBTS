import { fmtDate } from "../../lib/date";
import type { Schedule } from "../../types";
import Card from "../ui/Card";
import StatusPill from "./StatusPill";

export default function UserView({
  schedules,
  loading,
  error,
}: {
  schedules: Schedule[];
  loading: boolean;
  error: string;
}) {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">Schedules</h1>
      <p className="mt-1 text-sm text-slate-500">Upcoming scheduled departures with their fares.</p>
      {error && <div className="mt-4 rounded-card bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}
      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-36 animate-pulse rounded-card bg-slate-200" />
            ))
          : schedules.map((s) => (
              <Card key={s._id}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-mono text-lg font-bold tracking-wide text-slate-900">
                      {s.bus?.bcd} {s.bus?.bno}
                    </p>
                    <p className="text-sm font-medium text-slate-600">{s.bus?.bname}</p>
                  </div>
                  <StatusPill status={s.bsstatus} />
                </div>
                <div className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-sm text-slate-600">
                  <p>
                    {fmtDate(s.trdate)} at {s.trtime}
                  </p>
                  <p>
                    {s.bus?.btype} · {s.bus?.nseat} seats
                  </p>
                  {s.price ? (
                    <p className="text-slate-800">
                      {s.price.rid.sp} → {s.price.rid.fp}:{" "}
                      <span className="font-semibold text-slate-900">Rs. {s.price.price}</span>
                    </p>
                  ) : (
                    <p className="text-xs text-slate-400">price not set yet</p>
                  )}
                </div>
              </Card>
            ))}
      </div>
    </div>
  );
}