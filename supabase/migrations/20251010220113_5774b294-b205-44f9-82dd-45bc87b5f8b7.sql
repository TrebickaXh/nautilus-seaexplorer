-- Update the calculate_urgency_score function to match the new time decay logic
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
AS $function$
DECLARE
  time_decay numeric := 0;
  criticality_score numeric := 0;
  overdue_flag numeric := 0;
  shift_proximity numeric := 0;
  minutes_until_due numeric;
  minutes_until_window_end numeric;
  calculated_score numeric;
BEGIN
  minutes_until_due := EXTRACT(EPOCH FROM (_due_at - _now)) / 60.0;
  
  -- Calculate time decay with improved multi-tier approach
  IF minutes_until_due <= 0 THEN
    time_decay := 1.0;
  ELSIF minutes_until_due <= 60 THEN
    -- Last hour: steep curve from ~0.5 to 1.0
    time_decay := 1.0 / (1.0 + exp(0.1 * (minutes_until_due - 30)));
  ELSIF minutes_until_due <= 480 THEN
    -- 1-8 hours: gradual increase from ~0.15 to 0.5
    time_decay := 1.0 / (1.0 + exp(0.015 * (minutes_until_due - 240)));
  ELSE
    -- 8-24+ hours: slow increase from ~0.05 to 0.15
    time_decay := 1.0 / (1.0 + exp(0.006 * (minutes_until_due - 720)));
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
  
  calculated_score := (0.4 * time_decay) + (0.3 * criticality_score) + (0.2 * overdue_flag) + (0.1 * shift_proximity);
  
  -- Ensure overdue tasks always have critical urgency (minimum 0.85)
  IF overdue_flag = 1.0 AND calculated_score < 0.85 THEN
    RETURN 0.85;
  END IF;
  
  RETURN calculated_score;
END;
$function$;