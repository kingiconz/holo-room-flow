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
  console.log("PanelPage mounting for room:", roomCode);
  const [room, setRoom] = useState<Room | null | undefined>(undefined);
  const [online, setOnline] = useState(true);
  const [lastEndedMeetingId, setLastEndedMeetingId] = useState<string | null>(null);

  // Fullscreen logic
  useEffect(() => {
    console.log("Fullscreen effect running");
    const enterFullscreen = async () => {
      try {
        if (!document.fullscreenElement) {
          await document.documentElement.requestFullscreen();
        }
      } catch (err) {
        console.warn("Fullscreen request failed (usually requires user interaction):", err);
      }
    };

    // Attempt on mount removed as it's often blocked and can cause issues
    // enterFullscreen();

    // Also attempt on first click anywhere
    const handleFirstClick = () => {
      console.log("First click detected, requesting fullscreen");
      enterFullscreen();
      window.removeEventListener("click", handleFirstClick);
    };
    window.addEventListener("click", handleFirstClick);

    return () => window.removeEventListener("click", handleFirstClick);
  }, []);

  useEffect(() => {
    console.log("Room fetch effect running for:", roomCode);
    let mounted = true;
    supabase
      .from("rooms")
      .select("*")
      .eq("code", roomCode)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) console.error("Error fetching room:", error);
        if (mounted) {
          console.log("Room data fetched:", data);
          setRoom((data as Room) ?? null);
        }
      });
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

  // Alert logic: play sound when a meeting ends
  useEffect(() => {
    if (!bookings || bookings.length === 0) return;

    // Find the meeting that just ended (ended within the last 5 seconds)
    const recentlyEnded = bookings.find((b) => {
      const endTime = new Date(b.end_time).getTime();
      const currentTime = now.getTime();
      return currentTime >= endTime && currentTime < endTime + 5000 && !b.cancelled;
    });

    if (recentlyEnded && recentlyEnded.id !== lastEndedMeetingId) {
      setLastEndedMeetingId(recentlyEnded.id);
      
      // Play ramping alert sound (up to 200% volume)
      const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3");
      audio.crossOrigin = "anonymous";
      
      try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const source = audioContext.createMediaElementSource(audio);
        const gainNode = audioContext.createGain();
        
        source.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        // Start at 0.5 (50%) and ramp to 2.0 (200%) over 3 seconds
        gainNode.gain.setValueAtTime(0.5, audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(2.0, audioContext.currentTime + 3);
        
        audio.play().catch(err => console.warn("Audio playback failed:", err));
      } catch (e) {
        // Fallback if Web Audio API fails
        audio.volume = 1.0;
        audio.play().catch(err => console.warn("Fallback audio playback failed:", err));
      }
    }
  }, [now, bookings, lastEndedMeetingId]);

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

      <div className="relative h-screen flex flex-col p-4 md:p-8 lg:p-12 overflow-hidden">
        {/* Top bar */}
        <div className="flex items-center justify-between text-white/85 flex-wrap gap-2 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 md:h-11 md:w-11 rounded-xl bg-white/15 backdrop-blur grid place-items-center overflow-hidden shrink-0">
              <img src="/favicon.ico" alt="Atrium" className="h-6 w-6 md:h-8 md:w-8 object-contain" />
            </div>
            <div>
              <div className="text-[10px] md:text-sm uppercase tracking-[0.25em] opacity-80">Atrium</div>
              <div className="text-sm md:text-lg font-medium leading-tight">{room.floor}</div>
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
        <div className="flex-1 flex flex-col justify-center text-center min-h-0 py-2 md:py-4">
          <h1 className="text-4xl sm:text-6xl lg:text-7xl xl:text-8xl font-semibold tracking-tight leading-none text-balance mx-auto shrink-0">
            {stateLabel}
          </h1>
          <div className="mt-1 md:mt-2 text-white/80 text-sm md:text-lg lg:text-xl tracking-[0.1em] font-medium uppercase px-4 shrink-0">{room.name}</div>

          {current ? (
            <div className="mt-2 md:mt-4 max-w-4xl mx-auto px-4 overflow-hidden flex flex-col shrink">
              <div className="text-white/70 uppercase tracking-widest text-[9px] md:text-xs shrink-0">Current meeting</div>
              <div className="mt-0.5 md:mt-1 text-lg md:text-2xl lg:text-3xl font-medium line-clamp-1 shrink-0">{current.title}</div>
              <div className="mt-0.5 md:mt-1 text-sm md:text-lg text-white/80 truncate shrink-0">
                {current.organizer} · {formatTime(current.start_time)} – {formatTime(current.end_time)}
              </div>
            </div>
          ) : (
            <div className="mt-2 md:mt-4 text-base md:text-xl lg:text-2xl text-white/85 italic px-4 shrink-0">
              This space is ready when you are.
            </div>
          )}

          <div className="mt-3 md:mt-6 inline-flex items-center gap-2 md:gap-3 self-center rounded-full bg-white/15 backdrop-blur px-3 py-1.5 md:px-5 md:py-2 text-xs md:text-base tabular-nums shrink-0">
            <span className="h-1.5 w-1.5 md:h-2 md:w-2 rounded-full bg-white animate-pulse" />
            {countdownLabel}
          </div>
        </div>

        {/* Bottom: Next meetings */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-8 shrink-0">
          <div className="rounded-2xl md:rounded-3xl bg-white/10 backdrop-blur-xl p-4 md:p-6 lg:p-8 border border-white/20 shadow-2xl flex flex-col justify-center min-h-0">
            <div className="text-white/60 uppercase tracking-[0.2em] text-[9px] md:text-xs font-bold shrink-0">Up next</div>
            {next ? (
              <div className="mt-1 md:mt-2 shrink-0">
                <div className="text-lg md:text-2xl lg:text-3xl font-semibold truncate leading-tight">{next.title}</div>
                <div className="mt-0.5 md:mt-1 text-sm md:text-lg text-white/80 font-medium">
                  {next.organizer} · {formatTime(next.start_time)} – {formatTime(next.end_time)}
                </div>
              </div>
            ) : (
              <div className="mt-1 md:mt-2 text-white/80 text-sm md:text-lg italic shrink-0">No upcoming meetings today.</div>
            )}
          </div>
          <div className="hidden sm:flex rounded-2xl md:rounded-3xl bg-white/10 backdrop-blur-xl p-4 md:p-6 lg:p-8 border border-white/20 shadow-2xl flex flex-col justify-center min-h-0">
            <div className="text-white/60 uppercase tracking-[0.2em] text-[9px] md:text-xs font-bold shrink-0">Today's Schedule</div>
            <div className="mt-1 md:mt-2 space-y-1 md:space-y-1.5 overflow-hidden shrink">
              {(bookings ?? []).filter(b => !b.cancelled).slice(0, 2).map((b) => (
                <div key={b.id} className="flex justify-between items-center text-white/90 text-xs md:text-base border-b border-white/5 pb-0.5 last:border-0">
                  <span className="truncate pr-4 font-medium">{b.title}</span>
                  <span className="tabular-nums text-white/60 shrink-0 font-light">
                    {formatTime(b.start_time)} – {formatTime(b.end_time)}
                  </span>
                </div>
              ))}
              {(bookings ?? []).filter(b => !b.cancelled).length === 0 && (
                <div className="text-white/80 text-sm md:text-base italic">Nothing scheduled.</div>
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
