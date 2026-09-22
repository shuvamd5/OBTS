import { NavLink, Outlet, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthContext";
import { statsApi } from "../api/stats";
import { isAdmin, isStaff } from "../lib/roles";
import type { AppStats } from "../types";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  isActive ? "font-semibold text-brand-700" : "text-slate-600 hover:text-brand-700";

function Badge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-slate-200 px-1 text-[10px] font-semibold text-slate-600">
      {count}
    </span>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const staff = isStaff(user);

  const statsQuery = useQuery({
    queryKey: ["stats"],
    queryFn: () => statsApi.get().then((res) => res.data satisfies AppStats),
    enabled: Boolean(user),
  });
  const stats = user ? (statsQuery.data ?? null) : null;

  const schedulesBadge = staff ? (stats?.schedules ?? 0) : 0;

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link to="/" className="text-lg font-bold tracking-tight text-brand-700">
            eYatra
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <NavLink to="/" end className={linkClass}>
              Home
            </NavLink>
            {user && (
              <>
                <NavLink to="/buses" className={linkClass}>
                  Buses
                  {staff && <Badge count={stats?.buses ?? 0} />}
                </NavLink>
                <NavLink to="/schedules" className={linkClass}>
                  Schedules
                  {staff && <Badge count={schedulesBadge} />}
                </NavLink>
                <NavLink to="/routes" className={linkClass}>
                  Routes
                </NavLink>
                <NavLink to="/bookings" className={linkClass}>
                  My Bookings
                </NavLink>
                {staff && (
                  <NavLink to="/payments" className={linkClass}>
                    Payment Desk
                  </NavLink>
                )}
                {isAdmin(user) && (
                  <>
                    <NavLink to="/bus-types" className={linkClass}>
                      Bus Types
                    </NavLink>
                    <NavLink to="/locations" className={linkClass}>
                      Locations
                    </NavLink>
                  </>
                )}
                <NavLink to="/profile" className={linkClass}>
                  Profile
                </NavLink>
              </>
            )}
            {user ? (
              <button
                onClick={() => void logout()}
                className="rounded-btn border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
              >
                Logout
              </button>
            ) : (
              <NavLink to="/login" className={linkClass}>
                Login
              </NavLink>
            )}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <Outlet />
      </main>

      <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-400">
        eYatra — Online Bus Ticketing
      </footer>
    </div>
  );
}