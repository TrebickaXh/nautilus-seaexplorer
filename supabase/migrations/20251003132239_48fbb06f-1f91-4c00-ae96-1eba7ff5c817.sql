-- Phase 1A: Fix Role-Based Security Architecture (Fixed Order)

-- 1. Create user_roles junction table
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 2. Create security definer functions
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.get_user_primary_role(_user_id uuid)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = _user_id
  ORDER BY CASE role
    WHEN 'org_admin' THEN 1
    WHEN 'location_manager' THEN 2
    WHEN 'crew' THEN 3
  END
  LIMIT 1;
$$;

-- 3. Migrate existing role data
INSERT INTO public.user_roles (user_id, role)
SELECT id, role FROM public.profiles
WHERE role IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;

-- 4. Drop ALL policies that depend on profiles.role column
DROP POLICY IF EXISTS "Org admins can update their organization" ON public.organizations;
DROP POLICY IF EXISTS "Admins can manage locations" ON public.locations;
DROP POLICY IF EXISTS "Admins can manage templates" ON public.task_templates;
DROP POLICY IF EXISTS "Admins can manage schedules" ON public.schedules;
DROP POLICY IF EXISTS "Admins can view audit events for their org" ON public.audit_events;

-- 5. Now we can safely drop the role column
ALTER TABLE public.profiles DROP COLUMN IF EXISTS role;

-- 6. Recreate policies using has_role() function
CREATE POLICY "Org admins can update their organization"
  ON public.organizations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.org_id = organizations.id AND profiles.id = auth.uid()
    )
    AND public.has_role(auth.uid(), 'org_admin')
  );

CREATE POLICY "Admins can manage locations"
  ON public.locations FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.org_id = locations.org_id AND profiles.id = auth.uid()
    )
    AND (public.has_role(auth.uid(), 'org_admin') OR public.has_role(auth.uid(), 'location_manager'))
  );

CREATE POLICY "Admins can manage templates"
  ON public.task_templates FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.org_id = task_templates.org_id AND profiles.id = auth.uid()
    )
    AND (public.has_role(auth.uid(), 'org_admin') OR public.has_role(auth.uid(), 'location_manager'))
  );

CREATE POLICY "Admins can manage schedules"
  ON public.schedules FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.task_templates
      JOIN public.profiles ON profiles.org_id = task_templates.org_id
      WHERE task_templates.id = schedules.template_id AND profiles.id = auth.uid()
    )
    AND (public.has_role(auth.uid(), 'org_admin') OR public.has_role(auth.uid(), 'location_manager'))
  );

CREATE POLICY "Admins can view audit events for their org"
  ON public.audit_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.org_id = audit_events.org_id AND profiles.id = auth.uid()
    )
    AND (public.has_role(auth.uid(), 'org_admin') OR public.has_role(auth.uid(), 'location_manager'))
  );

-- 7. Add RLS policies for user_roles table
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage roles in their org"
  ON public.user_roles FOR ALL
  USING (
    public.has_role(auth.uid(), 'org_admin')
    AND EXISTS (
      SELECT 1 FROM public.profiles p1
      JOIN public.profiles p2 ON p1.org_id = p2.org_id
      WHERE p1.id = auth.uid() AND p2.id = user_roles.user_id
    )
  );

-- 8. Update handle_new_user trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _org_id uuid;
  _role app_role;
BEGIN
  _org_id := (new.raw_user_meta_data->>'org_id')::uuid;
  _role := COALESCE((new.raw_user_meta_data->>'role')::app_role, 'crew');
  
  INSERT INTO public.profiles (id, org_id, display_name)
  VALUES (
    new.id,
    _org_id,
    COALESCE(new.raw_user_meta_data->>'display_name', new.email)
  );
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, _role);
  
  RETURN new;
END;
$$;

-- 9. Task engine database functions
CREATE OR REPLACE FUNCTION public.calculate_urgency_score(
  _due_at timestamptz,
  _window_start timestamptz,
  _window_end timestamptz,
  _criticality integer,
  _now timestamptz DEFAULT now()
)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  time_decay numeric := 0;
  criticality_score numeric := 0;
  overdue_flag numeric := 0;
  shift_proximity numeric := 0;
  minutes_until_due numeric;
  minutes_until_window_end numeric;
BEGIN
  minutes_until_due := EXTRACT(EPOCH FROM (_due_at - _now)) / 60.0;
  
  IF minutes_until_due <= 0 THEN
    time_decay := 1.0;
  ELSIF minutes_until_due <= 60 THEN
    time_decay := 1.0 / (1.0 + exp(0.1 * (minutes_until_due - 30)));
  ELSE
    time_decay := 1.0 / (1.0 + exp(0.02 * (minutes_until_due - 180)));
  END IF;
  
  criticality_score := _criticality * 0.2;
  
  IF minutes_until_due < 0 THEN
    overdue_flag := 1.0;
  END IF;
  
  IF _window_end IS NOT NULL THEN
    minutes_until_window_end := EXTRACT(EPOCH FROM (_window_end - _now)) / 60.0;
    IF minutes_until_window_end > 0 AND minutes_until_window_end <= 30 THEN
      shift_proximity := 0.3;
    END IF;
  END IF;
  
  RETURN (0.4 * time_decay) + (0.3 * criticality_score) + (0.2 * overdue_flag) + (0.1 * shift_proximity);
END;
$$;

CREATE OR REPLACE FUNCTION public.update_task_urgency()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.task_instances ti
  SET urgency_score = public.calculate_urgency_score(
    ti.due_at,
    ti.window_start,
    ti.window_end,
    (SELECT tt.criticality FROM public.task_templates tt WHERE tt.id = ti.template_id),
    now()
  )
  WHERE ti.status = 'pending'
    AND ti.due_at > now() - interval '1 hour'
    AND ti.due_at < now() + interval '24 hours';
END;
$$;