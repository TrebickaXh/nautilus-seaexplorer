-- Create schedule_notes table for shift communication
CREATE TABLE IF NOT EXISTS public.schedule_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id UUID NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.schedule_notes ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view notes for shifts in their org"
ON public.schedule_notes
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM shifts
    JOIN locations ON locations.id = shifts.location_id
    JOIN profiles ON profiles.org_id = locations.org_id
    WHERE shifts.id = schedule_notes.shift_id
    AND profiles.id = auth.uid()
  )
);

CREATE POLICY "Users can create notes for shifts in their org"
ON public.schedule_notes
FOR INSERT
WITH CHECK (
  author_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM shifts
    JOIN locations ON locations.id = shifts.location_id
    JOIN profiles ON profiles.org_id = locations.org_id
    WHERE shifts.id = schedule_notes.shift_id
    AND profiles.id = auth.uid()
  )
);

CREATE POLICY "Admins can delete notes in their org"
ON public.schedule_notes
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM shifts
    JOIN locations ON locations.id = shifts.location_id
    JOIN profiles ON profiles.org_id = locations.org_id
    WHERE shifts.id = schedule_notes.shift_id
    AND profiles.id = auth.uid()
  )
  AND (
    has_role(auth.uid(), 'org_admin'::app_role)
    OR has_role(auth.uid(), 'location_manager'::app_role)
  )
);

-- Create index for performance
CREATE INDEX idx_schedule_notes_shift_id ON public.schedule_notes(shift_id);
CREATE INDEX idx_schedule_notes_author_id ON public.schedule_notes(author_id);

-- Create trigger for updated_at
CREATE TRIGGER update_schedule_notes_updated_at
  BEFORE UPDATE ON public.schedule_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_profiles_updated_at();