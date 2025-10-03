-- Project Nautilus Database Schema
-- Core tables for task management, scheduling, and user management

-- Create custom types
CREATE TYPE app_role AS ENUM ('org_admin', 'location_manager', 'crew');
CREATE TYPE task_status AS ENUM ('pending', 'done', 'missed', 'skipped');
CREATE TYPE schedule_type AS ENUM ('cron', 'window', 'oneoff');
CREATE TYPE proof_type AS ENUM ('none', 'photo', 'note', 'dual');
CREATE TYPE suggestion_status AS ENUM ('proposed', 'accepted', 'dismissed');

-- Organizations
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at TIMESTAMPTZ
);

-- Locations
CREATE TABLE locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at TIMESTAMPTZ
);

-- Areas within locations
CREATE TABLE areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User profiles (extends auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  role app_role NOT NULL DEFAULT 'crew',
  pin_hash TEXT,
  nfc_uid TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Task templates
CREATE TABLE task_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  steps JSONB DEFAULT '[]'::jsonb,
  est_minutes INTEGER NOT NULL DEFAULT 15,
  criticality INTEGER NOT NULL DEFAULT 3 CHECK (criticality >= 1 AND criticality <= 5),
  required_proof proof_type NOT NULL DEFAULT 'none',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at TIMESTAMPTZ
);

-- Schedules for task templates
CREATE TABLE schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES task_templates(id) ON DELETE CASCADE,
  type schedule_type NOT NULL,
  cron_expr TEXT,
  window_start TIME,
  window_end TIME,
  days_of_week INTEGER[] DEFAULT ARRAY[]::INTEGER[],
  shift_name TEXT,
  assignee_role app_role,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at TIMESTAMPTZ
);

-- Task instances (materialized from schedules)
CREATE TABLE task_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES task_templates(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  area_id UUID REFERENCES areas(id) ON DELETE SET NULL,
  due_at TIMESTAMPTZ NOT NULL,
  window_start TIMESTAMPTZ,
  window_end TIMESTAMPTZ,
  assigned_role app_role,
  status task_status NOT NULL DEFAULT 'pending',
  urgency_score NUMERIC(5,2) DEFAULT 0.5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Task completions
CREATE TABLE completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_instance_id UUID NOT NULL REFERENCES task_instances(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  cosigner_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  note TEXT,
  photo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Weather/signal-based suggestions
CREATE TABLE suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  signal TEXT NOT NULL,
  reason TEXT NOT NULL,
  proposed_template_id UUID REFERENCES task_templates(id) ON DELETE SET NULL,
  status suggestion_status NOT NULL DEFAULT 'proposed',
  acted_by_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Audit events
CREATE TABLE audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  actor_type TEXT NOT NULL,
  actor_id UUID,
  event_type TEXT NOT NULL,
  payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Onboarding sessions (for LLM-assisted setup)
CREATE TABLE onboarding_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_history JSONB DEFAULT '[]'::jsonb,
  generated_config JSONB,
  status TEXT NOT NULL DEFAULT 'in_progress',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Enable Row Level Security
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- RLS Policies for organizations (users can see their org)
CREATE POLICY "Users can view their organization"
  ON organizations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.org_id = organizations.id
      AND profiles.id = auth.uid()
    )
  );

CREATE POLICY "Org admins can update their organization"
  ON organizations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.org_id = organizations.id
      AND profiles.id = auth.uid()
      AND profiles.role = 'org_admin'
    )
  );

-- RLS Policies for locations
CREATE POLICY "Users can view locations in their org"
  ON locations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.org_id = locations.org_id
      AND profiles.id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage locations"
  ON locations FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.org_id = locations.org_id
      AND profiles.id = auth.uid()
      AND profiles.role IN ('org_admin', 'location_manager')
    )
  );

-- RLS Policies for areas
CREATE POLICY "Users can view areas in their org locations"
  ON areas FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM locations
      JOIN profiles ON profiles.org_id = locations.org_id
      WHERE locations.id = areas.location_id
      AND profiles.id = auth.uid()
    )
  );

-- RLS Policies for task_templates
CREATE POLICY "Users can view templates in their org"
  ON task_templates FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.org_id = task_templates.org_id
      AND profiles.id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage templates"
  ON task_templates FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.org_id = task_templates.org_id
      AND profiles.id = auth.uid()
      AND profiles.role IN ('org_admin', 'location_manager')
    )
  );

-- RLS Policies for schedules
CREATE POLICY "Users can view schedules for their org templates"
  ON schedules FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM task_templates
      JOIN profiles ON profiles.org_id = task_templates.org_id
      WHERE task_templates.id = schedules.template_id
      AND profiles.id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage schedules"
  ON schedules FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM task_templates
      JOIN profiles ON profiles.org_id = task_templates.org_id
      WHERE task_templates.id = schedules.template_id
      AND profiles.id = auth.uid()
      AND profiles.role IN ('org_admin', 'location_manager')
    )
  );

-- RLS Policies for task_instances
CREATE POLICY "Users can view task instances for their org"
  ON task_instances FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM locations
      JOIN profiles ON profiles.org_id = locations.org_id
      WHERE locations.id = task_instances.location_id
      AND profiles.id = auth.uid()
    )
  );

CREATE POLICY "Crew can update task instances (mark complete/skip)"
  ON task_instances FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM locations
      JOIN profiles ON profiles.org_id = locations.org_id
      WHERE locations.id = task_instances.location_id
      AND profiles.id = auth.uid()
    )
  );

-- RLS Policies for completions
CREATE POLICY "Users can view completions for their org"
  ON completions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM task_instances
      JOIN locations ON locations.id = task_instances.location_id
      JOIN profiles ON profiles.org_id = locations.org_id
      WHERE task_instances.id = completions.task_instance_id
      AND profiles.id = auth.uid()
    )
  );

CREATE POLICY "Users can create completions"
  ON completions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = completions.user_id
      AND profiles.id = auth.uid()
    )
  );

-- RLS Policies for suggestions
CREATE POLICY "Users can view suggestions for their org"
  ON suggestions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.org_id = suggestions.org_id
      AND profiles.id = auth.uid()
    )
  );

-- RLS Policies for audit_events
CREATE POLICY "Admins can view audit events for their org"
  ON audit_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.org_id = audit_events.org_id
      AND profiles.id = auth.uid()
      AND profiles.role IN ('org_admin', 'location_manager')
    )
  );

-- RLS Policies for onboarding_sessions
CREATE POLICY "Users can manage their own onboarding sessions"
  ON onboarding_sessions FOR ALL
  USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX idx_locations_org_id ON locations(org_id);
CREATE INDEX idx_areas_location_id ON areas(location_id);
CREATE INDEX idx_profiles_org_id ON profiles(org_id);
CREATE INDEX idx_task_templates_org_id ON task_templates(org_id);
CREATE INDEX idx_schedules_template_id ON schedules(template_id);
CREATE INDEX idx_task_instances_location_id ON task_instances(location_id);
CREATE INDEX idx_task_instances_status ON task_instances(status);
CREATE INDEX idx_task_instances_due_at ON task_instances(due_at);
CREATE INDEX idx_completions_task_instance_id ON completions(task_instance_id);
CREATE INDEX idx_completions_user_id ON completions(user_id);
CREATE INDEX idx_suggestions_org_id ON suggestions(org_id);
CREATE INDEX idx_audit_events_org_id ON audit_events(org_id);
CREATE INDEX idx_audit_events_created_at ON audit_events(created_at DESC);

-- Function to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, org_id, display_name, role)
  VALUES (
    new.id,
    (new.raw_user_meta_data->>'org_id')::uuid,
    COALESCE(new.raw_user_meta_data->>'display_name', new.email),
    COALESCE((new.raw_user_meta_data->>'role')::app_role, 'crew')
  );
  RETURN new;
END;
$$;

-- Trigger for new user profile creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();