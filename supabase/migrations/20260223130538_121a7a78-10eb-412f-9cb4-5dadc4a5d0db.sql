
-- Fix update_task_urgency to call the correct overload (integer criticality, returns 0.0-1.0)
CREATE OR REPLACE FUNCTION public.update_task_urgency()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE task_instances
  SET urgency_score = calculate_urgency_score(
    due_at,
    window_start,
    window_end,
    COALESCE((denormalized_data->>'criticality')::integer, 3),
    now()
  )
  WHERE status = 'pending';
END;
$$;

-- Drop the old text-based overload that returns inflated integers
DROP FUNCTION IF EXISTS public.calculate_urgency_score(timestamp with time zone, text);

-- Recalculate all urgency scores now
SELECT update_task_urgency();
