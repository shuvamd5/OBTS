import { useEffect, useState } from "react";
import { NavLink, Outlet, Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { statsApi } from "../api/stats";
import { isStaff } from "../lib/roles";
import type { AppStats } from "../types";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  isActive ? "font-semibold text-blue-600" : "text-slate-600 hover:text-blue-600";

function Badge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
      {count}
    </span>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const [stats, setStats] = useState<AppStats | null>(null);
  const staff = isStaff(user);

  useEffect(() => {
    if (!user) {
      setStats(null);
      return;
    }
    let active = true;
    statsApi
      .get()
      .then((res) => {
        if (active) setStats(res.data);
      })
      .catch(() => {
        if (active) setStats(null);
      });
    return () => {
      active = false;
    };
  }, [user]);

  const schedulesBadge = staff ? (stats?.schedules ?? 0) + (stats?.prices ?? 0) : 0;

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/" className="text-lg font-bold tracking-wide text-blue-600">
            OBTS
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
              </>
            )}
            {user ? (
              <button
                onClick={() => void logout()}
                className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium hover:bg-slate-100"
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
        OBTS — Online Bus Ticketing System (MERN migration in progress)
      </footer>
    </div>
  );
}