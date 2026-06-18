import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Booking, Room, DeviceRow } from "@/lib/rooms";

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function useRooms() {
  const [rooms, setRooms] = useState<Room[] | null>(null);
  useEffect(() => {
    let mounted = true;
    supabase
      .from("rooms")
      .select("*")
      .order("floor_order")
      .order("name")
      .then(({ data, error }) => {
        if (error) {
          console.error("[useRooms] Failed to fetch rooms:", error.message);
          return;
        }
        if (mounted && data) setRooms(data as Room[]);
      });
    const ch = supabase
      .channel("rooms-feed")
      .on("postgres_changes", { event: "*", schema: "public", table: "rooms" }, () => {
        supabase
          .from("rooms")
          .select("*")
          .order("floor_order")
          .order("name")
          .then(({ data, error }) => {
            if (error) {
              console.error("[useRooms] Failed to refresh rooms:", error.message);
              return;
            }
            if (data) setRooms(data as Room[]);
          });
      })
      .subscribe();
    return () => {
      mounted = false;
      supabase.removeChannel(ch);
    };
  }, []);
  return rooms;
}

export function useBookings(filter?: { roomId?: string }) {
  const [bookings, setBookings] = useState<Booking[] | null>(null);

  useEffect(() => {
    let mounted = true;
    const fetchAll = async () => {
      const since = new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString();
      let q = supabase
        .from("bookings")
        .select("*")
        .gte("end_time", since)
        .order("start_time");
      if (filter?.roomId) q = q.eq("room_id", filter.roomId);
      const { data, error } = await q;
      if (error) {
        console.error("[useBookings] Failed to fetch bookings:", error.message);
        return;
      }
      if (mounted && data) setBookings(data as Booking[]);
    };
    fetchAll();
    const ch = supabase
      .channel(`bookings-feed-${filter?.roomId ?? "all"}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bookings" },
        () => fetchAll(),
      )
      .subscribe();
    return () => {
      mounted = false;
      supabase.removeChannel(ch);
    };
  }, [filter?.roomId]);
  return bookings;
}

export function useDevices() {
  const [devices, setDevices] = useState<DeviceRow[] | null>(null);
  useEffect(() => {
    let mounted = true;
    const fetchAll = async () => {
      const { data, error } = await supabase
        .from("devices")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) {
        console.error("[useDevices] Failed to fetch devices:", error.message);
        return;
      }
      if (mounted && data) setDevices(data as DeviceRow[]);
    };
    fetchAll();
    const ch = supabase
      .channel("devices-feed")
      .on("postgres_changes", { event: "*", schema: "public", table: "devices" }, fetchAll)
      .subscribe();
    return () => {
      mounted = false;
      supabase.removeChannel(ch);
    };
  }, []);
  return devices;
}
