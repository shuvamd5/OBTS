import type { PillDot } from "./Pill";
import { statusLabel } from "../../lib/status";

const DOT: Record<PillDot, string> = {
  green: "bg-green-500",
  red: "bg-red-500",
  amber: "bg-amber-400",
  slate: "bg-slate-300",
};

export default function StatusBadgeButton({
  status,
  dot,
  canChange = false,
  onClick,
}: {
  status: string;
  dot?: PillDot;
  canChange?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      title={canChange ? "Change status" : undefined}
      onClick={canChange ? onClick : undefined}
      disabled={!canChange}
      className={`pill capitalize transition-colors ${
        canChange ? "cursor-pointer hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700" : ""
      }`}
    >
      {dot && <span className={`pill-dot ${DOT[dot]}`} />}
      {statusLabel(status)}
    </button>
  );
}