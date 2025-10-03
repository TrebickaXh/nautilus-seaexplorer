-- Phase 1: Add Missing RLS Policies for areas table
-- Allow org admins and location managers to manage areas in their org's locations

CREATE POLICY "Admins can insert areas in their org locations"
ON public.areas
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.locations
    JOIN public.profiles ON profiles.org_id = locations.org_id
    WHERE locations.id = areas.location_id
      AND profiles.id = auth.uid()
  )
  AND (
    has_role(auth.uid(), 'org_admin'::app_role)
    OR has_role(auth.uid(), 'location_manager'::app_role)
  )
);

CREATE POLICY "Admins can update areas in their org locations"
ON public.areas
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.locations
    JOIN public.profiles ON profiles.org_id = locations.org_id
    WHERE locations.id = areas.location_id
      AND profiles.id = auth.uid()
  )
  AND (
    has_role(auth.uid(), 'org_admin'::app_role)
    OR has_role(auth.uid(), 'location_manager'::app_role)
  )
);

CREATE POLICY "Admins can delete areas in their org locations"
ON public.areas
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.locations
    JOIN public.profiles ON profiles.org_id = locations.org_id
    WHERE locations.id = areas.location_id
      AND profiles.id = auth.uid()
  )
  AND (
    has_role(auth.uid(), 'org_admin'::app_role)
    OR has_role(auth.uid(), 'location_manager'::app_role)
  )
);

-- Phase 3: Fix database functions to include SET search_path = public
-- Update calculate_urgency_score function
DROP FUNCTION IF EXISTS public.calculate_urgency_score(timestamp with time zone, timestamp with time zone, timestamp with time zone, integer, timestamp with time zone);

CREATE OR REPLACE FUNCTION public.calculate_urgency_score(
  _due_at timestamp with time zone,
  _window_start timestamp with time zone,
  _window_end timestamp with time zone,
  _criticality integer,
  _now timestamp with time zone DEFAULT now()
)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $function$
DECLARE
  time_decay numeric := 0;
  criticality_score numeric := 0;
  overdue_flag numeric := 0;
  shift_proximity numeric := 0;
  minutes_until_due numeric;
  minutes_until_window_end numeric;
BEGIN
  minutes_until_due := EXTRACT(EPOCH FROM (_due_at - _now)) / 60.0;
  
  IF minutes_until_due <= 0 THEN
    time_decay := 1.0;
  ELSIF minutes_until_due <= 60 THEN
    time_decay := 1.0 / (1.0 + exp(0.1 * (minutes_until_due - 30)));
  ELSE
    time_decay := 1.0 / (1.0 + exp(0.02 * (minutes_until_due - 180)));
  END IF;
  
  criticality_score := _criticality * 0.2;
  
  IF minutes_until_due < 0 THEN
    overdue_flag := 1.0;
  END IF;
  
  IF _window_end IS NOT NULL THEN
    minutes_until_window_end := EXTRACT(EPOCH FROM (_window_end - _now)) / 60.0;
    IF minutes_until_window_end > 0 AND minutes_until_window_end <= 30 THEN
      shift_proximity := 0.3;
    END IF;
  END IF;
  
  RETURN (0.4 * time_decay) + (0.3 * criticality_score) + (0.2 * overdue_flag) + (0.1 * shift_proximity);
END;
$function$;