export default function UserStat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-base font-semibold tabular-nums text-slate-900">{value}</p>
      <p className="stat-label">{label}</p>
    </div>
  );
}