import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { schedulesApi } from "../api/schedules";
import { routesApi } from "../api/routes";
import { serializeError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { isAdmin, isStaff } from "../lib/roles";
import type { Schedule } from "../types";
import ScheduleCard from "../components/schedules/ScheduleCard";
import UserView from "../components/schedules/UserView";

export default function SchedulesPage() {
  const { user } = useAuth();
  const staff = isStaff(user);
  const isAdminRole = isAdmin(user);
  const queryClient = useQueryClient();

  const schedulesQuery = useQuery({
    queryKey: ["schedules"],
    queryFn: () => schedulesApi.list().then(({ data }) => data.schedules),
  });

  const routesQuery = useQuery({
    queryKey: ["routes"],
    queryFn: () => routesApi.list().then(({ data }) => data.routes),
    enabled: staff,
  });

  const loading = schedulesQuery.isLoading || (staff && routesQuery.isLoading);
  const listError = schedulesQuery.error ?? routesQuery.error;
  const error = listError ? serializeError(listError) : "";

  const byDate = useMemo(
    () =>
      [...(schedulesQuery.data ?? [])].sort(
        (a, b) =>
          (a.trdate < b.trdate ? -1 : a.trdate > b.trdate ? 1 : 0) ||
          a.trtime.localeCompare(b.trtime)
      ),
    [schedulesQuery.data]
  );

  const patch = (next: Schedule) => {
    queryClient.setQueryData<Schedule[]>(["schedules"], (prev) => {
      const list = prev ?? [];
      const exists = list.some((x) => x._id === next._id);
      return exists ? list.map((x) => (x._id === next._id ? next : x)) : [next, ...list];
    });
    void queryClient.invalidateQueries({ queryKey: ["stats"] });
  };

  const remove = (id: string) => {
    queryClient.setQueryData<Schedule[]>(["schedules"], (prev) => (prev ?? []).filter((x) => x._id !== id));
    void queryClient.invalidateQueries({ queryKey: ["stats"] });
  };

  if (!staff) return <UserView schedules={byDate} loading={loading} error={error} />;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Schedules</h1>
          <p className="mt-1 text-sm text-slate-500">
            Upcoming departures. Click the pen icon to edit a schedule or assign its fare.
          </p>
        </div>
        <Link to="/schedules/add" className="btn-primary">
          + Add Schedule
        </Link>
      </div>

      {error && <div className="mt-4 rounded-card bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}

      {!loading && (
        <div className="mt-5">
          {byDate.length === 0 ? (
            <p className="text-slate-400">No schedules yet — add one above.</p>
          ) : (
            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {byDate.map((s) => (
                <ScheduleCard
                  key={s._id}
                  s={s}
                  isAdminRole={isAdminRole}
                  routes={routesQuery.data ?? []}
                  onUpdate={patch}
                  onDeleted={() => remove(s._id)}
                  onPriceChanged={() => {
                    void queryClient.invalidateQueries({ queryKey: ["schedules"] });
                    void queryClient.invalidateQueries({ queryKey: ["stats"] });
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}