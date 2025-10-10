-- Update the update_task_urgency function to recalculate all pending tasks
CREATE OR REPLACE FUNCTION public.update_task_urgency()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.task_instances ti
  SET urgency_score = public.calculate_urgency_score(
    ti.due_at,
    ti.window_start,
    ti.window_end,
    (SELECT tr.criticality FROM public.task_routines tr WHERE tr.id = ti.routine_id),
    now()
  )
  WHERE ti.status = 'pending';
END;
$function$;