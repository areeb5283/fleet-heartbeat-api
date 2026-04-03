
-- Breakdowns table
CREATE TABLE public.breakdowns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'unknown',
  description TEXT,
  causes TEXT[] DEFAULT '{}',
  precautions TEXT[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'detected',
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  dispatched_to TEXT,
  contact_info TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.breakdowns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view breakdowns for own vehicles" ON public.breakdowns
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM vehicles WHERE vehicles.id = breakdowns.vehicle_id AND vehicles.owner = auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Users can insert breakdowns for own vehicles" ON public.breakdowns
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM vehicles WHERE vehicles.id = breakdowns.vehicle_id AND vehicles.owner = auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Users can update breakdowns for own vehicles" ON public.breakdowns
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM vehicles WHERE vehicles.id = breakdowns.vehicle_id AND vehicles.owner = auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
  );

CREATE TRIGGER update_breakdowns_updated_at
  BEFORE UPDATE ON public.breakdowns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Maintenance records table
CREATE TABLE public.maintenance_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT 'engine',
  part_name TEXT NOT NULL,
  condition TEXT NOT NULL DEFAULT 'good',
  predicted_failure_date DATE,
  last_serviced DATE,
  next_service_due DATE,
  notes TEXT,
  ai_recommendation TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.maintenance_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view maintenance for own vehicles" ON public.maintenance_records
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM vehicles WHERE vehicles.id = maintenance_records.vehicle_id AND vehicles.owner = auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Users can insert maintenance for own vehicles" ON public.maintenance_records
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM vehicles WHERE vehicles.id = maintenance_records.vehicle_id AND vehicles.owner = auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Users can update maintenance for own vehicles" ON public.maintenance_records
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM vehicles WHERE vehicles.id = maintenance_records.vehicle_id AND vehicles.owner = auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Users can delete maintenance for own vehicles" ON public.maintenance_records
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM vehicles WHERE vehicles.id = maintenance_records.vehicle_id AND vehicles.owner = auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
  );

CREATE TRIGGER update_maintenance_records_updated_at
  BEFORE UPDATE ON public.maintenance_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
