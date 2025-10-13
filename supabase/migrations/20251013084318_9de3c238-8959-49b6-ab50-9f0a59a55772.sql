-- Create enum types for scheduling
CREATE TYPE public.shift_status AS ENUM ('draft', 'scheduled', 'open', 'pending_swap', 'approved', 'canceled');
CREATE TYPE public.assignment_status AS ENUM ('assigned', 'posted', 'dropped', 'swap_pending', 'approved', 'declined');
CREATE TYPE public.claim_status AS ENUM ('waiting', 'manager_review', 'accepted', 'rejected', 'auto_approved');
CREATE TYPE public.swap_type AS ENUM ('direct', 'market');
CREATE TYPE public.swap_status AS ENUM ('pending', 'approved', 'rejected', 'canceled');

-- Positions table (roles/job types)
CREATE TABLE public.positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  required_skills TEXT[] DEFAULT '{}',
  min_age INTEGER,
  base_rate_cents INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at TIMESTAMPTZ,
  UNIQUE(org_id, name)
);

-- Labor rules (compliance settings per org/jurisdiction)
CREATE TABLE public.labor_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  jurisdiction TEXT NOT NULL DEFAULT 'US',
  min_rest_hours INTEGER NOT NULL DEFAULT 8,
  max_hours_day INTEGER NOT NULL DEFAULT 12,
  max_hours_week INTEGER NOT NULL DEFAULT 40,
  meal_break JSONB DEFAULT '{"required_after_hours": 5, "duration_minutes": 30}',
  minors_rules JSONB DEFAULT '{}',
  union_rules JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(org_id)
);

-- Extend profiles with scheduling-specific fields
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS position_id UUID REFERENCES public.positions(id),
ADD COLUMN IF NOT EXISTS pay_rate_cents INTEGER,
ADD COLUMN IF NOT EXISTS overtime_rule_id UUID,
ADD COLUMN IF NOT EXISTS availability_rules JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS skills TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS seniority_rank INTEGER DEFAULT 0;

-- Schedule assignments (who is assigned to which shift)
CREATE TABLE public.schedule_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id UUID NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status public.assignment_status NOT NULL DEFAULT 'assigned',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(shift_id, employee_id, status)
);

-- Open shift pool (marketplace for available shifts)
CREATE TABLE public.open_shift_pool (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id UUID NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
  posted_by_employee_id UUID REFERENCES public.profiles(id),
  post_reason TEXT,
  expires_at TIMESTAMPTZ,
  bonus_cents INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(shift_id)
);

-- Claims (employees claiming open shifts)
CREATE TABLE public.shift_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id UUID NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
  claimant_employee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  priority_score INTEGER DEFAULT 0,
  status public.claim_status NOT NULL DEFAULT 'waiting',
  rules_result JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by_user_id UUID REFERENCES public.profiles(id)
);

-- Swap requests
CREATE TABLE public.swap_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_assignment_id UUID NOT NULL REFERENCES public.schedule_assignments(id) ON DELETE CASCADE,
  to_employee_id UUID REFERENCES public.profiles(id),
  type public.swap_type NOT NULL DEFAULT 'market',
  status public.swap_status NOT NULL DEFAULT 'pending',
  rules_result JSONB DEFAULT '{}',
  manager_id UUID REFERENCES public.profiles(id),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Time off requests (scaffold)
CREATE TABLE public.time_off_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_by_user_id UUID REFERENCES public.profiles(id),
  approved_at TIMESTAMPTZ
);

-- Indexes for performance
CREATE INDEX idx_schedule_assignments_shift ON public.schedule_assignments(shift_id);
CREATE INDEX idx_schedule_assignments_employee ON public.schedule_assignments(employee_id);
CREATE INDEX idx_schedule_assignments_status ON public.schedule_assignments(status);
CREATE INDEX idx_open_shift_pool_shift ON public.open_shift_pool(shift_id);
CREATE INDEX idx_shift_claims_shift ON public.shift_claims(shift_id);
CREATE INDEX idx_shift_claims_claimant ON public.shift_claims(claimant_employee_id);
CREATE INDEX idx_shift_claims_status ON public.shift_claims(status);
CREATE INDEX idx_swap_requests_from ON public.swap_requests(from_assignment_id);
CREATE INDEX idx_swap_requests_status ON public.swap_requests(status);
CREATE INDEX idx_time_off_employee ON public.time_off_requests(employee_id);
CREATE INDEX idx_positions_org ON public.positions(org_id);

-- RLS Policies

-- Positions: users can view positions in their org
ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view positions in their org"
ON public.positions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.org_id = positions.org_id
    AND profiles.id = auth.uid()
  )
);

CREATE POLICY "Admins can manage positions"
ON public.positions FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.org_id = positions.org_id
    AND profiles.id = auth.uid()
  )
  AND (has_role(auth.uid(), 'org_admin') OR has_role(auth.uid(), 'location_manager'))
);

-- Labor rules: org members can view, admins can manage
ALTER TABLE public.labor_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view labor rules for their org"
ON public.labor_rules FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.org_id = labor_rules.org_id
    AND profiles.id = auth.uid()
  )
);

CREATE POLICY "Admins can manage labor rules"
ON public.labor_rules FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.org_id = labor_rules.org_id
    AND profiles.id = auth.uid()
  )
  AND has_role(auth.uid(), 'org_admin')
);

-- Schedule assignments: users can view in their org, admins can manage
ALTER TABLE public.schedule_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view assignments in their org"
ON public.schedule_assignments FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.shifts
    JOIN public.locations ON locations.id = shifts.location_id
    JOIN public.profiles ON profiles.org_id = locations.org_id
    WHERE shifts.id = schedule_assignments.shift_id
    AND profiles.id = auth.uid()
  )
);

CREATE POLICY "Admins can manage assignments"
ON public.schedule_assignments FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.shifts
    JOIN public.locations ON locations.id = shifts.location_id
    JOIN public.profiles ON profiles.org_id = locations.org_id
    WHERE shifts.id = schedule_assignments.shift_id
    AND profiles.id = auth.uid()
  )
  AND (has_role(auth.uid(), 'org_admin') OR has_role(auth.uid(), 'location_manager'))
);

-- Open shift pool: users can view and claim
ALTER TABLE public.open_shift_pool ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view open shifts in their org"
ON public.open_shift_pool FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.shifts
    JOIN public.locations ON locations.id = shifts.location_id
    JOIN public.profiles ON profiles.org_id = locations.org_id
    WHERE shifts.id = open_shift_pool.shift_id
    AND profiles.id = auth.uid()
  )
);

CREATE POLICY "Employees can post their shifts"
ON public.open_shift_pool FOR INSERT
WITH CHECK (
  posted_by_employee_id = auth.uid()
);

CREATE POLICY "Admins can manage open shifts"
ON public.open_shift_pool FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.shifts
    JOIN public.locations ON locations.id = shifts.location_id
    JOIN public.profiles ON profiles.org_id = locations.org_id
    WHERE shifts.id = open_shift_pool.shift_id
    AND profiles.id = auth.uid()
  )
  AND (has_role(auth.uid(), 'org_admin') OR has_role(auth.uid(), 'location_manager'))
);

-- Shift claims
ALTER TABLE public.shift_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view claims in their org"
ON public.shift_claims FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.shifts
    JOIN public.locations ON locations.id = shifts.location_id
    JOIN public.profiles ON profiles.org_id = locations.org_id
    WHERE shifts.id = shift_claims.shift_id
    AND profiles.id = auth.uid()
  )
);

CREATE POLICY "Employees can create claims"
ON public.shift_claims FOR INSERT
WITH CHECK (
  claimant_employee_id = auth.uid()
);

CREATE POLICY "Admins can manage claims"
ON public.shift_claims FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.shifts
    JOIN public.locations ON locations.id = shifts.location_id
    JOIN public.profiles ON profiles.org_id = locations.org_id
    WHERE shifts.id = shift_claims.shift_id
    AND profiles.id = auth.uid()
  )
  AND (has_role(auth.uid(), 'org_admin') OR has_role(auth.uid(), 'location_manager'))
);

-- Swap requests
ALTER TABLE public.swap_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view swap requests in their org"
ON public.swap_requests FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.schedule_assignments
    JOIN public.shifts ON shifts.id = schedule_assignments.shift_id
    JOIN public.locations ON locations.id = shifts.location_id
    JOIN public.profiles ON profiles.org_id = locations.org_id
    WHERE schedule_assignments.id = swap_requests.from_assignment_id
    AND profiles.id = auth.uid()
  )
);

CREATE POLICY "Employees can create swap requests for their assignments"
ON public.swap_requests FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.schedule_assignments
    WHERE schedule_assignments.id = swap_requests.from_assignment_id
    AND schedule_assignments.employee_id = auth.uid()
  )
);

CREATE POLICY "Admins can manage swap requests"
ON public.swap_requests FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.schedule_assignments
    JOIN public.shifts ON shifts.id = schedule_assignments.shift_id
    JOIN public.locations ON locations.id = shifts.location_id
    JOIN public.profiles ON profiles.org_id = locations.org_id
    WHERE schedule_assignments.id = swap_requests.from_assignment_id
    AND profiles.id = auth.uid()
  )
  AND (has_role(auth.uid(), 'org_admin') OR has_role(auth.uid(), 'location_manager'))
);

-- Time off requests
ALTER TABLE public.time_off_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employees can manage their own time off requests"
ON public.time_off_requests FOR ALL
USING (employee_id = auth.uid());

CREATE POLICY "Admins can view and approve time off in their org"
ON public.time_off_requests FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = time_off_requests.employee_id
    AND profiles.org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid())
  )
  AND (has_role(auth.uid(), 'org_admin') OR has_role(auth.uid(), 'location_manager'))
);