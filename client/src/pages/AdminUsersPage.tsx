import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthContext";
import { usersApi } from "../api/users";
import { serializeError } from "../api/client";
import { isAdmin, isOperator } from "../lib/roles";
import type { User, UserRole } from "../types";
import Pill from "../components/ui/Pill";
import Select from "../components/ui/Select";
import UserStat from "../components/users/UserStat";

const ROLE_TABS: UserRole[] = ["admin", "operator", "customer", "checker"];

export default function AdminUsersPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<UserRole>("customer");
  const [error, setError] = useState("");
  const queryClient = useQueryClient();

  const isOperatorView = isOperator(user);
  const canChangeRole = isAdmin(user);

  const usersQuery = useQuery({
    queryKey: ["users", isOperatorView ? "all" : activeTab],
    queryFn: () =>
      usersApi.list(isOperatorView ? undefined : activeTab).then(({ data }) => data.users),
  });

  const roleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: UserRole }) =>
      usersApi.changeRole(id, role).then(({ data }) => data.user),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
    onError: () => setError("Failed to update role"),
  });

  const listError = usersQuery.error ? serializeError(usersQuery.error) : "";
  const users: User[] = usersQuery.data ?? [];

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Users</h1>
      </div>

      {(error || listError) && <p className="mb-4 text-sm text-red-600">{error || listError}</p>}

      {isAdmin(user) && (
        <div className="mb-5 inline-flex rounded-btn border border-slate-300 bg-white p-0.5">
          {ROLE_TABS.map((role) => (
            <button
              key={role}
              type="button"
              onClick={() => setActiveTab(role)}
              className={`rounded-btn px-4 py-1.5 text-sm font-medium transition-colors ${
                activeTab === role ? "bg-brand-600 text-white" : "text-slate-600 hover:text-brand-700"
              }`}
            >
              {role}s
            </button>
          ))}
        </div>
      )}

      <div className="space-y-3">
        {users.map((u) => (
          <div key={u._id} className="card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-slate-900">{u.uname}</p>
                <p className="text-sm text-slate-500">{u.uemail}</p>
              </div>
              {canChangeRole ? (
                <Select
                  value={u.ustatus}
                  disabled={roleMutation.isPending}
                  onChange={(e) =>
                    roleMutation.mutate({ id: u._id, role: e.target.value as UserRole })
                  }
                  className="px-2 py-1 uppercase"
                >
                  {ROLE_TABS.map((role) => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </Select>
              ) : (
                <Pill className="uppercase">{u.ustatus}</Pill>
              )}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-3 border-t border-slate-100 pt-3 sm:grid-cols-6">
              <UserStat label="TC" value={u.totaltc} />
              <UserStat label="Reserved" value={u.reservedtc} />
              <UserStat label="Pending" value={u.pendingtc} />
              <UserStat label="Paid" value={u.payment} />
              <UserStat label="Due" value={u.due} />
              <UserStat label="Points" value={u.points} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}