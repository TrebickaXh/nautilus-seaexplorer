-- Allow org admins and managers to view all shift assignments in their org
CREATE POLICY "Admins can view all shift assignments in their org"
ON public.user_shifts
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM shifts s
    JOIN locations l ON l.id = s.location_id
    JOIN profiles p ON p.org_id = l.org_id
    WHERE s.id = user_shifts.shift_id
    AND p.id = auth.uid()
    AND (has_role(auth.uid(), 'org_admin'::app_role) OR has_role(auth.uid(), 'location_manager'::app_role))
  )
);