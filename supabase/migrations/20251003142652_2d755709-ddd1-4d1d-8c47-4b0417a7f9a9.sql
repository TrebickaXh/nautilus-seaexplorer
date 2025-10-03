-- Add INSERT policy for org_admins to create profiles for users in their org
CREATE POLICY "Org admins can create profiles for users in their org"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'org_admin'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.profiles admin_profile
    WHERE admin_profile.id = auth.uid()
    AND admin_profile.org_id = profiles.org_id
  )
);