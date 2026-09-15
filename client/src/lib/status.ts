const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  expired: "Expired",
  not_going: "Not going",
};

export function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}