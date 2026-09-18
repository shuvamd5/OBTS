import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthContext";
import { busesApi } from "../api/buses";
import { referenceApi } from "../api/reference";
import { serializeError } from "../api/client";
import { isAdmin, isStaff } from "../lib/roles";
import type { Bus } from "../types";
import BusCard from "../components/buses/BusCard";

export default function BusesPage() {
  const { user } = useAuth();
  const isAdminRole = isAdmin(user);
  const staff = isStaff(user);
  const queryClient = useQueryClient();

  const busesQuery = useQuery({
    queryKey: ["buses"],
    queryFn: () => busesApi.list().then(({ data }) => data.buses),
  });

  const busTypesQuery = useQuery({
    queryKey: ["bus-types", "reference"],
    queryFn: () => referenceApi.busTypes().then(({ data }) => data.busTypes),
    enabled: staff,
  });

  const patch = (bus: Bus) => {
    queryClient.setQueryData<Bus[]>(["buses"], (prev) => {
      const list = prev ?? [];
      const exists = list.some((x) => x._id === bus._id);
      return exists ? list.map((x) => (x._id === bus._id ? bus : x)) : [bus, ...list];
    });
    void queryClient.invalidateQueries({ queryKey: ["stats"] });
  };

  const remove = (id: string) => {
    queryClient.setQueryData<Bus[]>(["buses"], (prev) => (prev ?? []).filter((x) => x._id !== id));
    void queryClient.invalidateQueries({ queryKey: ["stats"] });
  };

  const error = busesQuery.isError ? serializeError(busesQuery.error) : "";
  const buses = busesQuery.data ?? [];

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Buses</h1>
        {staff && (
          <Link to="/buses/add" className="btn-primary">
            + Add Bus
          </Link>
        )}
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

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
              busTypes={busTypesQuery.data ?? []}
              onStatus={(bstatus) => patch({ ...b, bstatus })}
              onUpdated={patch}
              onDeleted={() => remove(b._id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}