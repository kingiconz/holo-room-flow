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
  const [roomFetchError, setRoomFetchError] = useState<string | null>(null);
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
        if (!mounted) return;
        if (error) {
          console.error("Error fetching room:", error);
          setRoomFetchError(error.message);
          return;
        }
        console.log("Room data fetched:", data);
        setRoom((data as Room) ?? null);
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
      supabase
        .from("devices")
        .update({ last_seen: new Date().toISOString() })
        .eq("device_id", deviceId)
        .then(({ error }) => {
          if (error) console.error("[Heartbeat] Failed to update last_seen:", error.message);
        });
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

  if (room === undefined && !roomFetchError) {
    return (
      <div className="min-h-screen grid place-items-center bg-gradient-panel text-white">
        <div className="opacity-80">Loading…</div>
      </div>
    );
  }
  if (roomFetchError) {
    return (
      <div className="min-h-screen grid place-items-center bg-gradient-panel text-white">
        <div className="text-center">
          <div className="text-2xl font-semibold">Failed to load room</div>
          <div className="opacity-70 mt-2">{roomFetchError}</div>
        </div>
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

  const stateLabel =
    status === "occupied" ? "MEETING IN SESSION" :
    status === "soon" ? "RESERVED SOON" : "AVAILABLE";

  const countdownLabel = current
    ? `Ends in ${formatCountdown(+new Date(current.end_time) - +now)}`
    : next
    ? `Starts in ${formatCountdown(+new Date(next.start_time) - +now)}`
    : "Open all day";

  const statusColor =
    status === "occupied" ? "text-rose-600" :
    status === "soon" ? "text-amber-600" : "text-emerald-600";

  return (
    <div className="min-h-screen text-slate-900 bg-white relative overflow-hidden">
      {/* Background Watermark with Blue Tint */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 bg-blue-900/10 z-[1]" />
        <img 
          src="https://images.unsplash.com/photo-1542831371-29b0f74f9713?auto=format&fit=crop&q=80&w=2070" 
          alt="" 
          className="w-full h-full object-cover opacity-[0.10] grayscale contrast-125"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.src = "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&q=80&w=2070";
          }}
        />
      </div>

      <div className="relative z-10 h-screen flex flex-col p-4 md:p-6 lg:p-10 overflow-hidden">
        {/* Top bar */}
        <div className="flex items-center justify-end text-slate-500 flex-wrap gap-4 shrink-0">
          <div className="flex items-center gap-4 md:gap-6 text-sm">
            <Clock now={now} />
            <span className="flex items-center gap-1.5 whitespace-nowrap">
              {online ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4 text-rose-500" />}
              <span className="hidden sm:inline">{online ? "Live" : "Offline"}</span>
            </span>
          </div>
        </div>

        {/* Center Content */}
        <div className="flex-1 flex flex-col justify-center items-center text-center min-h-0 py-2">
          {/* Logo - Maximized for main attention */}
          <div className="h-40 sm:h-56 md:h-72 lg:h-96 w-auto flex items-center justify-center mb-8 sm:mb-12 animate-fade-in shrink-0">
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

          {/* Status Label */}
          <h1 className={`text-2xl sm:text-4xl lg:text-5xl xl:text-6xl font-black tracking-tighter leading-none text-balance mb-4 ${statusColor}`}>
            {stateLabel}
          </h1>

          {/* Meeting Details */}
          {current ? (
            <div className="max-w-2xl mx-auto px-4 flex flex-col items-center">
              <div className="text-slate-400 uppercase tracking-[0.2em] text-[8px] md:text-[10px] font-bold mb-1">Current Meeting</div>
              <div className="text-base md:text-xl lg:text-2xl font-bold text-slate-800 line-clamp-1">{current.title}</div>
              <div className="text-xs md:text-base lg:text-lg text-slate-500 mt-1">
                {current.organizer} · {formatTime(current.start_time)} – {formatTime(current.end_time)}
              </div>
            </div>
          ) : (
            <div className="text-sm md:text-lg lg:text-xl text-slate-400 italic px-4 font-medium">
              This space is ready when you are.
            </div>
          )}

          {/* Countdown Badge */}
          <div className="mt-6 inline-flex items-center gap-2 md:gap-3 rounded-full bg-slate-50 px-3 py-1.5 md:px-5 md:py-2.5 text-[10px] md:text-base lg:text-lg tabular-nums shadow-sm border border-slate-100 text-slate-500 font-medium">
            <span className={`h-1.5 w-1.5 md:h-2 rounded-full animate-pulse ${status === 'occupied' ? 'bg-rose-400' : status === 'soon' ? 'bg-amber-400' : 'bg-emerald-400'}`} />
            {countdownLabel}
          </div>
        </div>

        {/* Bottom spacer to maintain layout balance */}
        <div className="h-8 md:h-12 shrink-0" />
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
