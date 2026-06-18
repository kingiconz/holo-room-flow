import type { RoomStatus } from "@/lib/rooms";
import { STATUS_META } from "@/lib/rooms";

interface StatusBadgeProps {
  status: RoomStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const meta = STATUS_META[status];
  return <span className={`px-2 py-0.5 rounded-full text-xs ${meta.chip}`}>{meta.label}</span>;
}
