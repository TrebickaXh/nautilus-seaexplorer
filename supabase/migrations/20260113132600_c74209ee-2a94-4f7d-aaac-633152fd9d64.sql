-- Fix remaining functions with mutable search_path

-- Fix get_user_org_id
CREATE OR REPLACE FUNCTION public.get_user_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT org_id FROM profiles WHERE id = auth.uid();
$$;

-- Fix get_user_primary_role
CREATE OR REPLACE FUNCTION public.get_user_primary_role()
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT role FROM user_roles WHERE user_id = auth.uid() LIMIT 1;
$$;

-- Fix handle_new_user (trigger function for auth.users)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'display_name', new.email)
  );
  RETURN new;
END;
$$;

-- Fix trg_check_shift_department
CREATE OR REPLACE FUNCTION public.trg_check_shift_department()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF NEW.department_id IS NOT NULL AND NEW.location_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM departments d 
      WHERE d.id = NEW.department_id 
      AND d.location_id = NEW.location_id
    ) THEN
      RAISE EXCEPTION 'Department does not belong to the specified location';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Fix update_task_urgency
CREATE OR REPLACE FUNCTION public.update_task_urgency()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  UPDATE task_instances
  SET urgency_score = calculate_urgency_score(
    due_at,
    COALESCE((denormalized_data->>'criticality')::text, 'medium')
  )
  WHERE status = 'pending';
END;
$$;

-- Fix update_user_last_login
CREATE OR REPLACE FUNCTION public.update_user_last_login()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  UPDATE profiles SET last_login = now() WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

-- Fix validate_pin_format
CREATE OR REPLACE FUNCTION public.validate_pin_format()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
BEGIN
  IF NEW.pin_hash IS NOT NULL AND length(NEW.pin_hash) < 10 THEN
    RAISE EXCEPTION 'Invalid PIN hash format';
  END IF;
  RETURN NEW;
END;
$$;