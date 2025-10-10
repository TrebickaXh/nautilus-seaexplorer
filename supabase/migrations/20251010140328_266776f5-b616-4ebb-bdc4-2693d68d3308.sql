-- Create a secure view that excludes sensitive authentication columns
CREATE OR REPLACE VIEW public.profiles_safe AS
SELECT 
  id,
  org_id,
  display_name,
  email,
  phone,
  employee_id,
  department,
  shift_type,
  active,
  profile_photo_url,
  timezone,
  language_preference,
  notification_preferences,
  notes,
  nfc_uid,
  last_login,
  created_at,
  updated_at
FROM public.profiles;

-- Enable RLS on the view
ALTER VIEW public.profiles_safe SET (security_invoker = true);

-- Grant SELECT to authenticated users
GRANT SELECT ON public.profiles_safe TO authenticated;

-- Add comment explaining the security purpose
COMMENT ON VIEW public.profiles_safe IS 'Secure view of profiles table that excludes sensitive authentication columns (pin_hash, pin_attempts, pin_locked_until) to prevent offline brute-force attacks on employee PINs.';

-- Create RLS policies for the view (views inherit table policies, but we make it explicit)
-- Note: RLS policies from the underlying profiles table still apply through security_invoker

-- Users can view their own profile data
CREATE POLICY "Users can view their own profile via safe view"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Org admins can view profiles in their org (but will use profiles_safe to exclude pin_hash)
-- The existing policy already handles this, but we document the intended usage pattern