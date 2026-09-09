import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { usersApi } from "../api/users";
import { isAdmin, isOperator } from "../lib/roles";
import type { User, UserRole } from "../types";

const ROLE_TABS: UserRole[] = ["admin", "operator", "customer", "checker"];

export default function AdminUsersPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [activeTab, setActiveTab] = useState<UserRole>("customer");
  const [error, setError] = useState("");

  const isOperatorView = isOperator(user);
  const canChangeRole = isAdmin(user);

  useEffect(() => {
    let cancelled = false;
    setError("");
    usersApi
      .list(isOperatorView ? undefined : activeTab)
      .then(({ data }) => {
        if (!cancelled) setUsers(data.users);
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load users");
      });
    return () => {
      cancelled = true;
    };
  }, [activeTab, isOperatorView]);

  async function handleRoleChange(id: string, ustatus: UserRole) {
    try {
      const { data } = await usersApi.changeRole(id, ustatus);
      setUsers((prev) => prev.map((u) => (u._id === id ? data.user : u)));
    } catch {
      setError("Failed to update role");
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-blue-600">Users</h1>
      </div>

      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

      {isAdmin(user) && (
        <div className="flex gap-2 mb-4">
          {ROLE_TABS.map((role) => (
            <button
              key={role}
              onClick={() => setActiveTab(role)}
              className={`px-4 py-2 rounded ${
                activeTab === role ? "bg-blue-600 text-white" : "bg-white border"
              }`}
            >
              {role}s
            </button>
          ))}
        </div>
      )}

      <div className="space-y-3">
        {users.map((u) => (
          <div key={u._id} className="bg-white rounded-lg shadow p-4 flex items-center justify-between">
            <div>
              <p className="font-semibold">{u.uname}</p>
              <p className="text-sm text-gray-600">{u.uemail}</p>
              <p className="text-xs text-gray-500">
                TC: {u.totaltc} · Reserved: {u.reservedtc} · Pending: {u.pendingtc} ·
                Paid: {u.payment} · Due: {u.due} · Points: {u.points}
              </p>
            </div>
            {canChangeRole ? (
              <select
                value={u.ustatus}
                onChange={(e) => handleRoleChange(u._id, e.target.value as UserRole)}
                className="border rounded px-2 py-1"
              >
                {ROLE_TABS.map((role) => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
            ) : (
              <span className="text-sm px-2 py-1 bg-gray-200 rounded">{u.ustatus}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}