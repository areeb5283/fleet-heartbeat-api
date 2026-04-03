
-- Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- user_roles policies
CREATE POLICY "Users can view their own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all roles" ON public.user_roles
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- Auto-assign 'user' role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Vehicles table
CREATE TABLE public.vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model TEXT NOT NULL,
  manufacturer TEXT NOT NULL,
  year INTEGER NOT NULL,
  fuel_type TEXT NOT NULL DEFAULT 'gasoline',
  owner UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own vehicles" ON public.vehicles
  FOR SELECT USING (auth.uid() = owner OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can create own vehicles" ON public.vehicles
  FOR INSERT WITH CHECK (auth.uid() = owner);
CREATE POLICY "Users can update own vehicles" ON public.vehicles
  FOR UPDATE USING (auth.uid() = owner);
CREATE POLICY "Users can delete own vehicles" ON public.vehicles
  FOR DELETE USING (auth.uid() = owner);

-- Telematics data table
CREATE TABLE public.telematics_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE CASCADE NOT NULL,
  speed DOUBLE PRECISION NOT NULL DEFAULT 0,
  rpm DOUBLE PRECISION NOT NULL DEFAULT 0,
  engine_temp DOUBLE PRECISION NOT NULL DEFAULT 0,
  fuel_level DOUBLE PRECISION NOT NULL DEFAULT 100,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.telematics_data ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_telematics_vehicle_time ON public.telematics_data (vehicle_id, recorded_at DESC);
CREATE INDEX idx_telematics_recorded_at ON public.telematics_data (recorded_at DESC);

CREATE POLICY "Users can view telematics for own vehicles" ON public.telematics_data
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.vehicles WHERE vehicles.id = telematics_data.vehicle_id AND vehicles.owner = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );
CREATE POLICY "Users can insert telematics for own vehicles" ON public.telematics_data
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.vehicles WHERE vehicles.id = telematics_data.vehicle_id AND vehicles.owner = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

-- Trips table
CREATE TABLE public.trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE CASCADE NOT NULL,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  end_time TIMESTAMP WITH TIME ZONE,
  distance DOUBLE PRECISION DEFAULT 0,
  avg_speed DOUBLE PRECISION DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_trips_vehicle ON public.trips (vehicle_id, start_time DESC);

CREATE POLICY "Users can view trips for own vehicles" ON public.trips
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.vehicles WHERE vehicles.id = trips.vehicle_id AND vehicles.owner = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );
CREATE POLICY "Users can insert trips for own vehicles" ON public.trips
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.vehicles WHERE vehicles.id = trips.vehicle_id AND vehicles.owner = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );
CREATE POLICY "Users can update trips for own vehicles" ON public.trips
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.vehicles WHERE vehicles.id = trips.vehicle_id AND vehicles.owner = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

-- Alerts table
CREATE TABLE public.alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('overspeed', 'high_temp', 'low_fuel')),
  message TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'critical')),
  acknowledged BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_alerts_vehicle ON public.alerts (vehicle_id, created_at DESC);
CREATE INDEX idx_alerts_unacknowledged ON public.alerts (acknowledged, created_at DESC);

CREATE POLICY "Users can view alerts for own vehicles" ON public.alerts
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.vehicles WHERE vehicles.id = alerts.vehicle_id AND vehicles.owner = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );
CREATE POLICY "Users can insert alerts for own vehicles" ON public.alerts
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.vehicles WHERE vehicles.id = alerts.vehicle_id AND vehicles.owner = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );
CREATE POLICY "Users can update alerts for own vehicles" ON public.alerts
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.vehicles WHERE vehicles.id = alerts.vehicle_id AND vehicles.owner = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_vehicles_updated_at BEFORE UPDATE ON public.vehicles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_trips_updated_at BEFORE UPDATE ON public.trips FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
