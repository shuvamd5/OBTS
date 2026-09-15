import type { PillDot } from "./Pill";
import { PenIcon, TrashIcon } from "../icons";
import StatusBadgeButton from "./StatusBadgeButton";

export default function CardActions({
  status,
  dot,
  canChangeStatus = false,
  onStatus,
  canEdit = false,
  onEdit,
  onDelete,
}: {
  status?: string;
  dot?: PillDot;
  canChangeStatus?: boolean;
  onStatus?: () => void;
  canEdit?: boolean;
  onEdit?: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-1.5">
      {status !== undefined && (
        <StatusBadgeButton status={status} dot={dot} canChange={canChangeStatus} onClick={onStatus} />
      )}
      {canEdit && (
        <button type="button" onClick={onEdit} title="Edit" className="icon-btn">
          <PenIcon />
        </button>
      )}
      {canEdit && (
        <button type="button" onClick={onDelete} title="Delete" className="icon-btn-danger">
          <TrashIcon />
        </button>
      )}
    </div>
  );
}