
-- First drop tables that have FK dependencies on other tables being dropped
-- swap_requests depends on schedule_assignments
DROP TABLE IF EXISTS public.swap_requests CASCADE;
DROP TABLE IF EXISTS public.shift_claims CASCADE;
DROP TABLE IF EXISTS public.open_shift_pool CASCADE;
DROP TABLE IF EXISTS public.schedule_notes CASCADE;
DROP TABLE IF EXISTS public.schedule_assignments CASCADE;
DROP TABLE IF EXISTS public.schedule_templates CASCADE;
DROP TABLE IF EXISTS public.time_off_requests CASCADE;
DROP TABLE IF EXISTS public.suggestions CASCADE;
DROP TABLE IF EXISTS public.labor_rules CASCADE;

-- Remove position_id FK from profiles before dropping positions
ALTER TABLE public.profiles DROP COLUMN IF EXISTS position_id;

DROP TABLE IF EXISTS public.positions CASCADE;

-- Drop orphaned enum types
DROP TYPE IF EXISTS public.assignment_status CASCADE;
DROP TYPE IF EXISTS public.claim_status CASCADE;
DROP TYPE IF EXISTS public.swap_type CASCADE;
DROP TYPE IF EXISTS public.swap_status CASCADE;
DROP TYPE IF EXISTS public.suggestion_status CASCADE;

-- Drop orphaned function
DROP FUNCTION IF EXISTS public.trg_check_shift_department() CASCADE;
