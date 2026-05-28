export type RoomStatus = "available" | "soon" | "occupied";

export interface Room {
  id: string;
  code: string;
  name: string;
  floor: string;
  floor_order: number;
}

export interface Booking {
  id: string;
  room_id: string;
  title: string;
  organizer: string;
  start_time: string;
  end_time: string;
  cancelled: boolean;
}

export interface DeviceRow {
  id: string;
  device_id: string;
  room_id: string | null;
  last_seen: string;
}

export function getRoomStatus(
  bookings: Booking[],
  now: Date = new Date(),
): {
  status: RoomStatus;
  current: Booking | null;
  next: Booking | null;
} {
  const active = bookings
    .filter((b) => !b.cancelled)
    .sort((a, b) => +new Date(a.start_time) - +new Date(b.start_time));

  const current =
    active.find(
      (b) => new Date(b.start_time) <= now && new Date(b.end_time) > now,
    ) ?? null;

  const upcoming = active.filter((b) => new Date(b.start_time) > now);
  const next = upcoming[0] ?? null;

  let status: RoomStatus = "available";
  if (current) status = "occupied";
  else if (next && +new Date(next.start_time) - +now <= 15 * 60 * 1000) status = "soon";

  return { status, current, next };
}

export const STATUS_META: Record<
  RoomStatus,
  { label: string; tone: string; chip: string; dot: string }
> = {
  available: {
    label: "Available",
    tone: "text-emerald-700",
    chip: "bg-emerald-100 text-emerald-800 border border-emerald-200",
    dot: "bg-emerald-500",
  },
  soon: {
    label: "Reserved Soon",
    tone: "text-amber-700",
    chip: "bg-amber-100 text-amber-800 border border-amber-200",
    dot: "bg-amber-500",
  },
  occupied: {
    label: "Occupied",
    tone: "text-rose-700",
    chip: "bg-rose-100 text-rose-800 border border-rose-200",
    dot: "bg-rose-500",
  },
};

export function formatTime(d: string | Date): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function formatDate(d: string | Date): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function formatCountdown(ms: number): string {
  if (ms <= 0) return "0:00";
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
