-- Extend profiles table with comprehensive user attributes
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS profile_photo_url TEXT,
  ADD COLUMN IF NOT EXISTS language_preference TEXT DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'UTC',
  ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{"email": true, "push": true, "sms": false}'::jsonb,
  ADD COLUMN IF NOT EXISTS last_login TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  ADD COLUMN IF NOT EXISTS department TEXT,
  ADD COLUMN IF NOT EXISTS employee_id TEXT,
  ADD COLUMN IF NOT EXISTS shift_type TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- Add unique constraint on employee_id within organization
CREATE UNIQUE INDEX IF NOT EXISTS profiles_org_employee_id_key 
  ON public.profiles(org_id, employee_id) 
  WHERE employee_id IS NOT NULL;

-- Create trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profiles_updated_at_trigger ON public.profiles;
CREATE TRIGGER profiles_updated_at_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_profiles_updated_at();

-- Update handle_new_user function to sync email from auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  _org_id uuid;
  _role app_role;
  _org_name text;
BEGIN
  -- Check if org_id was provided in metadata
  _org_id := (new.raw_user_meta_data->>'org_id')::uuid;
  
  -- If no org_id provided, create a new organization
  IF _org_id IS NULL THEN
    -- Generate org name from email or display name
    _org_name := COALESCE(
      new.raw_user_meta_data->>'display_name',
      split_part(new.email, '@', 1)
    ) || '''s Organization';
    
    -- Create new organization
    INSERT INTO public.organizations (name)
    VALUES (_org_name)
    RETURNING id INTO _org_id;
    
    -- First user of a new org becomes org_admin
    _role := 'org_admin';
  ELSE
    -- If org_id was provided, use the role from metadata (or default to crew)
    _role := COALESCE((new.raw_user_meta_data->>'role')::app_role, 'crew');
  END IF;
  
  -- Create profile with email synced from auth.users
  INSERT INTO public.profiles (
    id, 
    org_id, 
    display_name,
    email,
    phone,
    department,
    employee_id
  )
  VALUES (
    new.id,
    _org_id,
    COALESCE(new.raw_user_meta_data->>'display_name', new.email),
    new.email,
    new.raw_user_meta_data->>'phone',
    new.raw_user_meta_data->>'department',
    new.raw_user_meta_data->>'employee_id'
  );
  
  -- Assign role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, _role);
  
  RETURN new;
END;
$$;

-- Function to update last_login timestamp
CREATE OR REPLACE FUNCTION public.update_user_last_login(user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  UPDATE public.profiles
  SET last_login = now()
  WHERE id = user_id;
END;
$$;