import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { DeviceRow, Room } from "@/lib/rooms";
import { AppLogo } from "@/components/AppLogo";
import { setLedColor } from "@/plugins/ledBridge";

export const Route = createFileRoute("/setup")({
  component: SetupPage,
});

async function generateSequentialDeviceId(): Promise<string> {
  const { data: devices } = await supabase.from("devices").select("device_id");

  let maxSequence = 0;
  if (devices) {
    devices.forEach((d) => {
      const match = d.device_id.match(/eCB-TAB303-(\d{3})/);
      if (match) {
        const seq = parseInt(match[1], 10);
        if (seq > maxSequence) maxSequence = seq;
      }
    });
  }

  const nextSequence = (maxSequence + 1).toString().padStart(3, "0");
  return `eCB-TAB303-${nextSequence}`;
}

function SetupPage() {
  const navigate = useNavigate();
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [registering, setRegistering] = useState(true);
  const [assignedRoom, setAssignedRoom] = useState<Room | null>(null);

  // Set LED to YELLOW while in setup
  useEffect(() => {
    console.log("[LED] Setting color to YELLOW for setup");
    setLedColor("YELLOW");
  }, []);

  // Register on mount
  useEffect(() => {
    let mounted = true;
    (async () => {
      let id = localStorage.getItem("atrium.deviceId");

      if (!id) {
        id = await generateSequentialDeviceId();
        localStorage.setItem("atrium.deviceId", id);
      }

      if (!mounted) return;
      setDeviceId(id);

      // Upsert by device_id
      const { data: existing } = await supabase
        .from("devices")
        .select("*")
        .eq("device_id", id)
        .maybeSingle();

      if (!existing) {
        await supabase.from("devices").insert({ device_id: id });
      } else {
        await supabase
          .from("devices")
          .update({ last_seen: new Date().toISOString() })
          .eq("device_id", id);
      }
      setRegistering(false);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Poll for assignment + realtime
  useEffect(() => {
    if (!deviceId) return;
    let mounted = true;

    const check = async () => {
      const { data: device } = await supabase
        .from("devices")
        .select("*")
        .eq("device_id", deviceId)
        .maybeSingle<DeviceRow>();

      if (device?.room_id) {
        const { data: room } = await supabase
          .from("rooms")
          .select("*")
          .eq("id", device.room_id)
          .maybeSingle<Room>();
        if (room && mounted) {
          setAssignedRoom(room);
          setTimeout(() => {
            navigate({ to: "/panel/$roomCode", params: { roomCode: room.code } });
          }, 1800);
        }
      }
    };

    check();
    const interval = setInterval(check, 4000);
    const channel = supabase
      .channel(`device-${deviceId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "devices", filter: `device_id=eq.${deviceId}` },
        () => check(),
      )
      .subscribe();

    return () => {
      mounted = false;
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [deviceId, navigate]);

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-panel text-white grid place-items-center px-6">
      <div
        className="absolute inset-0 opacity-25 mix-blend-overlay pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(800px 500px at 20% 10%, white, transparent 60%), radial-gradient(900px 600px at 80% 100%, white, transparent 60%)",
        }}
      />
      <div className="relative max-w-xl w-full text-center animate-fade-in">
        <div className="mx-auto h-40 w-auto flex items-center justify-center mb-10">
          <AppLogo style={{ maxWidth: "100%", maxHeight: "160px" }} />
        </div>
        <div className="text-xs uppercase tracking-[0.35em] text-white/70">Tablet Provisioning</div>
        <h1 className="mt-3 text-4xl md:text-5xl font-semibold tracking-tight">
          {assignedRoom ? "Assignment received" : "Waiting for Room Assignment"}
        </h1>
        <p className="mt-4 text-white/75 max-w-md mx-auto">
          {assignedRoom
            ? `This tablet has been assigned to ${assignedRoom.name}. Launching the room panel…`
            : "An administrator will assign this device to a meeting room. Keep this screen on."}
        </p>

        <div className="mt-10 rounded-2xl glass-dark border border-white/15 p-6">
          <div className="text-xs uppercase tracking-widest text-white/60">Device identifier</div>
          <div className="mt-2 font-mono text-2xl tracking-wider">{deviceId ?? "Generating…"}</div>
          <div className="mt-6 flex items-center justify-center gap-2 text-sm text-white/80">
            {assignedRoom ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                Assigned to {assignedRoom.name}
              </>
            ) : registering ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Registering with backend…
              </>
            ) : (
              <>
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                Online · Awaiting assignment
              </>
            )}
          </div>
        </div>

        <div className="mt-8 text-xs text-white/50">
          Need help? Provide this device ID to your IT administrator.
        </div>
      </div>
    </div>
  );
}
