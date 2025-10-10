-- 1) Organization-level settings (Task Rules & Notifications)
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS settings JSONB NOT NULL DEFAULT '{}'::jsonb;

-- 2) Locations: address
ALTER TABLE locations
  ADD COLUMN IF NOT EXISTS address TEXT;

-- 3) Departments: manager_user_id (FK to auth.users)
ALTER TABLE departments
  ADD COLUMN IF NOT EXISTS manager_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 4) One-off tasks: required_proof (reuse existing proof_type enum)
ALTER TABLE task_instances
  ADD COLUMN IF NOT EXISTS required_proof proof_type DEFAULT 'none';

-- 5) Indexes for user_shifts (faster bulk inserts during onboarding)
CREATE INDEX IF NOT EXISTS idx_user_shifts_user ON user_shifts(user_id);
CREATE INDEX IF NOT EXISTS idx_user_shifts_shift ON user_shifts(shift_id);