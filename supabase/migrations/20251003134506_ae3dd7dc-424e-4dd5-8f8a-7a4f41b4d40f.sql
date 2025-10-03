-- Fix handle_new_user() trigger to auto-create organizations for new signups
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
  
  -- Create profile
  INSERT INTO public.profiles (id, org_id, display_name)
  VALUES (
    new.id,
    _org_id,
    COALESCE(new.raw_user_meta_data->>'display_name', new.email)
  );
  
  -- Assign role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, _role);
  
  RETURN new;
END;
$$;