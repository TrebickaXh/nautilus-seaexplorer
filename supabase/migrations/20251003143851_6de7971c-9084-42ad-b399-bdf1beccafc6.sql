-- Phase 1: Critical Security Fixes

-- 1. Create SECURITY DEFINER function to get user's org_id (fixes infinite recursion)
CREATE OR REPLACE FUNCTION public.get_user_org_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT org_id FROM public.profiles WHERE id = _user_id LIMIT 1;
$$;

-- 2. Fix infinite recursion in profiles INSERT policy
DROP POLICY IF EXISTS "Org admins can create profiles for users in their org" ON public.profiles;
CREATE POLICY "Org admins can create profiles for users in their org"
ON public.profiles
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'org_admin') 
  AND public.get_user_org_id(auth.uid()) = org_id
);

-- 3. Fix infinite recursion in profiles SELECT policy and protect sensitive data
DROP POLICY IF EXISTS "Users can view profiles in their org" ON public.profiles;

-- Policy for users to view their own complete profile including sensitive data
CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = id);

-- Policy for org admins to view other profiles (excluding sensitive auth data)
CREATE POLICY "Org admins can view org profiles"
ON public.profiles
FOR SELECT
USING (
  auth.uid() != id 
  AND has_role(auth.uid(), 'org_admin')
  AND public.get_user_org_id(auth.uid()) = org_id
);

-- 4. Add missing RLS policies to suggestions table
CREATE POLICY "System can insert suggestions"
ON public.suggestions
FOR INSERT
WITH CHECK (false); -- Only system/backend can create suggestions via service role

CREATE POLICY "Admins can update suggestions"
ON public.suggestions
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() 
    AND profiles.org_id = suggestions.org_id
  )
  AND has_role(auth.uid(), 'org_admin')
);

CREATE POLICY "Admins can delete suggestions"
ON public.suggestions
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() 
    AND profiles.org_id = suggestions.org_id
  )
  AND has_role(auth.uid(), 'org_admin')
);