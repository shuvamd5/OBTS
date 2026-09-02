import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { isStaff } from "../lib/roles";

export default function HomePage() {
  const { user } = useAuth();

  return (
    <div>
      <div className="rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 p-6 text-white shadow-lg">
        <h1 className="text-2xl font-bold">Welcome, {user?.uname}!</h1>
        <p className="mt-1 text-sm text-blue-100">Book trips, browse buses, and check schedules.</p>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Link to="/buses" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="font-semibold text-slate-800">Buses</p>
          <p className="mt-1 text-sm text-slate-500">Browse the fleet and choose your bus.</p>
        </Link>
        <Link to="/schedules" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="font-semibold text-slate-800">Schedules</p>
          <p className="mt-1 text-sm text-slate-500">See upcoming departures and fares.</p>
        </Link>
        <Link to="/routes" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="font-semibold text-slate-800">Routes</p>
          <p className="mt-1 text-sm text-slate-500">Explore routes and checkpoint fares.</p>
        </Link>
      </div>

      {isStaff(user) && (
        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-slate-800">Staff</h2>
          <div className="mt-3 flex flex-wrap gap-3 text-sm">
            <Link to="/users" className="text-blue-600 underline">Manage Users</Link>
          </div>
        </div>
      )}
    </div>
  );
}