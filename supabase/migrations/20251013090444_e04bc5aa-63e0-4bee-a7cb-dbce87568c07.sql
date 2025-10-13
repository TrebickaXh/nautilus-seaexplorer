-- Extend shifts table for scheduling system
ALTER TABLE public.shifts
ADD COLUMN IF NOT EXISTS start_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS end_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS status shift_status DEFAULT 'scheduled',
ADD COLUMN IF NOT EXISTS required_skills TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_shifts_start_at ON public.shifts(start_at);
CREATE INDEX IF NOT EXISTS idx_shifts_status ON public.shifts(status);
CREATE INDEX IF NOT EXISTS idx_shifts_department_start ON public.shifts(department_id, start_at);