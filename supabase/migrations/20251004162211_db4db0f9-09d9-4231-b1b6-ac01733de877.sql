-- Step 1: Make department_id nullable in tables that reference departments
-- This allows us to preserve existing data during the transition
ALTER TABLE public.task_templates ALTER COLUMN department_id DROP NOT NULL;
ALTER TABLE public.shifts ALTER COLUMN department_id DROP NOT NULL;

-- Step 2: Add description and archived_at columns to areas table
ALTER TABLE public.areas
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE;

-- Step 3: Remove area_id from task_instances (now redundant)
ALTER TABLE public.task_instances
DROP COLUMN IF EXISTS area_id;

-- Step 4: Drop foreign key constraints from old departments references
ALTER TABLE public.shifts DROP CONSTRAINT IF EXISTS shifts_department_id_fkey;
ALTER TABLE public.task_templates DROP CONSTRAINT IF EXISTS task_templates_department_id_fkey;
ALTER TABLE public.schedules DROP CONSTRAINT IF EXISTS schedules_department_id_fkey;
ALTER TABLE public.task_instances DROP CONSTRAINT IF EXISTS task_instances_department_id_fkey;
ALTER TABLE public.user_departments DROP CONSTRAINT IF EXISTS user_departments_department_id_fkey;

-- Step 5: Set all department_id references to NULL (orphan the old references)
UPDATE public.task_templates SET department_id = NULL;
UPDATE public.shifts SET department_id = NULL WHERE department_id IS NOT NULL;
UPDATE public.schedules SET department_id = NULL WHERE department_id IS NOT NULL;
UPDATE public.task_instances SET department_id = NULL WHERE department_id IS NOT NULL;
DELETE FROM public.user_departments WHERE department_id IS NOT NULL;

-- Step 6: Drop the old organization-wide departments table
DROP TABLE IF EXISTS public.departments CASCADE;

-- Step 7: Rename areas table to departments (now location-specific)
ALTER TABLE public.areas RENAME TO departments;

-- Step 8: Add foreign key constraints to new departments table
ALTER TABLE public.shifts
ADD CONSTRAINT shifts_department_id_fkey
FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE CASCADE;

ALTER TABLE public.task_templates
ADD CONSTRAINT task_templates_department_id_fkey
FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE CASCADE;

ALTER TABLE public.schedules
ADD CONSTRAINT schedules_department_id_fkey
FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;

ALTER TABLE public.task_instances
ADD CONSTRAINT task_instances_department_id_fkey
FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;

ALTER TABLE public.user_departments
ADD CONSTRAINT user_departments_department_id_fkey
FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE CASCADE;

-- Step 9: Update RLS policies for departments (now location-specific)
DROP POLICY IF EXISTS "Users can view areas in their org locations" ON public.departments;
DROP POLICY IF EXISTS "Admins can insert areas in their org locations" ON public.departments;
DROP POLICY IF EXISTS "Admins can update areas in their org locations" ON public.departments;
DROP POLICY IF EXISTS "Admins can delete areas in their org locations" ON public.departments;

CREATE POLICY "Users can view departments in their org locations"
ON public.departments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM locations
    JOIN profiles ON profiles.org_id = locations.org_id
    WHERE locations.id = departments.location_id
    AND profiles.id = auth.uid()
  )
);

CREATE POLICY "Admins can insert departments in their org locations"
ON public.departments
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM locations
    JOIN profiles ON profiles.org_id = locations.org_id
    WHERE locations.id = departments.location_id
    AND profiles.id = auth.uid()
  )
  AND (
    has_role(auth.uid(), 'org_admin'::app_role)
    OR has_role(auth.uid(), 'location_manager'::app_role)
  )
);

CREATE POLICY "Admins can update departments in their org locations"
ON public.departments
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM locations
    JOIN profiles ON profiles.org_id = locations.org_id
    WHERE locations.id = departments.location_id
    AND profiles.id = auth.uid()
  )
  AND (
    has_role(auth.uid(), 'org_admin'::app_role)
    OR has_role(auth.uid(), 'location_manager'::app_role)
  )
);

CREATE POLICY "Admins can delete departments in their org locations"
ON public.departments
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM locations
    JOIN profiles ON profiles.org_id = locations.org_id
    WHERE locations.id = departments.location_id
    AND profiles.id = auth.uid()
  )
  AND (
    has_role(auth.uid(), 'org_admin'::app_role)
    OR has_role(auth.uid(), 'location_manager'::app_role)
  )
);

-- Step 10: Update RLS policies for shifts (now reference location-specific departments)
DROP POLICY IF EXISTS "Users can view shifts in their org departments" ON public.shifts;
DROP POLICY IF EXISTS "Admins can manage shifts" ON public.shifts;

CREATE POLICY "Users can view shifts in their org departments"
ON public.shifts
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM departments
    JOIN locations ON locations.id = departments.location_id
    JOIN profiles ON profiles.org_id = locations.org_id
    WHERE departments.id = shifts.department_id
    AND profiles.id = auth.uid()
  )
);

CREATE POLICY "Admins can manage shifts"
ON public.shifts
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM departments
    JOIN locations ON locations.id = departments.location_id
    JOIN profiles ON profiles.org_id = locations.org_id
    WHERE departments.id = shifts.department_id
    AND profiles.id = auth.uid()
  )
  AND (
    has_role(auth.uid(), 'org_admin'::app_role)
    OR has_role(auth.uid(), 'location_manager'::app_role)
  )
);

-- Step 11: Update RLS policies for user_departments
DROP POLICY IF EXISTS "Users can view their own department assignments" ON public.user_departments;
DROP POLICY IF EXISTS "Admins can view department assignments in their org" ON public.user_departments;
DROP POLICY IF EXISTS "Admins can manage department assignments" ON public.user_departments;

CREATE POLICY "Users can view their own department assignments"
ON public.user_departments
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view department assignments in their org"
ON public.user_departments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM departments
    JOIN locations ON locations.id = departments.location_id
    JOIN profiles ON profiles.org_id = locations.org_id
    WHERE departments.id = user_departments.department_id
    AND profiles.id = auth.uid()
  )
  AND (
    has_role(auth.uid(), 'org_admin'::app_role)
    OR has_role(auth.uid(), 'location_manager'::app_role)
  )
);

CREATE POLICY "Admins can manage department assignments"
ON public.user_departments
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM departments
    JOIN locations ON locations.id = departments.location_id
    JOIN profiles ON profiles.org_id = locations.org_id
    WHERE departments.id = user_departments.department_id
    AND profiles.id = auth.uid()
  )
  AND (
    has_role(auth.uid(), 'org_admin'::app_role)
    OR has_role(auth.uid(), 'location_manager'::app_role)
  )
);