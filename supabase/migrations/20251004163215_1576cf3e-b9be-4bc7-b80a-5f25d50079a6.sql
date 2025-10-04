-- Add location_id to shifts table
ALTER TABLE public.shifts 
ADD COLUMN location_id uuid REFERENCES public.locations(id) ON DELETE CASCADE;

-- Update existing shifts to set location_id based on their department's location
UPDATE public.shifts 
SET location_id = departments.location_id
FROM public.departments
WHERE shifts.department_id = departments.id;

-- Make location_id required for new shifts
ALTER TABLE public.shifts 
ALTER COLUMN location_id SET NOT NULL;

-- Update RLS policies for shifts to use location_id
DROP POLICY IF EXISTS "Users can view shifts in their org departments" ON public.shifts;
DROP POLICY IF EXISTS "Admins can manage shifts" ON public.shifts;

CREATE POLICY "Users can view shifts in their org locations"
ON public.shifts
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM locations
    JOIN profiles ON profiles.org_id = locations.org_id
    WHERE locations.id = shifts.location_id
    AND profiles.id = auth.uid()
  )
);

CREATE POLICY "Admins can manage shifts in their org locations"
ON public.shifts
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM locations
    JOIN profiles ON profiles.org_id = locations.org_id
    WHERE locations.id = shifts.location_id
    AND profiles.id = auth.uid()
  )
  AND (has_role(auth.uid(), 'org_admin') OR has_role(auth.uid(), 'location_manager'))
);