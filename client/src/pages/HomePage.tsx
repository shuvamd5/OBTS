import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { isAdmin, isStaff } from "../lib/roles";

export default function HomePage() {
  const { user } = useAuth();

  const secondary = [
    { to: "/buses", title: "Buses", desc: "Browse the fleet." },
    { to: "/schedules", title: "Schedules", desc: "Upcoming departures and fares." },
    { to: "/routes", title: "Routes", desc: "Routes and checkpoint fares." },
  ];

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          Welcome{user ? `, ${user.uname}` : ""}!
        </h1>
        <p className="mt-1 text-sm text-slate-500">Book a trip, browse buses, and check schedules.</p>
      </div>

      <Link
        to="/"
        className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-panel border border-brand-200 bg-brand-50 px-6 py-6 transition-colors hover:border-brand-300 hover:bg-brand-100"
      >
        <div>
          <p className="text-lg font-semibold text-brand-900">Book a bus</p>
          <p className="mt-0.5 text-sm text-slate-600">
            Search a route, pick a seat, and reserve instantly.
          </p>
        </div>
        <span className="btn-primary">Book now</span>
      </Link>

      <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3">
        {secondary.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="card px-4 py-3 transition-colors hover:border-brand-300 hover:bg-slate-50"
          >
            <p className="font-semibold text-slate-800">{item.title}</p>
            <p className="mt-0.5 text-xs text-slate-500">{item.desc}</p>
          </Link>
        ))}
      </div>

      {isStaff(user) && (
        <div className="mt-6 card px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-800">Staff</h2>
          <Link to="/users" className="mt-2 inline-block text-sm font-medium text-brand-600 hover:text-brand-700">
            Manage Users →
          </Link>
          {isAdmin(user) && (
            <>
              <span className="mx-2 text-slate-300">·</span>
              <Link to="/bus-types" className="mt-2 inline-block text-sm font-medium text-brand-600 hover:text-brand-700">
                Manage Bus Types →
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}