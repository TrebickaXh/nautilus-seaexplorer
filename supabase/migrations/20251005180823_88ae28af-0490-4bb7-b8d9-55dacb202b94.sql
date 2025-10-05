-- Add performance indexes for frequently queried columns
-- These will dramatically speed up common queries

-- Task instances queries
CREATE INDEX IF NOT EXISTS idx_task_instances_status ON task_instances(status);
CREATE INDEX IF NOT EXISTS idx_task_instances_due_at ON task_instances(due_at);
CREATE INDEX IF NOT EXISTS idx_task_instances_shift_id ON task_instances(shift_id);
CREATE INDEX IF NOT EXISTS idx_task_instances_department_id ON task_instances(department_id);
CREATE INDEX IF NOT EXISTS idx_task_instances_location_id ON task_instances(location_id);
CREATE INDEX IF NOT EXISTS idx_task_instances_area_id ON task_instances(area_id);
CREATE INDEX IF NOT EXISTS idx_task_instances_routine_id ON task_instances(routine_id);
CREATE INDEX IF NOT EXISTS idx_task_instances_urgency_score ON task_instances(urgency_score DESC);

-- Composite indexes for common filter combinations
CREATE INDEX IF NOT EXISTS idx_task_instances_status_due_at ON task_instances(status, due_at);
CREATE INDEX IF NOT EXISTS idx_task_instances_shift_status ON task_instances(shift_id, status);

-- Completions queries
CREATE INDEX IF NOT EXISTS idx_completions_task_instance_id ON completions(task_instance_id);
CREATE INDEX IF NOT EXISTS idx_completions_user_id ON completions(user_id);
CREATE INDEX IF NOT EXISTS idx_completions_created_at ON completions(created_at DESC);

-- Profiles queries
CREATE INDEX IF NOT EXISTS idx_profiles_org_id ON profiles(org_id);
CREATE INDEX IF NOT EXISTS idx_profiles_active ON profiles(active) WHERE active = true;

-- User assignments
CREATE INDEX IF NOT EXISTS idx_user_shifts_user_id ON user_shifts(user_id);
CREATE INDEX IF NOT EXISTS idx_user_shifts_shift_id ON user_shifts(shift_id);
CREATE INDEX IF NOT EXISTS idx_user_departments_user_id ON user_departments(user_id);
CREATE INDEX IF NOT EXISTS idx_user_departments_department_id ON user_departments(department_id);

-- Task routines
CREATE INDEX IF NOT EXISTS idx_task_routines_org_id ON task_routines(org_id);
CREATE INDEX IF NOT EXISTS idx_task_routines_active ON task_routines(active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_task_routines_location_id ON task_routines(location_id);

-- Locations, departments, areas
CREATE INDEX IF NOT EXISTS idx_locations_org_id ON locations(org_id);
CREATE INDEX IF NOT EXISTS idx_departments_location_id ON departments(location_id);
CREATE INDEX IF NOT EXISTS idx_areas_location_id ON areas(location_id);
CREATE INDEX IF NOT EXISTS idx_shifts_location_id ON shifts(location_id);
CREATE INDEX IF NOT EXISTS idx_shifts_department_id ON shifts(department_id);