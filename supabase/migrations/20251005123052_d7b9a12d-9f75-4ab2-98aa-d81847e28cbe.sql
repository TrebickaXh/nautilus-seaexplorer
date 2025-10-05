-- ============================================
-- PHASE 1: Update task_routines structure
-- ============================================

ALTER TABLE task_routines
  ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES departments(id),
  ADD COLUMN IF NOT EXISTS shift_id uuid REFERENCES shifts(id),
  ADD COLUMN IF NOT EXISTS recurrence_v2 jsonb,
  ADD COLUMN IF NOT EXISTS is_deprecated boolean DEFAULT false;

-- Ensure area_ids not empty
ALTER TABLE task_routines
  DROP CONSTRAINT IF EXISTS task_routines_area_ids_nonempty,
  ADD CONSTRAINT task_routines_area_ids_nonempty 
  CHECK (area_ids IS NULL OR array_length(area_ids, 1) >= 1);

-- Function to validate shift belongs to department
CREATE OR REPLACE FUNCTION trg_check_shift_department()
RETURNS trigger 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.shift_id IS NOT NULL AND NEW.department_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM shifts s 
      WHERE s.id = NEW.shift_id 
      AND (s.department_id = NEW.department_id OR s.department_id IS NULL)
    ) THEN
      RAISE EXCEPTION 'Shift does not belong to the specified department';
    END IF;
  END IF;
  RETURN NEW;
END$$;

DROP TRIGGER IF EXISTS check_shift_department ON task_routines;
CREATE TRIGGER check_shift_department
BEFORE INSERT OR UPDATE ON task_routines
FOR EACH ROW EXECUTE FUNCTION trg_check_shift_department();

-- ============================================
-- PHASE 2: Update task_instances structure
-- ============================================

ALTER TABLE task_instances
  ADD COLUMN IF NOT EXISTS created_from_v2 text CHECK (created_from_v2 IN ('routine','oneoff'));

-- Idempotency constraint
DROP INDEX IF EXISTS ux_task_instances_routine_area_due;
CREATE UNIQUE INDEX ux_task_instances_routine_area_due
ON task_instances (routine_id, area_id, due_at)
WHERE routine_id IS NOT NULL AND created_from = 'routine'::task_creation_source;

-- Performance index (using correct enum value 'done')
DROP INDEX IF EXISTS ix_task_instances_scope;
CREATE INDEX ix_task_instances_scope
ON task_instances (location_id, department_id, shift_id, area_id, due_at, status)
WHERE status != 'done'::task_status;

-- ============================================
-- PHASE 3: Update completions
-- ============================================

ALTER TABLE completions
  ADD COLUMN IF NOT EXISTS reassigned_shift_id uuid REFERENCES shifts(id),
  ADD COLUMN IF NOT EXISTS new_due_at timestamptz;

-- ============================================
-- PHASE 4: Update shift_reports
-- ============================================

ALTER TABLE shift_reports
  ADD COLUMN IF NOT EXISTS service_date_v2 date,
  ADD COLUMN IF NOT EXISTS window_start_v2 timestamptz,
  ADD COLUMN IF NOT EXISTS window_end_v2 timestamptz,
  ADD COLUMN IF NOT EXISTS totals_v2 jsonb,
  ADD COLUMN IF NOT EXISTS kpis_v2 jsonb,
  ADD COLUMN IF NOT EXISTS by_user_v2 jsonb,
  ADD COLUMN IF NOT EXISTS by_area_v2 jsonb,
  ADD COLUMN IF NOT EXISTS generated_at timestamptz DEFAULT now();

DROP INDEX IF EXISTS ix_shift_reports_shift_date;
CREATE INDEX ix_shift_reports_shift_date ON shift_reports (shift_id, report_date);

DROP INDEX IF EXISTS ix_shift_reports_dept_date;
CREATE INDEX ix_shift_reports_dept_date ON shift_reports (department_id, report_date);

-- ============================================
-- PHASE 5: Deprecate schedules
-- ============================================

CREATE OR REPLACE FUNCTION prevent_schedule_mutation()
RETURNS trigger 
LANGUAGE plpgsql 
AS $$
BEGIN
  RAISE EXCEPTION 'schedules table is deprecated. Use task_routines.recurrence_v2 instead.';
END$$;

DROP TRIGGER IF EXISTS schedules_block_insert ON schedules;
CREATE TRIGGER schedules_block_insert
BEFORE INSERT ON schedules
FOR EACH STATEMENT EXECUTE FUNCTION prevent_schedule_mutation();

DROP TRIGGER IF EXISTS schedules_block_update ON schedules;
CREATE TRIGGER schedules_block_update
BEFORE UPDATE ON schedules
FOR EACH STATEMENT EXECUTE FUNCTION prevent_schedule_mutation();

DROP TRIGGER IF EXISTS schedules_block_delete ON schedules;
CREATE TRIGGER schedules_block_delete
BEFORE DELETE ON schedules
FOR EACH STATEMENT EXECUTE FUNCTION prevent_schedule_mutation();

-- ============================================
-- PHASE 6: Recurrence validation
-- ============================================

ALTER TABLE task_routines
  DROP CONSTRAINT IF EXISTS task_routines_recurrence_valid,
  ADD CONSTRAINT task_routines_recurrence_valid
  CHECK (
    recurrence_v2 IS NULL OR (
      (recurrence_v2->>'type') IN ('daily','weekly','monthly','custom_weeks','oneoff') AND
      (recurrence_v2 ? 'time_of_day') AND
      ((recurrence_v2->>'type') != 'weekly' OR jsonb_array_length(recurrence_v2->'days_of_week') >= 1) AND
      ((recurrence_v2->>'type') != 'custom_weeks' OR (
        (recurrence_v2->>'interval_weeks')::int >= 1 AND 
        jsonb_array_length(recurrence_v2->'days_of_week') >= 1
      )) AND
      ((recurrence_v2->>'type') != 'monthly' OR (
        (recurrence_v2->>'day_of_month')::int BETWEEN 1 AND 31
      ))
    )
  );