import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { setLedColor, type LedColor } from "@/plugins/ledBridge";
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
  const { status, current, next } = getRoomStatus(bookings ?? [], now);

  // LED logic: update color based on room status
  useEffect(() => {
    if (!room) return;
    
    let ledColor: LedColor;
    switch (status) {
      case "available":
        ledColor = "GREEN";
        break;
      case "soon":
        ledColor = "YELLOW";
        break;
      case "occupied":
        ledColor = "RED";
        break;
      default:
        ledColor = "OFF";
    }

    console.log(`[LED] Setting color to ${ledColor} for room status: ${status}`);
    try {
      setLedColor(ledColor);
    } catch (error) {
      console.warn("[LED] Bridge call failed", error);
    }
  }, [status, !!room]);

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
      
      const playTransitionSound = () => {
        const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/1146/1146-preview.mp3");
        audio.crossOrigin = "anonymous";
        
        let playCount = 0;
        const maxPlays = 3;

        try {
          const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
          const source = audioContext.createMediaElementSource(audio);
          const gainNode = audioContext.createGain();
          
          source.connect(gainNode);
          gainNode.connect(audioContext.destination);
          
          if (audioContext.state === 'suspended') {
            audioContext.resume();
          }

          const startPlayback = () => {
            playCount++;
            // Use constant triple volume (3.0x) for all plays
            const targetGain = 3.0; 
            gainNode.gain.setTargetAtTime(targetGain, audioContext.currentTime, 0.1);
            
            audio.play().catch(err => console.warn(`[LED] Playback ${playCount} failed:`, err));
          };

          audio.onended = () => {
            if (playCount < maxPlays) {
              console.log(`[LED] Repeating sound, count: ${playCount + 1}`);
              startPlayback();
            } else {
              audioContext.close().catch(() => {});
            }
          };

          startPlayback();

        } catch (e) {
          // Basic Fallback
          audio.onended = () => {
            playCount++;
            if (playCount < maxPlays) audio.play();
          };
          audio.play();
        }
      };

      // Play the transition sound once
      playTransitionSound();
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
        <div className="flex items-center justify-between text-white/85 flex-wrap gap-4 shrink-0">
          <div className="flex items-center gap-5">
            <div className="h-12 w-auto flex items-center shrink-0">
              <img 
                src="/logo.png" 
                alt="Atrium" 
                className="h-full w-auto object-contain"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = "https://e-crimebureau.com/wp-content/uploads/2025/10/cropped-APPROVED-NEW-LOGO.png";
                }}
              />
            </div>
            <div className="flex flex-col">
              <div className="text-2xl font-bold tracking-tight leading-none">Atrium</div>
              <div className="text-[10px] uppercase tracking-[0.3em] opacity-80 mt-1 font-medium">
                Workspace
              </div>
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
        <div className="grid grid-cols-1 gap-4 lg:gap-8 shrink-0 max-w-2xl mx-auto w-full">
          <div className="rounded-2xl md:rounded-3xl bg-white/10 backdrop-blur-xl p-4 md:p-6 lg:p-8 border border-white/20 shadow-2xl flex flex-col justify-center min-h-0 text-center">
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
