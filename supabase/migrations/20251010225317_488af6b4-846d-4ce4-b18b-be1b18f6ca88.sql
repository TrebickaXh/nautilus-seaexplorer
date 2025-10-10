-- Drop the outdated constraint
ALTER TABLE task_routines DROP CONSTRAINT IF EXISTS task_routines_recurrence_valid;

-- Add updated constraint that supports BOTH old (time_of_day) and new (time_slots) formats
ALTER TABLE task_routines ADD CONSTRAINT task_routines_recurrence_v2_valid CHECK (
  recurrence_v2 IS NULL OR (
    -- Must have a valid type
    (recurrence_v2->>'type') IN ('daily', 'weekly', 'monthly', 'custom_weeks', 'oneoff')
    AND
    -- Must have EITHER time_of_day (old format) OR time_slots (new format)
    (recurrence_v2 ? 'time_of_day' OR recurrence_v2 ? 'time_slots')
    AND
    -- Weekly must have days_of_week
    ((recurrence_v2->>'type') != 'weekly' OR jsonb_array_length(recurrence_v2->'days_of_week') >= 1)
    AND
    -- Custom weeks must have interval_weeks and days_of_week
    ((recurrence_v2->>'type') != 'custom_weeks' OR (
      (recurrence_v2->>'interval_weeks')::int >= 1 
      AND jsonb_array_length(recurrence_v2->'days_of_week') >= 1
    ))
    AND
    -- Monthly must have day_of_month
    ((recurrence_v2->>'type') != 'monthly' OR (
      (recurrence_v2->>'day_of_month')::int >= 1 
      AND (recurrence_v2->>'day_of_month')::int <= 31
    ))
  )
);