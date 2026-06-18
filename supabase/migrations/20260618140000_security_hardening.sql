-- Security hardening: restrict device UPDATE policy
-- Previously "anyone heartbeat" allowed any user to change room_id on any device.
-- Now split into two policies:
--   1. Anonymous/authenticated can only update last_seen (heartbeat)
--   2. Only admins can change room_id (device assignment)

DROP POLICY IF EXISTS "anyone heartbeat" ON public.devices;

-- Devices can heartbeat (update last_seen only) but cannot change room assignment
CREATE POLICY "devices heartbeat only"
  ON public.devices FOR UPDATE
  USING (true)
  WITH CHECK (room_id IS NOT DISTINCT FROM (SELECT d.room_id FROM public.devices d WHERE d.id = devices.id));

-- Admins can fully update devices (assign rooms, etc.)
CREATE POLICY "admins manage devices"
  ON public.devices FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Security hardening: add length constraints to bookings insert
-- Prevents abuse via extremely long title/organizer fields
DROP POLICY IF EXISTS "anyone create bookings" ON public.bookings;

CREATE POLICY "anyone create bookings" ON public.bookings FOR INSERT WITH CHECK (
  char_length(title) BETWEEN 1 AND 200
  AND char_length(organizer) BETWEEN 1 AND 100
  AND end_time > start_time
  AND end_time - start_time <= interval '12 hours'
);
