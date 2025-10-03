-- Create departments table
CREATE TABLE public.departments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  archived_at TIMESTAMP WITH TIME ZONE
);

-- Create shifts table
CREATE TABLE public.shifts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  days_of_week INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  archived_at TIMESTAMP WITH TIME ZONE
);

-- Create user_departments junction table
CREATE TABLE public.user_departments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, department_id)
);

-- Create user_shifts junction table
CREATE TABLE public.user_shifts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  shift_id UUID NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, shift_id)
);

-- Add department_id to task_templates
ALTER TABLE public.task_templates
ADD COLUMN department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL;

-- Add department_id and shift_id to schedules
ALTER TABLE public.schedules
ADD COLUMN department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
ADD COLUMN shift_id UUID REFERENCES public.shifts(id) ON DELETE SET NULL;

-- Add department_id and shift_id to task_instances
ALTER TABLE public.task_instances
ADD COLUMN department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
ADD COLUMN shift_id UUID REFERENCES public.shifts(id) ON DELETE SET NULL;

-- Enable RLS on new tables
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_shifts ENABLE ROW LEVEL SECURITY;

-- RLS policies for departments
CREATE POLICY "Users can view departments in their org"
ON public.departments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.org_id = departments.org_id
      AND profiles.id = auth.uid()
  )
);

CREATE POLICY "Admins can manage departments"
ON public.departments
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.org_id = departments.org_id
      AND profiles.id = auth.uid()
  )
  AND (has_role(auth.uid(), 'org_admin') OR has_role(auth.uid(), 'location_manager'))
);

-- RLS policies for shifts
CREATE POLICY "Users can view shifts in their org departments"
ON public.shifts
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM departments
    JOIN profiles ON profiles.org_id = departments.org_id
    WHERE departments.id = shifts.department_id
      AND profiles.id = auth.uid()
  )
);

CREATE POLICY "Admins can manage shifts"
ON public.shifts
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM departments
    JOIN profiles ON profiles.org_id = departments.org_id
    WHERE departments.id = shifts.department_id
      AND profiles.id = auth.uid()
  )
  AND (has_role(auth.uid(), 'org_admin') OR has_role(auth.uid(), 'location_manager'))
);

-- RLS policies for user_departments
CREATE POLICY "Users can view their own department assignments"
ON public.user_departments
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view department assignments in their org"
ON public.user_departments
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM departments
    JOIN profiles ON profiles.org_id = departments.org_id
    WHERE departments.id = user_departments.department_id
      AND profiles.id = auth.uid()
  )
  AND (has_role(auth.uid(), 'org_admin') OR has_role(auth.uid(), 'location_manager'))
);

CREATE POLICY "Admins can manage department assignments"
ON public.user_departments
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM departments
    JOIN profiles ON profiles.org_id = departments.org_id
    WHERE departments.id = user_departments.department_id
      AND profiles.id = auth.uid()
  )
  AND (has_role(auth.uid(), 'org_admin') OR has_role(auth.uid(), 'location_manager'))
);

-- RLS policies for user_shifts
CREATE POLICY "Users can view their own shift assignments"
ON public.user_shifts
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view shift assignments in their org"
ON public.user_shifts
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM shifts
    JOIN departments ON departments.id = shifts.department_id
    JOIN profiles ON profiles.org_id = departments.org_id
    WHERE shifts.id = user_shifts.shift_id
      AND profiles.id = auth.uid()
  )
  AND (has_role(auth.uid(), 'org_admin') OR has_role(auth.uid(), 'location_manager'))
);

CREATE POLICY "Admins can manage shift assignments"
ON public.user_shifts
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM shifts
    JOIN departments ON departments.id = shifts.department_id
    JOIN profiles ON profiles.org_id = departments.org_id
    WHERE shifts.id = user_shifts.shift_id
      AND profiles.id = auth.uid()
  )
  AND (has_role(auth.uid(), 'org_admin') OR has_role(auth.uid(), 'location_manager'))
);