-- Phase 1: Add org_id columns and create edge_function_logs table

-- 1.1 Add org_id to task_instances
ALTER TABLE public.task_instances 
ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organizations(id);

-- 1.2 Add org_id to completions
ALTER TABLE public.completions 
ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organizations(id);

-- 1.3 Add org_id to shift_reports
ALTER TABLE public.shift_reports 
ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organizations(id);

-- 1.4 Create edge_function_logs table for structured logging
CREATE TABLE IF NOT EXISTS public.edge_function_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  function_name text NOT NULL,
  org_id uuid REFERENCES public.organizations(id),
  level text NOT NULL DEFAULT 'info',
  message text NOT NULL,
  payload jsonb,
  correlation_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on edge_function_logs
ALTER TABLE public.edge_function_logs ENABLE ROW LEVEL SECURITY;

-- Policy: org_admins can view logs for their org
CREATE POLICY "org_admins_view_logs" ON public.edge_function_logs
  FOR SELECT USING (
    org_id IS NULL OR 
    org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid())
  );

-- 1.5 Backfill org_id on task_instances from location
UPDATE public.task_instances ti
SET org_id = l.org_id
FROM public.locations l
WHERE ti.location_id = l.id AND ti.org_id IS NULL;

-- 1.6 Backfill org_id on completions from task_instances
UPDATE public.completions c
SET org_id = ti.org_id
FROM public.task_instances ti
WHERE c.task_instance_id = ti.id AND c.org_id IS NULL;

-- 1.7 Backfill org_id on shift_reports from location
UPDATE public.shift_reports sr
SET org_id = l.org_id
FROM public.locations l
WHERE sr.location_id = l.id AND sr.org_id IS NULL;

-- 1.8 Create trigger to auto-populate org_id on task_instances
CREATE OR REPLACE FUNCTION public.set_task_instance_org_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.org_id IS NULL AND NEW.location_id IS NOT NULL THEN
    SELECT org_id INTO NEW.org_id FROM public.locations WHERE id = NEW.location_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = 'public';

DROP TRIGGER IF EXISTS set_task_instance_org_id_trigger ON public.task_instances;
CREATE TRIGGER set_task_instance_org_id_trigger
  BEFORE INSERT ON public.task_instances
  FOR EACH ROW
  EXECUTE FUNCTION public.set_task_instance_org_id();

-- 1.9 Create trigger to auto-populate org_id on completions
CREATE OR REPLACE FUNCTION public.set_completion_org_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.org_id IS NULL AND NEW.task_instance_id IS NOT NULL THEN
    SELECT org_id INTO NEW.org_id FROM public.task_instances WHERE id = NEW.task_instance_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = 'public';

DROP TRIGGER IF EXISTS set_completion_org_id_trigger ON public.completions;
CREATE TRIGGER set_completion_org_id_trigger
  BEFORE INSERT ON public.completions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_completion_org_id();

-- Phase 2: Security Fixes

-- 2.1 Fix invalid timezone (Europe/Tirana -> Europe/Tirane)
UPDATE public.organizations 
SET timezone = 'Europe/Tirane' 
WHERE timezone = 'Europe/Tirana';

-- 2.2 Drop insecure profiles_safe view (it has no RLS)
DROP VIEW IF EXISTS public.profiles_safe;

-- 2.3 Create get_org_timezone helper function
CREATE OR REPLACE FUNCTION public.get_org_timezone(_org_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SET search_path = 'public'
AS $$
  SELECT COALESCE(timezone, 'UTC') FROM organizations WHERE id = _org_id;
$$;

-- 2.4 Add direct org_id RLS policies for task_instances
DROP POLICY IF EXISTS "Users can view task instances in their org" ON public.task_instances;
CREATE POLICY "Users can view task instances in their org" ON public.task_instances
  FOR SELECT USING (
    org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can update task instances in their org" ON public.task_instances;
CREATE POLICY "Users can update task instances in their org" ON public.task_instances
  FOR UPDATE USING (
    org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can insert task instances in their org" ON public.task_instances;
CREATE POLICY "Users can insert task instances in their org" ON public.task_instances
  FOR INSERT WITH CHECK (
    org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can delete task instances in their org" ON public.task_instances;
CREATE POLICY "Users can delete task instances in their org" ON public.task_instances
  FOR DELETE USING (
    org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid())
  );

-- 2.5 Add direct org_id RLS policies for completions
DROP POLICY IF EXISTS "Users can view completions in their org" ON public.completions;
CREATE POLICY "Users can view completions in their org" ON public.completions
  FOR SELECT USING (
    org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can insert completions in their org" ON public.completions;
CREATE POLICY "Users can insert completions in their org" ON public.completions
  FOR INSERT WITH CHECK (
    org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid())
  );

-- 2.6 Add direct org_id RLS policies for shift_reports
DROP POLICY IF EXISTS "Users can view shift reports in their org" ON public.shift_reports;
CREATE POLICY "Users can view shift reports in their org" ON public.shift_reports
  FOR SELECT USING (
    org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can insert shift reports in their org" ON public.shift_reports;
CREATE POLICY "Users can insert shift reports in their org" ON public.shift_reports
  FOR INSERT WITH CHECK (
    org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can update shift reports in their org" ON public.shift_reports;
CREATE POLICY "Users can update shift reports in their org" ON public.shift_reports
  FOR UPDATE USING (
    org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid())
  );

-- 2.7 Fix mutable search_path in existing functions
CREATE OR REPLACE FUNCTION public.update_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = 'public';

CREATE OR REPLACE FUNCTION public.prevent_schedule_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Direct mutation of schedules table is not allowed. Use task_routines instead.';
END;
$$ LANGUAGE plpgsql SET search_path = 'public';

CREATE OR REPLACE FUNCTION public.check_password_strength(password text)
RETURNS boolean AS $$
BEGIN
  RETURN length(password) >= 8;
END;
$$ LANGUAGE plpgsql SET search_path = 'public';

CREATE OR REPLACE FUNCTION public.calculate_urgency_score(
  due_at timestamptz,
  criticality text DEFAULT 'medium'
) RETURNS integer AS $$
DECLARE
  hours_until_due numeric;
  criticality_multiplier numeric;
  base_score integer;
BEGIN
  IF due_at IS NULL THEN
    RETURN 0;
  END IF;
  
  hours_until_due := EXTRACT(EPOCH FROM (due_at - now())) / 3600;
  
  CASE criticality
    WHEN 'critical' THEN criticality_multiplier := 2.0;
    WHEN 'high' THEN criticality_multiplier := 1.5;
    WHEN 'medium' THEN criticality_multiplier := 1.0;
    WHEN 'low' THEN criticality_multiplier := 0.5;
    ELSE criticality_multiplier := 1.0;
  END CASE;
  
  IF hours_until_due <= 0 THEN
    base_score := 100 + LEAST(ABS(hours_until_due)::integer * 5, 50);
  ELSIF hours_until_due <= 1 THEN
    base_score := 80;
  ELSIF hours_until_due <= 4 THEN
    base_score := 60;
  ELSIF hours_until_due <= 24 THEN
    base_score := 40;
  ELSE
    base_score := 20;
  END IF;
  
  RETURN LEAST((base_score * criticality_multiplier)::integer, 150);
END;
$$ LANGUAGE plpgsql STABLE SET search_path = 'public';

-- 2.8 Create index on org_id for better performance
CREATE INDEX IF NOT EXISTS idx_task_instances_org_id ON public.task_instances(org_id);
CREATE INDEX IF NOT EXISTS idx_completions_org_id ON public.completions(org_id);
CREATE INDEX IF NOT EXISTS idx_shift_reports_org_id ON public.shift_reports(org_id);
CREATE INDEX IF NOT EXISTS idx_edge_function_logs_org_id ON public.edge_function_logs(org_id);
CREATE INDEX IF NOT EXISTS idx_edge_function_logs_created_at ON public.edge_function_logs(created_at DESC);