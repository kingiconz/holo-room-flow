import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Building2, Search, CalendarDays, Sparkles, MapPin, Clock, ArrowRight } from "lucide-react";
import { useRooms, useBookings, useNow } from "@/lib/use-realtime";
import {
  getRoomStatus,
  STATUS_META,
  formatTime,
  type Room,
  type Booking,
} from "@/lib/rooms";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Atrium — Find & book a meeting room" },
      {
        name: "description",
        content:
          "Browse every meeting room across the building, see live availability, and book instantly.",
      },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const rooms = useRooms();
  const bookings = useBookings();
  const now = useNow(15000);
  const [query, setQuery] = useState("");
  const [floor, setFloor] = useState<string>("all");
  const [bookingRoom, setBookingRoom] = useState<Room | null>(null);

  const floors = useMemo(() => {
    const set = new Set<string>();
    rooms?.forEach((r) => set.add(r.floor));
    return Array.from(set);
  }, [rooms]);

  const filtered = useMemo(() => {
    if (!rooms) return [];
    return rooms.filter((r) => {
      if (floor !== "all" && r.floor !== floor) return false;
      if (query && !r.name.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });
  }, [rooms, floor, query]);

  const stats = useMemo(() => {
    if (!rooms || !bookings) return { total: 0, available: 0, occupied: 0, soon: 0 };
    let available = 0, occupied = 0, soon = 0;
    rooms.forEach((r) => {
      const s = getRoomStatus(bookings.filter((b) => b.room_id === r.id), now).status;
      if (s === "available") available++;
      else if (s === "occupied") occupied++;
      else soon++;
    });
    return { total: rooms.length, available, occupied, soon };
  }, [rooms, bookings, now]);

  return (
    <div className="min-h-screen">
      <Header />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-hero opacity-95" />
        <div className="absolute inset-0 opacity-30 mix-blend-overlay"
          style={{
            backgroundImage:
              "radial-gradient(800px 400px at 20% 20%, rgba(255,255,255,.35), transparent 60%), radial-gradient(600px 300px at 80% 80%, rgba(255,255,255,.2), transparent 60%)",
          }}
        />
        <div className="relative mx-auto max-w-7xl px-6 pt-20 pb-28 text-primary-foreground">
          <Badge className="bg-white/15 border-white/20 text-white hover:bg-white/20 backdrop-blur">
            <Sparkles className="h-3.5 w-3.5 mr-1.5" /> Live workspace intelligence
          </Badge>
          <h1 className="mt-6 text-5xl md:text-7xl font-semibold tracking-tight text-balance leading-[1.05]">
            The atrium of your<br />
            <span className="italic font-normal opacity-90">collaborative workplace.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-white/80 text-balance">
            Discover every meeting space across the building, see who's in
            session, and reserve the perfect room in seconds — all in real time.
          </p>

          <div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-3 max-w-3xl">
            <StatPill label="Total rooms" value={stats.total} />
            <StatPill label="Available" value={stats.available} accent="success" />
            <StatPill label="Reserved soon" value={stats.soon} accent="warning" />
            <StatPill label="In session" value={stats.occupied} accent="danger" />
          </div>
        </div>
      </section>

      {/* Controls */}
      <section className="mx-auto max-w-7xl px-6 -mt-14 relative">
        <div className="glass rounded-2xl shadow-elegant p-4 md:p-5 flex flex-col md:flex-row gap-3 md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search rooms by name…"
              className="pl-9 bg-white/60 border-white/40"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <FloorChip active={floor === "all"} onClick={() => setFloor("all")}>
              All floors
            </FloorChip>
            {floors.map((f) => (
              <FloorChip key={f} active={floor === f} onClick={() => setFloor(f)}>
                {f}
              </FloorChip>
            ))}
          </div>
        </div>
      </section>

      {/* Rooms */}
      <section className="mx-auto max-w-7xl px-6 py-14">
        <div className="flex items-end justify-between mb-8">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight">Meeting rooms</h2>
            <p className="text-muted-foreground mt-1">
              Tap any room to view today's schedule and reserve a slot.
            </p>
          </div>
          <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground">
            <span className="dot-pulse text-emerald-500">Live</span>
          </div>
        </div>

        {!rooms || !bookings ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-56 rounded-2xl bg-muted/60 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            No rooms match your filters.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((room, i) => (
              <RoomCard
                key={room.id}
                room={room}
                bookings={bookings.filter((b) => b.room_id === room.id)}
                now={now}
                onBook={() => setBookingRoom(room)}
                delay={i * 60}
              />
            ))}
          </div>
        )}
      </section>

      <Footer />

      <BookingDialog
        room={bookingRoom}
        bookings={bookings ?? []}
        onClose={() => setBookingRoom(null)}
      />
    </div>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-30 glass border-b border-white/40">
      <div className="mx-auto max-w-7xl px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-gradient-primary grid place-items-center shadow-soft">
            <Building2 className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="text-lg font-semibold tracking-tight leading-none">Atrium</div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Workspace
            </div>
          </div>
        </Link>
        <nav className="hidden md:flex items-center gap-1 text-sm">
          <a href="#rooms" className="px-3 py-2 text-muted-foreground hover:text-foreground">
            Rooms
          </a>
          <a href="#" className="px-3 py-2 text-muted-foreground hover:text-foreground">
            Schedule
          </a>
        </nav>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border/60">
      <div className="mx-auto max-w-7xl px-6 py-8 flex items-center justify-between text-sm text-muted-foreground">
        <div>© {new Date().getFullYear()} Atrium Workspace</div>
        <div className="italic">Reserved spaces. Realised potential.</div>
      </div>
    </footer>
  );
}

function StatPill({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: "success" | "warning" | "danger";
}) {
  const dot =
    accent === "success" ? "bg-emerald-400" :
    accent === "warning" ? "bg-amber-400" :
    accent === "danger" ? "bg-rose-400" : "bg-white/60";
  return (
    <div className="glass-dark rounded-xl px-4 py-3 text-white">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-white/70">
        <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
        {label}
      </div>
      <div className="mt-1 text-3xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function FloorChip({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3.5 py-2 rounded-full text-sm transition border ${
        active
          ? "bg-primary text-primary-foreground border-primary shadow-soft"
          : "bg-white/60 border-white/50 text-foreground hover:bg-white"
      }`}
    >
      {children}
    </button>
  );
}

function RoomCard({
  room,
  bookings,
  now,
  onBook,
  delay,
}: {
  room: Room;
  bookings: Booking[];
  now: Date;
  onBook: () => void;
  delay: number;
}) {
  const { status, current, next } = getRoomStatus(bookings, now);
  const meta = STATUS_META[status];

  return (
    <article
      className="group relative rounded-2xl bg-card border border-border/70 shadow-soft hover:shadow-elegant transition overflow-hidden animate-rise"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className={`h-1.5 ${meta.dot}`} />
      <div className="p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" /> {room.floor}
            </div>
            <h3 className="mt-1.5 text-xl font-semibold tracking-tight leading-tight">
              {room.name}
            </h3>
          </div>
          <span className={`text-xs px-2.5 py-1 rounded-full ${meta.chip}`}>
            {meta.label}
          </span>
        </div>

        <div className="mt-5 space-y-2.5 text-sm">
          {current ? (
            <div className="rounded-lg bg-rose-50 border border-rose-100 px-3 py-2.5">
              <div className="text-[11px] uppercase tracking-wider text-rose-700/80">
                In session
              </div>
              <div className="font-medium text-rose-900 truncate">{current.title}</div>
              <div className="text-rose-700/80 text-xs">
                until {formatTime(current.end_time)}
              </div>
            </div>
          ) : (
            <div className="rounded-lg bg-emerald-50/60 border border-emerald-100 px-3 py-2.5">
              <div className="text-[11px] uppercase tracking-wider text-emerald-700/80">
                Currently
              </div>
              <div className="font-medium text-emerald-900">Open for booking</div>
            </div>
          )}

          <div className="flex items-center justify-between text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" /> Next
            </span>
            <span className="text-foreground">
              {next ? `${next.title} · ${formatTime(next.start_time)}` : "No upcoming meetings"}
            </span>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between">
          <Link
            to="/panel/$roomCode"
            params={{ roomCode: room.code }}
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          >
            Live panel <ArrowRight className="h-3 w-3" />
          </Link>
          <Button
            onClick={onBook}
            className="bg-gradient-primary hover:opacity-90 text-primary-foreground shadow-soft"
          >
            <CalendarDays className="h-4 w-4 mr-1.5" /> Book
          </Button>
        </div>
      </div>
    </article>
  );
}

function toDatetimeLocal(d: Date) {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function BookingDialog({
  room,
  bookings,
  onClose,
}: {
  room: Room | null;
  bookings: Booking[];
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [organizer, setOrganizer] = useState("");
  const [start, setStart] = useState(() => {
    const d = new Date();
    d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
    return toDatetimeLocal(d);
  });
  const [end, setEnd] = useState(() => {
    const d = new Date();
    d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15 + 60, 0, 0);
    return toDatetimeLocal(d);
  });
  const [submitting, setSubmitting] = useState(false);

  if (!room) return null;

  const today = bookings
    .filter((b) => b.room_id === room.id && !b.cancelled)
    .sort((a, b) => +new Date(a.start_time) - +new Date(b.start_time));

  const submit = async () => {
    if (!title.trim() || !organizer.trim()) {
      toast.error("Please fill in title and organizer.");
      return;
    }
    const s = new Date(start);
    const e = new Date(end);
    if (e <= s) {
      toast.error("End time must be after start time.");
      return;
    }
    // conflict check
    const conflict = today.find((b) => {
      const bs = new Date(b.start_time);
      const be = new Date(b.end_time);
      return s < be && e > bs;
    });
    if (conflict) {
      toast.error(`Conflicts with "${conflict.title}" at ${formatTime(conflict.start_time)}.`);
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("bookings").insert({
      room_id: room.id,
      title: title.trim(),
      organizer: organizer.trim(),
      start_time: s.toISOString(),
      end_time: e.toISOString(),
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Room reserved.");
    setTitle("");
    setOrganizer("");
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-2xl">{room.name}</DialogTitle>
          <DialogDescription>
            {room.floor} · Reserve a time slot below.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="title">Meeting title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Quarterly planning sync"
              maxLength={120}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="organizer">Organizer</Label>
            <Input
              id="organizer"
              value={organizer}
              onChange={(e) => setOrganizer(e.target.value)}
              placeholder="Full name"
              maxLength={80}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="start">Start</Label>
              <Input id="start" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="end">End</Label>
              <Input id="end" type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>

          {today.length > 0 && (
            <div className="rounded-lg border border-border/70 p-3">
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                Today's schedule
              </div>
              <ul className="space-y-1.5 text-sm max-h-32 overflow-auto">
                {today.map((b) => (
                  <li key={b.id} className="flex justify-between">
                    <span className="truncate pr-3">{b.title}</span>
                    <span className="text-muted-foreground tabular-nums">
                      {formatTime(b.start_time)} – {formatTime(b.end_time)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={submitting}
            className="bg-gradient-primary text-primary-foreground"
          >
            {submitting ? "Booking…" : "Confirm booking"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
