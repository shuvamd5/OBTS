import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { routesApi } from "../api/routes";
import { referenceApi } from "../api/reference";
import { serializeError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { isStaff } from "../lib/roles";
import type { Route } from "../types";
import RouteCard from "../components/routes/RouteCard";

export default function RoutesPage() {
  const { user } = useAuth();
  const staff = isStaff(user);
  const queryClient = useQueryClient();

  const routesQuery = useQuery({
    queryKey: ["routes"],
    queryFn: () => routesApi.list().then(({ data }) => data.routes),
  });

  const locationsQuery = useQuery({
    queryKey: ["locations"],
    queryFn: () => referenceApi.locations().then(({ data }) => data.locations),
    enabled: staff,
  });

  const listError = routesQuery.error ?? locationsQuery.error;
  const error = listError ? serializeError(listError) : "";

  const reload = () => {
    void queryClient.invalidateQueries({ queryKey: ["routes"] });
    void queryClient.invalidateQueries({ queryKey: ["locations"] });
  };

  const routes: Route[] = routesQuery.data ?? [];

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Routes</h1>
        {staff && (
          <Link to="/routes/add" className="btn-primary">
            + Add Route
          </Link>
        )}
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <div className="space-y-4">
        {routes.map((r) => (
          <RouteCard
            key={r._id}
            route={r}
            canEdit={staff}
            locations={locationsQuery.data ?? []}
            onChanged={() => reload()}
          />
        ))}
      </div>
    </div>
  );
}