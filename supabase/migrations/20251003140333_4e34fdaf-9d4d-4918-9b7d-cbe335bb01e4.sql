-- Fix Employee Personal Information security issue
-- Make profiles table policy more restrictive and explicit

-- Drop the current policy
DROP POLICY IF EXISTS "Users can view profiles in their org" ON public.profiles;

-- Create a more restrictive policy that explicitly:
-- 1. Only applies to authenticated users
-- 2. Prevents access from unauthenticated users
-- 3. Enforces organization boundaries
CREATE POLICY "Users can view profiles in their org"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  -- User can view their own profile
  auth.uid() = id
  OR
  -- Org admins can view profiles within their organization only
  (
    has_role(auth.uid(), 'org_admin'::app_role)
    AND EXISTS (
      SELECT 1
      FROM public.profiles AS viewer
      WHERE viewer.id = auth.uid()
        AND viewer.org_id = profiles.org_id
    )
  )
);