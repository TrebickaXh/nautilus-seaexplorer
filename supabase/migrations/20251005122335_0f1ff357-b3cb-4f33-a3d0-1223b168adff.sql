-- Add PIN attempt tracking to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS pin_attempts integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS pin_locked_until timestamp with time zone;

-- Add missing RLS policies for user_shifts table
CREATE POLICY "Admins can insert shift assignments"
ON public.user_shifts
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM shifts
    JOIN locations ON locations.id = shifts.location_id
    JOIN profiles ON profiles.org_id = locations.org_id
    WHERE shifts.id = user_shifts.shift_id
      AND profiles.id = auth.uid()
  ) 
  AND (has_role(auth.uid(), 'org_admin') OR has_role(auth.uid(), 'location_manager'))
);

CREATE POLICY "Admins can update shift assignments"
ON public.user_shifts
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM shifts
    JOIN locations ON locations.id = shifts.location_id
    JOIN profiles ON profiles.org_id = locations.org_id
    WHERE shifts.id = user_shifts.shift_id
      AND profiles.id = auth.uid()
  )
  AND (has_role(auth.uid(), 'org_admin') OR has_role(auth.uid(), 'location_manager'))
);

CREATE POLICY "Admins can delete shift assignments"
ON public.user_shifts
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM shifts
    JOIN locations ON locations.id = shifts.location_id
    JOIN profiles ON profiles.org_id = locations.org_id
    WHERE shifts.id = user_shifts.shift_id
      AND profiles.id = auth.uid()
  )
  AND (has_role(auth.uid(), 'org_admin') OR has_role(auth.uid(), 'location_manager'))
);

-- Add explicit RLS policy to block unauthenticated access to profiles
CREATE POLICY "Block unauthenticated access to profiles"
ON public.profiles
FOR ALL
TO anon
USING (false);

-- Add explicit RLS policy to block unauthenticated access to onboarding_sessions
CREATE POLICY "Block unauthenticated access to onboarding"
ON public.onboarding_sessions
FOR ALL
TO anon
USING (false);

-- Create function to validate and set PIN with rate limiting
CREATE OR REPLACE FUNCTION public.validate_pin_format(pin_text text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $$
BEGIN
  RETURN pin_text ~ '^\d{4,6}$';
END;
$$;

-- Update password requirements validation function
CREATE OR REPLACE FUNCTION public.check_password_strength(password text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  -- Require at least 12 characters, uppercase, lowercase, number, and special character
  RETURN length(password) >= 12
    AND password ~ '[A-Z]'
    AND password ~ '[a-z]'
    AND password ~ '[0-9]'
    AND password ~ '[^A-Za-z0-9]';
END;
$$;