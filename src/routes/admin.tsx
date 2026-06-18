import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  CalendarDays,
  LogOut,
  MonitorSmartphone,
  Shield,
  Trash2,
  Link as LinkIcon,
  Activity,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useBookings, useDevices, useNow, useRooms } from "@/lib/use-realtime";
import { formatTime, getRoomStatus, type Room } from "@/lib/rooms";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
});

function AdminPage() {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<{ userId: string; email: string } | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => {
      if (s?.user) {
        setSession({ userId: s.user.id, email: s.user.email ?? "" });
        checkRole(s.user.id);
      } else {
        setSession(null);
        setIsAdmin(false);
        setLoading(false);
      }
    });
    supabase.auth.getSession().then(({ data: { session: s }, error }) => {
      if (error) {
        console.error("[Admin] Failed to get session:", error.message);
        toast.error("Failed to restore session. Please sign in again.");
        setLoading(false);
        return;
      }
      if (s?.user) {
        setSession({ userId: s.user.id, email: s.user.email ?? "" });
        checkRole(s.user.id);
      } else {
        setLoading(false);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const checkRole = async (userId: string) => {
    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (error) {
      console.error("[Admin] Failed to check user role:", error.message);
      toast.error("Failed to verify admin status. Please try again.");
    }
    setIsAdmin(!!data);
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center text-muted-foreground">
        Loading…
      </div>
    );
  }
  if (!session) return <AdminAuth />;
  if (!isAdmin) return <NotAuthorized email={session.email} userId={session.userId} onPromoted={() => checkRole(session.userId)} />;

  return <AdminDashboard email={session.email} />;
}

function AdminAuth() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    if (mode === "signup") {
      // Validate password strength before signup
      if (password.length < 8) {
        setBusy(false);
        return toast.error("Password must be at least 8 characters long.");
      }
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: window.location.origin + "/admin" },
      });
      setBusy(false);
      if (error) return toast.error(error.message);
      toast.success("Account created. Please check your email to verify your account.");
      setMode("signin");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ 
        email: email.trim(), 
        password 
      });
      setBusy(false);
      if (error) return toast.error(error.message);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8 animate-fade-in">
          <div className="mx-auto h-16 w-auto flex items-center justify-center mb-4">
            <img 
              src="/logo.png" 
              alt="e-Crime Bureau" 
              className="h-full w-auto object-contain"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = "https://e-crimebureau.com/wp-content/uploads/2025/10/cropped-APPROVED-NEW-LOGO.png";
              }}
            />
          </div>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight">Administrator</h1>
          <p className="text-muted-foreground mt-1">Restricted access · Atrium control plane</p>
        </div>
        <form onSubmit={submit} className="rounded-2xl glass shadow-elegant p-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <Button type="submit" disabled={busy} className="w-full bg-gradient-primary text-primary-foreground">
            {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
          </Button>
          <button
            type="button"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="block w-full text-sm text-muted-foreground hover:text-foreground"
          >
            {mode === "signin" ? "Need an account? Sign up" : "Have an account? Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}

function NotAuthorized({ email, userId, onPromoted }: { email: string; userId: string; onPromoted: () => void }) {
  const [busy, setBusy] = useState(false);

  // Allow self-promotion only if no admin exists yet (first-time setup).
  // This relies on RLS: anyone signed-in cannot insert into user_roles (no insert policy),
  // so we attempt and surface the error if it fails. For first admin, the user must add
  // a row via the backend dashboard.
  const tryPromote = async () => {
    // Basic rate limiting/spam protection
    if (busy) return;
    
    setBusy(true);
    // Secure bootstrap: Only allow the VERY first admin to self-promote.
    // The RLS policy "first admin self-bootstrap" handles this on the backend.
    const { error } = await supabase.from("user_roles").insert({ 
      user_id: userId, 
      role: "admin" 
    });
    
    setBusy(false);
    if (error) {
      console.error("[Security] Promotion failed:", error.message);
      toast.error("Unauthorized: The first admin seat is already taken or your request was blocked.");
      return;
    }
    toast.success("Admin access granted.");
    onPromoted();
  };

  return (
    <div className="min-h-screen grid place-items-center px-4">
      <div className="max-w-md text-center space-y-4">
        <div className="mx-auto h-20 w-auto flex items-center justify-center">
          <img 
            src="/logo.png" 
            alt="e-Crime Bureau" 
            className="h-full w-auto object-contain"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.src = "https://e-crimebureau.com/wp-content/uploads/2025/10/cropped-APPROVED-NEW-LOGO.png";
            }}
          />
        </div>
        <h1 className="text-2xl font-semibold">Access pending</h1>
        <p className="text-muted-foreground">
          Signed in as <span className="font-medium">{email}</span>, but this account is not an
          administrator yet. Ask an existing admin to grant access, or claim the first admin seat
          for this workspace.
        </p>
        <div className="flex gap-2 justify-center">
          <Button onClick={tryPromote} disabled={busy} className="bg-gradient-primary text-primary-foreground">
            Claim first admin
          </Button>
          <Button variant="outline" onClick={() => supabase.auth.signOut()}>Sign out</Button>
        </div>
      </div>
    </div>
  );
}

function AdminDashboard({ email }: { email: string }) {
  const rooms = useRooms();
  const bookings = useBookings();
  const devices = useDevices();
  const now = useNow(5000);

  const stats = useMemo(() => {
    const total = rooms?.length ?? 0;
    const active = bookings?.filter((b) => !b.cancelled && new Date(b.start_time) <= now && new Date(b.end_time) > now).length ?? 0;
    const online = devices?.filter((d) => +now - +new Date(d.last_seen) < 90_000).length ?? 0;
    const pending = devices?.filter((d) => !d.room_id).length ?? 0;
    return { total, active, online, pending };
  }, [rooms, bookings, devices, now]);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-border bg-card/70 backdrop-blur sticky top-0 z-20">
        <div className="mx-auto max-w-7xl px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-auto flex items-center">
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
            <div>
              <div className="font-semibold tracking-tight">Atrium Admin</div>
              <div className="text-xs text-muted-foreground">{email}</div>
            </div>
          </div>
          <Button variant="ghost" onClick={() => supabase.auth.signOut()}>
            <LogOut className="h-4 w-4 mr-1.5" /> Sign out
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-10 space-y-10">
        {/* Stats */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={<Building2 className="h-4 w-4" />} label="Total rooms" value={stats.total} />
          <StatCard icon={<Activity className="h-4 w-4" />} label="Active meetings" value={stats.active} />
          <StatCard icon={<MonitorSmartphone className="h-4 w-4" />} label="Online devices" value={stats.online} />
          <StatCard icon={<LinkIcon className="h-4 w-4" />} label="Pending assignments" value={stats.pending} />
        </section>

        {/* Devices */}
        <section className="rounded-2xl border bg-card shadow-soft">
          <div className="px-6 py-4 border-b flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Devices</h2>
              <p className="text-sm text-muted-foreground">Assign provisioned tablets to rooms.</p>
            </div>
            <Badge variant="secondary">{devices?.length ?? 0} total</Badge>
          </div>
          <div className="divide-y">
            {(devices ?? []).length === 0 && (
              <div className="px-6 py-10 text-center text-muted-foreground">
                No devices yet. Open <code className="text-foreground">/setup</code> on a tablet to register one.
              </div>
            )}
            {devices?.map((d) => {
              const online = +now - +new Date(d.last_seen) < 90_000;
              const room = rooms?.find((r) => r.id === d.room_id);
              return (
                <div key={d.id} className="px-6 py-4 flex items-center gap-4 flex-wrap">
                  <div className="flex items-center gap-3 flex-1 min-w-[200px]">
                    <span className={`h-2.5 w-2.5 rounded-full ${online ? "bg-emerald-500" : "bg-muted-foreground/40"}`} />
                    <div>
                      <div className="font-mono text-sm">{d.device_id}</div>
                      <div className="text-xs text-muted-foreground">
                        {online ? "Online" : `Last seen ${new Date(d.last_seen).toLocaleTimeString()}`}
                      </div>
                    </div>
                  </div>
                  <DeviceAssign device={d} rooms={rooms ?? []} currentRoom={room ?? null} />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={async () => {
                      const { error } = await supabase.from("devices").delete().eq("id", d.id);
                      if (error) toast.error(error.message);
                      else toast.success("Device removed.");
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              );
            })}
          </div>
        </section>

        {/* Rooms */}
        <section className="rounded-2xl border bg-card shadow-soft">
          <div className="px-6 py-4 border-b">
            <h2 className="text-xl font-semibold">Rooms</h2>
            <p className="text-sm text-muted-foreground">Live state across the building.</p>
          </div>
          <div className="divide-y">
            {rooms?.map((r) => {
              const rb = (bookings ?? []).filter((b) => b.room_id === r.id);
              const { status, current, next } = getRoomStatus(rb, now);
              return (
                <div key={r.id} className="px-6 py-4 grid grid-cols-1 md:grid-cols-4 gap-3 items-center">
                  <div>
                    <div className="font-medium">{r.name}</div>
                    <div className="text-xs text-muted-foreground">{r.floor}</div>
                  </div>
                  <div className="text-sm">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${
                      status === "available" ? "bg-emerald-100 text-emerald-800" :
                      status === "soon" ? "bg-amber-100 text-amber-800" :
                      "bg-rose-100 text-rose-800"
                    }`}>
                      {status === "available" ? "Available" : status === "soon" ? "Reserved soon" : "Occupied"}
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground truncate">
                    {current ? `Now: ${current.title}` : next ? `Next: ${next.title} · ${formatTime(next.start_time)}` : "—"}
                  </div>
                  <div className="text-xs text-muted-foreground text-right">
                    <code>/panel/{r.code}</code>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Active bookings */}
        <section className="rounded-2xl border bg-card shadow-soft">
          <div className="px-6 py-4 border-b flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Upcoming & active meetings</h2>
              <p className="text-sm text-muted-foreground">Cancel any booking on behalf of the organizer.</p>
            </div>
            <CalendarDays className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="divide-y">
            {(bookings ?? [])
              .filter((b) => !b.cancelled && new Date(b.end_time) > now)
              .slice(0, 20)
              .map((b) => {
                const r = rooms?.find((x) => x.id === b.room_id);
                return (
                  <div key={b.id} className="px-6 py-4 flex items-center gap-4 flex-wrap">
                    <div className="flex-1 min-w-[200px]">
                      <div className="font-medium">{b.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {r?.name ?? "—"} · {b.organizer}
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground tabular-nums">
                      {formatTime(b.start_time)} – {formatTime(b.end_time)}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        const { error } = await supabase.from("bookings").update({ cancelled: true }).eq("id", b.id);
                        if (error) toast.error(error.message);
                        else toast.success("Booking cancelled.");
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                );
              })}
            {(bookings ?? []).filter((b) => !b.cancelled && new Date(b.end_time) > now).length === 0 && (
              <div className="px-6 py-10 text-center text-muted-foreground">No active or upcoming meetings.</div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

function DeviceAssign({
  device,
  rooms,
  currentRoom,
}: {
  device: { id: string };
  rooms: Room[];
  currentRoom: Room | null;
}) {
  const [value, setValue] = useState<string>(currentRoom?.id ?? "");

  useEffect(() => {
    setValue(currentRoom?.id ?? "");
  }, [currentRoom?.id]);

  const onChange = async (next: string) => {
    setValue(next);
    const room_id = next === "__none" ? null : next;
    const { error } = await supabase.from("devices").update({ room_id }).eq("id", device.id);
    if (error) toast.error(error.message);
    else toast.success(room_id ? "Device assigned." : "Device unassigned.");
  };

  return (
    <Select value={value || "__none"} onValueChange={onChange}>
      <SelectTrigger className="w-[240px]">
        <SelectValue placeholder="Assign room" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__none">Unassigned</SelectItem>
        {rooms.map((r) => (
          <SelectItem key={r.id} value={r.id}>
            {r.name} · {r.floor}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-soft">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
        <span className="text-primary">{icon}</span>
        {label}
      </div>
      <div className="mt-2 text-3xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}
