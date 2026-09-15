import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

const penIcon = (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
  </svg>
);

export default function ProfilePage() {
  const { user } = useAuth();
  if (!user) return null;

  const detailRow = (label: string, value: string) => (
    <div className="flex items-center justify-between rounded-card bg-slate-50 px-3 py-2">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm font-medium text-slate-800">{value}</span>
    </div>
  );

  const ledger = [
    { label: "Total bookings", value: user.totaltc },
    { label: "Reserved", value: user.reservedtc },
    { label: "Pending", value: user.pendingtc },
    { label: "Paid", value: user.payment },
    { label: "Due", value: user.due },
    { label: "Points", value: user.points },
  ];

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="card rounded-panel p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-lg font-semibold text-slate-900">{user.uname}</p>
            <p className="pill mt-1 capitalize">{user.ustatus}</p>
          </div>
          <Link
            to="/profile/edit"
            title="Edit profile"
            className="rounded-btn p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-brand-600"
          >
            {penIcon}
          </Link>
        </div>

        <div className="mt-4 space-y-2">
          {detailRow("Email", user.uemail)}
          {detailRow("Mobile", user.umobile)}
          {detailRow("Gender", user.ugender)}
        </div>

        <div className="mt-6 border-t border-slate-200 pt-4">
          <p className="stat-label mb-2">Account</p>
          <div className="grid grid-cols-3 gap-2">
            {ledger.map((item) => (
              <div key={item.label} className="rounded-card bg-slate-50 px-3 py-2 text-center">
                <p className="text-base font-semibold tabular-nums text-slate-900">{item.value}</p>
                <p className="text-[11px] text-slate-500">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}