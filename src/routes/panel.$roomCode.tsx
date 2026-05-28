import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Wifi, WifiOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useBookings, useNow } from "@/lib/use-realtime";
import {
  getRoomStatus,
  formatCountdown,
  formatTime,
  type Room,
} from "@/lib/rooms";

export const Route = createFileRoute("/panel/$roomCode")({
  head: ({ params }) => ({
    meta: [{ title: `Room Panel · ${params.roomCode.toUpperCase()}` }],
  }),
  component: PanelPage,
});

function PanelPage() {
  const { roomCode } = Route.useParams();
  const [room, setRoom] = useState<Room | null | undefined>(undefined);
  const [online, setOnline] = useState(true);

  // Fullscreen logic
  useEffect(() => {
    const enterFullscreen = async () => {
      try {
        if (!document.fullscreenElement) {
          await document.documentElement.requestFullscreen();
        }
      } catch (err) {
        console.warn("Fullscreen request failed (usually requires user interaction):", err);
      }
    };

    // Attempt on mount (may be blocked by browser)
    enterFullscreen();

    // Also attempt on first click anywhere
    const handleFirstClick = () => {
      enterFullscreen();
      window.removeEventListener("click", handleFirstClick);
    };
    window.addEventListener("click", handleFirstClick);

    return () => window.removeEventListener("click", handleFirstClick);
  }, []);

  useEffect(() => {
    let mounted = true;
    supabase
      .from("rooms")
      .select("*")
      .eq("code", roomCode)
      .maybeSingle()
      .then(({ data }) => mounted && setRoom((data as Room) ?? null));
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      mounted = false;
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [roomCode]);

  const bookings = useBookings({ roomId: room?.id });
  const now = useNow(1000);

  // Heartbeat: if this device matches one in localStorage, ping last_seen
  useEffect(() => {
    const deviceId = typeof window !== "undefined" ? localStorage.getItem("atrium.deviceId") : null;
    if (!deviceId) return;
    const beat = () => {
      supabase.from("devices").update({ last_seen: new Date().toISOString() }).eq("device_id", deviceId);
    };
    beat();
    const id = setInterval(beat, 30000);
    return () => clearInterval(id);
  }, [room?.id]);

  if (room === undefined) {
    return (
      <div className="min-h-screen grid place-items-center bg-gradient-panel text-white">
        <div className="opacity-80">Loading…</div>
      </div>
    );
  }
  if (room === null) {
    return (
      <div className="min-h-screen grid place-items-center bg-gradient-panel text-white">
        <div className="text-center">
          <div className="text-2xl font-semibold">Unknown room code</div>
          <div className="opacity-70 mt-2">"{roomCode}" is not registered.</div>
        </div>
      </div>
    );
  }

  const { status, current, next } = getRoomStatus(bookings ?? [], now);

  const bg =
    status === "occupied"
      ? "from-rose-900 via-rose-700 to-rose-800"
      : status === "soon"
      ? "from-amber-800 via-amber-600 to-amber-700"
      : "from-emerald-900 via-emerald-700 to-emerald-800";

  const stateLabel =
    status === "occupied" ? "MEETING IN SESSION" :
    status === "soon" ? "RESERVED SOON" : "AVAILABLE";

  const countdownLabel = current
    ? `Ends in ${formatCountdown(+new Date(current.end_time) - +now)}`
    : next
    ? `Starts in ${formatCountdown(+new Date(next.start_time) - +now)}`
    : "Open all day";

  return (
    <div className={`min-h-screen text-white bg-gradient-to-br ${bg} relative overflow-hidden`}>
      <div
        className="absolute inset-0 opacity-20 mix-blend-overlay pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(900px 500px at 90% 10%, white, transparent 60%), radial-gradient(700px 400px at 10% 90%, white, transparent 60%)",
        }}
      />

      <div className="relative h-screen flex flex-col p-6 md:p-10 lg:p-16">
        {/* Top bar */}
        <div className="flex items-center justify-between text-white/85 flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 md:h-11 md:w-11 rounded-xl bg-white/15 backdrop-blur grid place-items-center overflow-hidden shrink-0">
              <img src="/favicon.ico" alt="Atrium" className="h-7 w-7 md:h-8 md:w-8 object-contain" />
            </div>
            <div>
              <div className="text-[10px] md:text-sm uppercase tracking-[0.25em] opacity-80">Atrium</div>
              <div className="text-base md:text-lg font-medium leading-tight">{room.floor}</div>
            </div>
          </div>
          <div className="flex items-center gap-4 md:gap-6 text-sm">
            <Clock now={now} />
            <span className="flex items-center gap-1.5 whitespace-nowrap">
              {online ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
              <span className="hidden sm:inline">{online ? "Live" : "Offline"}</span>
            </span>
          </div>
        </div>

        {/* Center */}
        <div className="flex-1 flex flex-col justify-center text-center py-8">
          <h1 className="text-5xl sm:text-7xl lg:text-9xl font-semibold tracking-tight leading-[0.95] text-balance mx-auto">
            {stateLabel}
          </h1>
          <div className="mt-3 md:mt-4 text-white/80 text-lg md:text-2xl lg:text-3xl tracking-[0.1em] font-medium uppercase px-4">{room.name}</div>

          {current ? (
            <div className="mt-8 md:mt-10 max-w-4xl mx-auto px-4">
              <div className="text-white/70 uppercase tracking-widest text-[10px] md:text-sm">Current meeting</div>
              <div className="mt-1 md:mt-2 text-2xl md:text-4xl lg:text-5xl font-medium line-clamp-2">{current.title}</div>
              <div className="mt-1 md:mt-2 text-lg md:text-2xl text-white/80">
                {current.organizer} · {formatTime(current.start_time)} – {formatTime(current.end_time)}
              </div>
            </div>
          ) : (
            <div className="mt-8 md:mt-10 text-xl md:text-3xl lg:text-4xl text-white/85 italic px-4">
              This space is ready when you are.
            </div>
          )}

          <div className="mt-8 md:mt-10 inline-flex items-center gap-3 self-center rounded-full bg-white/15 backdrop-blur px-4 py-2 md:px-5 md:py-2.5 text-base md:text-lg tabular-nums">
            <span className="h-2 w-2 md:h-2.5 md:w-2.5 rounded-full bg-white animate-pulse" />
            {countdownLabel}
          </div>
        </div>

        {/* Bottom: Next meetings */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mt-auto">
          <div className="rounded-2xl bg-white/10 backdrop-blur p-4 md:p-6 border border-white/15">
            <div className="text-white/70 uppercase tracking-widest text-[10px] md:text-xs">Up next</div>
            {next ? (
              <div className="mt-1 md:mt-2">
                <div className="text-xl md:text-2xl font-medium truncate">{next.title}</div>
                <div className="text-white/80 text-sm md:text-base">
                  {next.organizer} · {formatTime(next.start_time)} – {formatTime(next.end_time)}
                </div>
              </div>
            ) : (
              <div className="mt-1 md:mt-2 text-white/80 text-sm md:text-base">No upcoming meetings today.</div>
            )}
          </div>
          <div className="hidden sm:block rounded-2xl bg-white/10 backdrop-blur p-4 md:p-6 border border-white/15">
            <div className="text-white/70 uppercase tracking-widest text-[10px] md:text-xs">Today</div>
            <div className="mt-1 md:mt-2 space-y-1 max-h-24 md:max-h-32 overflow-hidden">
              {(bookings ?? []).slice(0, 4).map((b) => (
                <div key={b.id} className="flex justify-between text-white/90 text-sm md:text-base">
                  <span className="truncate pr-3">{b.title}</span>
                  <span className="tabular-nums text-white/70 shrink-0">
                    {formatTime(b.start_time)}–{formatTime(b.end_time)}
                  </span>
                </div>
              ))}
              {(bookings ?? []).length === 0 && (
                <div className="text-white/70 text-sm md:text-base">Nothing scheduled.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Clock({ now }: { now: Date }) {
  return (
    <div className="text-right">
      <div className="text-xl font-medium tabular-nums">
        {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
      </div>
      <div className="text-xs opacity-75">
        {now.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" })}
      </div>
    </div>
  );
}
