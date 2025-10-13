-- Add assignment tracking columns to schedule_assignments
ALTER TABLE public.schedule_assignments 
ADD COLUMN assignment_score INTEGER,
ADD COLUMN assignment_method TEXT DEFAULT 'manual',
ADD COLUMN metadata JSONB DEFAULT '{}';

-- Create index for better performance
CREATE INDEX idx_schedule_assignments_method ON public.schedule_assignments(assignment_method);

-- Comment on columns
COMMENT ON COLUMN public.schedule_assignments.assignment_score IS 'Confidence score (0-100) for auto-assignments';
COMMENT ON COLUMN public.schedule_assignments.assignment_method IS 'How assignment was made: manual, auto, bulk, template';
COMMENT ON COLUMN public.schedule_assignments.metadata IS 'Additional assignment context like conflict warnings, override reasons';