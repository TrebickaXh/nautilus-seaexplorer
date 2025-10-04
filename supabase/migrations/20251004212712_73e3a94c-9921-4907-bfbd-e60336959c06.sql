-- =====================================================
-- TASK PIPELINE REFACTOR: Templates → Routines (Fixed)
-- =====================================================

-- 1. Create enum for recurrence types
DO $$ BEGIN
  CREATE TYPE recurrence_type AS ENUM ('daily', 'weekly', 'monthly', 'custom_weeks');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Create enum for task creation source
DO $$ BEGIN
  CREATE TYPE task_creation_source AS ENUM ('routine', 'oneoff');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 3. Create enum for task outcomes
DO $$ BEGIN
  CREATE TYPE task_outcome AS ENUM ('completed', 'skipped', 'deferred', 'reassigned', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 4. Add areas table (if not exists)
CREATE TABLE IF NOT EXISTS public.areas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  archived_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.areas ENABLE ROW LEVEL SECURITY;

-- RLS for areas
DO $$ BEGIN
  CREATE POLICY "Users can view areas in their org locations"
  ON public.areas FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM locations
      JOIN profiles ON profiles.org_id = locations.org_id
      WHERE locations.id = areas.location_id
      AND profiles.id = auth.uid()
    )
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE POLICY "Admins can manage areas in their org locations"
  ON public.areas FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM locations
      JOIN profiles ON profiles.org_id = locations.org_id
      WHERE locations.id = areas.location_id
      AND profiles.id = auth.uid()
    )
    AND (has_role(auth.uid(), 'org_admin'::app_role) OR has_role(auth.uid(), 'location_manager'::app_role))
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 5. Rename task_templates to task_routines (if not already renamed)
DO $$ BEGIN
  ALTER TABLE public.task_templates RENAME TO task_routines;
EXCEPTION
  WHEN undefined_table THEN null;
  WHEN duplicate_table THEN null;
END $$;

-- 6. Add new fields to task_routines
ALTER TABLE public.task_routines 
  ADD COLUMN IF NOT EXISTS shift_id UUID REFERENCES public.shifts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES public.locations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS area_ids UUID[] DEFAULT ARRAY[]::UUID[],
  ADD COLUMN IF NOT EXISTS recurrence JSONB DEFAULT '{"type": "daily", "time_of_day": "09:00"}'::jsonb,
  ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;

-- 7. Update task_instances for new structure
ALTER TABLE public.task_instances
  ADD COLUMN IF NOT EXISTS routine_id UUID REFERENCES public.task_routines(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS area_id UUID REFERENCES public.areas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_from task_creation_source DEFAULT 'routine',
  ADD COLUMN IF NOT EXISTS denormalized_data JSONB DEFAULT '{}'::jsonb;

-- Migrate existing template_id to routine_id
UPDATE public.task_instances 
SET routine_id = template_id 
WHERE routine_id IS NULL AND template_id IS NOT NULL;

-- 8. Update completions table for outcomes
ALTER TABLE public.completions
  ADD COLUMN IF NOT EXISTS outcome task_outcome DEFAULT 'completed',
  ADD COLUMN IF NOT EXISTS outcome_reason TEXT,
  ADD COLUMN IF NOT EXISTS defer_settings JSONB;

-- 9. Create shift_reports table
CREATE TABLE IF NOT EXISTS public.shift_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shift_id UUID NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  report_date DATE NOT NULL,
  shift_start TIMESTAMP WITH TIME ZONE NOT NULL,
  shift_end TIMESTAMP WITH TIME ZONE NOT NULL,
  total_tasks INTEGER DEFAULT 0,
  completed_tasks INTEGER DEFAULT 0,
  skipped_tasks INTEGER DEFAULT 0,
  deferred_tasks INTEGER DEFAULT 0,
  overdue_tasks INTEGER DEFAULT 0,
  by_user JSONB DEFAULT '[]'::jsonb,
  by_area JSONB DEFAULT '[]'::jsonb,
  kpis JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(shift_id, department_id, report_date)
);

ALTER TABLE public.shift_reports ENABLE ROW LEVEL SECURITY;

-- RLS for shift_reports
DO $$ BEGIN
  CREATE POLICY "Users can view shift reports for their org"
  ON public.shift_reports FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM locations
      JOIN profiles ON profiles.org_id = locations.org_id
      WHERE locations.id = shift_reports.location_id
      AND profiles.id = auth.uid()
    )
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE POLICY "Admins can manage shift reports for their org"
  ON public.shift_reports FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM locations
      JOIN profiles ON profiles.org_id = locations.org_id
      WHERE locations.id = shift_reports.location_id
      AND profiles.id = auth.uid()
    )
    AND (has_role(auth.uid(), 'org_admin'::app_role) OR has_role(auth.uid(), 'location_manager'::app_role))
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 10. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_task_instances_routine_area_due 
  ON public.task_instances(routine_id, area_id, due_at);

CREATE INDEX IF NOT EXISTS idx_task_instances_department_shift_area_due 
  ON public.task_instances(department_id, shift_id, area_id, due_at);

CREATE INDEX IF NOT EXISTS idx_task_instances_created_from 
  ON public.task_instances(created_from);

CREATE INDEX IF NOT EXISTS idx_shift_reports_shift_date 
  ON public.shift_reports(shift_id, report_date);

CREATE INDEX IF NOT EXISTS idx_areas_location 
  ON public.areas(location_id);

-- 11. Update schedules table reference (if column exists)
DO $$ BEGIN
  ALTER TABLE public.schedules 
    RENAME COLUMN template_id TO routine_id;
EXCEPTION
  WHEN undefined_column THEN null;
END $$;

-- 12. Populate denormalized data for existing instances
UPDATE public.task_instances ti
SET denormalized_data = jsonb_build_object(
  'title', tr.title,
  'steps', tr.steps,
  'est_minutes', tr.est_minutes,
  'criticality', tr.criticality,
  'required_proof', tr.required_proof
)
FROM public.task_routines tr
WHERE ti.routine_id = tr.id AND ti.denormalized_data = '{}'::jsonb;