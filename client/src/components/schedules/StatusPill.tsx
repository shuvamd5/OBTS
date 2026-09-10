import type { PriceStatus, ScheduleStatus } from "../../types";
import Pill from "../ui/Pill";

export default function StatusPill({ status }: { status: ScheduleStatus | PriceStatus }) {
  const dot =
    status === "going" || status === "ok"
      ? "green"
      : status === "not going" || status === "not ok"
      ? "red"
      : status === "Expired"
      ? "slate"
      : "amber";
  return (
    <Pill className="capitalize" dot={dot}>
      {status}
    </Pill>
  );
}