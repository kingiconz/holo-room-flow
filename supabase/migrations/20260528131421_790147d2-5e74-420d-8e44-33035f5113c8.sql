
-- Roles
CREATE TYPE public.app_role AS ENUM ('admin');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "users view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Rooms
CREATE TABLE public.rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  floor TEXT NOT NULL,
  floor_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.rooms TO anon, authenticated;
GRANT ALL ON public.rooms TO service_role;
GRANT INSERT, UPDATE, DELETE ON public.rooms TO authenticated;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone can view rooms" ON public.rooms FOR SELECT USING (true);
CREATE POLICY "admins manage rooms" ON public.rooms FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Bookings
CREATE TABLE public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  organizer TEXT NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  cancelled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX bookings_room_time_idx ON public.bookings (room_id, start_time);
GRANT SELECT, INSERT ON public.bookings TO anon, authenticated;
GRANT UPDATE, DELETE ON public.bookings TO authenticated;
GRANT ALL ON public.bookings TO service_role;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone view bookings" ON public.bookings FOR SELECT USING (true);
CREATE POLICY "anyone create bookings" ON public.bookings FOR INSERT WITH CHECK (
  title <> '' AND organizer <> '' AND end_time > start_time
);
CREATE POLICY "admins update bookings" ON public.bookings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins delete bookings" ON public.bookings FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Devices
CREATE TABLE public.devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT NOT NULL UNIQUE,
  room_id UUID REFERENCES public.rooms(id) ON DELETE SET NULL,
  last_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.devices TO anon, authenticated;
GRANT DELETE ON public.devices TO authenticated;
GRANT ALL ON public.devices TO service_role;
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone view devices" ON public.devices FOR SELECT USING (true);
CREATE POLICY "anyone register device" ON public.devices FOR INSERT WITH CHECK (true);
-- allow device itself to heartbeat (update last_seen). Admins can reassign rooms.
CREATE POLICY "anyone heartbeat" ON public.devices FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "admins delete devices" ON public.devices FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.devices;
ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;

-- Seed rooms
INSERT INTO public.rooms (code, name, floor, floor_order) VALUES
  ('gf-gchq', 'Guest Connect HQ', 'Ground Floor', 0),
  ('gf-gmr',  'Guest Meeting Room', 'Ground Floor', 0),
  ('ff-knmr', 'Kwame Nkrumah Meeting Room', 'First Floor', 1),
  ('sf-nmmr', 'Nelson Mandela Meeting Room', 'Second Floor', 2),
  ('sf-eca',  'e-Crime Academy', 'Second Floor', 2),
  ('tf-ybmr', 'Yaw Broni Meeting Room', 'Third Floor', 3);
