-- Fix Employee Authentication Credentials security issue
-- Update RLS policies on profiles table to allow org admins to view profiles in their org
-- while preventing cross-organization visibility

-- Drop existing SELECT policy
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

-- Create new SELECT policy that allows:
-- 1. Users to view their own profile
-- 2. Org admins to view profiles within their organization
CREATE POLICY "Users can view profiles in their org"
ON public.profiles
FOR SELECT
USING (
  -- User can view their own profile
  auth.uid() = id
  OR
  -- Org admins can view profiles in their organization
  (
    has_role(auth.uid(), 'org_admin'::app_role)
    AND EXISTS (
      SELECT 1
      FROM public.profiles AS p
      WHERE p.id = auth.uid()
        AND p.org_id = profiles.org_id
    )
  )
);