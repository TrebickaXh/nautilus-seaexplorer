-- Update handle_new_user to accept department_id and create user_departments record
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _org_id uuid;
  _role app_role;
  _org_name text;
  _department_id uuid;
BEGIN
  -- Check if org_id was provided in metadata
  _org_id := (new.raw_user_meta_data->>'org_id')::uuid;
  _department_id := (new.raw_user_meta_data->>'department_id')::uuid;
  
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
    employee_id
  )
  VALUES (
    new.id,
    _org_id,
    COALESCE(new.raw_user_meta_data->>'display_name', new.email),
    new.email,
    new.raw_user_meta_data->>'phone',
    new.raw_user_meta_data->>'employee_id'
  );
  
  -- Assign role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, _role);
  
  -- Assign department if provided
  IF _department_id IS NOT NULL THEN
    INSERT INTO public.user_departments (user_id, department_id, is_primary)
    VALUES (new.id, _department_id, true);
  END IF;
  
  RETURN new;
END;
$function$;