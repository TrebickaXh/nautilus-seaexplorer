-- Allow admins to create one-off task instances
CREATE POLICY "Admins can create task instances"
ON public.task_instances
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM locations
    JOIN profiles ON profiles.org_id = locations.org_id
    WHERE locations.id = task_instances.location_id
      AND profiles.id = auth.uid()
  )
  AND (has_role(auth.uid(), 'org_admin') OR has_role(auth.uid(), 'location_manager'))
);