-- Create schedule_templates table for saving and reusing schedule configurations
CREATE TABLE public.schedule_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  template_data JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  archived_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.schedule_templates ENABLE ROW LEVEL SECURITY;

-- Admins can manage templates in their org
CREATE POLICY "Admins can manage schedule templates"
ON public.schedule_templates
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.org_id = schedule_templates.org_id
    AND profiles.id = auth.uid()
  )
  AND (has_role(auth.uid(), 'org_admin'::app_role) OR has_role(auth.uid(), 'location_manager'::app_role))
);

-- Users can view templates in their org
CREATE POLICY "Users can view schedule templates in their org"
ON public.schedule_templates
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.org_id = schedule_templates.org_id
    AND profiles.id = auth.uid()
  )
);

-- Create index for faster lookups
CREATE INDEX idx_schedule_templates_org_id ON public.schedule_templates(org_id);
CREATE INDEX idx_schedule_templates_created_by ON public.schedule_templates(created_by);

-- Add updated_at trigger
CREATE TRIGGER update_schedule_templates_updated_at
BEFORE UPDATE ON public.schedule_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_profiles_updated_at();