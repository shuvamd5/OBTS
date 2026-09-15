import type { PriceStatus, ScheduleStatus } from "../../types";
import { statusLabel } from "../../lib/status";
import Pill from "../ui/Pill";

export default function StatusPill({ status }: { status: ScheduleStatus | PriceStatus }) {
  const dot =
    status === "approved"
      ? "green"
      : status === "not_going" || status === "rejected"
      ? "red"
      : status === "expired"
      ? "slate"
      : "amber";
  return (
    <Pill className="capitalize" dot={dot}>
      {statusLabel(status)}
    </Pill>
  );
}