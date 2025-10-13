import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EmployeeScore {
  employee_id: string;
  employee_name: string;
  score: number;
  details: {
    availability_match: number;
    skills_match: number;
    hours_balance: number;
    seniority: number;
    department_match: number;
  };
  warnings: string[];
  conflicts: string[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { shift_id } = await req.json();

    // Fetch shift details
    const { data: shift, error: shiftError } = await supabase
      .from('shifts')
      .select(`
        *,
        location:locations(org_id),
        department:departments(id, name)
      `)
      .eq('id', shift_id)
      .single();

    if (shiftError) throw shiftError;

    const shiftStart = new Date(shift.start_at);
    const shiftEnd = new Date(shift.end_at);
    const shiftDay = shiftStart.getDay();

    // Fetch all employees in org
    const { data: employees, error: empError } = await supabase
      .from('profiles')
      .select(`
        id,
        display_name,
        skills,
        seniority_rank,
        availability_rules,
        user_departments!inner(department_id, is_primary),
        position:positions(required_skills)
      `)
      .eq('org_id', shift.location.org_id)
      .eq('active', true);

    if (empError) throw empError;

    // Fetch existing assignments for the week
    const weekStart = new Date(shiftStart);
    weekStart.setDate(shiftStart.getDate() - shiftStart.getDay());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);

    const { data: weekAssignments } = await supabase
      .from('schedule_assignments')
      .select(`
        employee_id,
        shift_id,
        shifts!inner(start_at, end_at)
      `)
      .gte('shifts.start_at', weekStart.toISOString())
      .lte('shifts.start_at', weekEnd.toISOString());

    // Calculate scores for each employee
    const scores: EmployeeScore[] = employees.map(emp => {
      const warnings: string[] = [];
      const conflicts: string[] = [];
      
      // 1. Availability Match (0-30 points)
      let availabilityScore = 0;
      if (emp.availability_rules) {
        const dayKeys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
        const dayKey = dayKeys[shiftDay];
        const dayAvail = emp.availability_rules[dayKey] || [];
        
        const shiftStartTime = shiftStart.toTimeString().slice(0, 5);
        const shiftEndTime = shiftEnd.toTimeString().slice(0, 5);
        
        const isAvailable = dayAvail.some((slot: string[]) => 
          shiftStartTime >= slot[0] && shiftEndTime <= slot[1]
        );
        
        if (isAvailable) {
          availabilityScore = 30;
        } else if (dayAvail.length > 0) {
          warnings.push('Outside preferred availability');
          availabilityScore = 10;
        } else {
          availabilityScore = 20; // No preference set
        }
      } else {
        availabilityScore = 20; // No availability rules
      }

      // 2. Skills Match (0-25 points)
      let skillsScore = 0;
      if (shift.required_skills && shift.required_skills.length > 0) {
        const empSkills = emp.skills || [];
        const matchedSkills = shift.required_skills.filter((s: string) => 
          empSkills.includes(s)
        );
        skillsScore = (matchedSkills.length / shift.required_skills.length) * 25;
        
        if (skillsScore < 25) {
          warnings.push(`Missing ${shift.required_skills.length - matchedSkills.length} required skills`);
        }
      } else {
        skillsScore = 25; // No required skills
      }

      // 3. Hours Balance (0-20 points)
      const empAssignments = weekAssignments?.filter(a => a.employee_id === emp.id) || [];
      const weeklyHours = empAssignments.reduce((sum, a: any) => {
        if (!a.shifts || Array.isArray(a.shifts)) return sum;
        const start = new Date(a.shifts.start_at);
        const end = new Date(a.shifts.end_at);
        return sum + (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      }, 0);

      const shiftHours = (shiftEnd.getTime() - shiftStart.getTime()) / (1000 * 60 * 60);
      const projectedHours = weeklyHours + shiftHours;

      let hoursScore = 20;
      if (projectedHours > 40) {
        hoursScore = 5;
        warnings.push(`Would exceed 40h/week (${projectedHours.toFixed(1)}h)`);
      } else if (projectedHours > 35) {
        hoursScore = 15;
      }

      // 4. Seniority (0-15 points)
      const seniorityScore = Math.min((emp.seniority_rank || 0) / 10 * 15, 15);

      // 5. Department Match (0-10 points)
      let deptScore = 0;
      if (shift.department_id) {
        const inDept = emp.user_departments?.some(
          (ud: any) => ud.department_id === shift.department_id
        );
        deptScore = inDept ? 10 : 0;
        if (!inDept) warnings.push('Not in shift department');
      } else {
        deptScore = 10;
      }

      // Check for conflicts
      empAssignments.forEach((a: any) => {
        if (!a.shifts || Array.isArray(a.shifts)) return;
        const existingStart = new Date(a.shifts.start_at);
        const existingEnd = new Date(a.shifts.end_at);
        
        // Overlap check
        if (shiftStart < existingEnd && shiftEnd > existingStart) {
          conflicts.push('Overlapping shift');
        }
        
        // Rest period check (8 hours)
        const hoursBetween = Math.abs(
          (shiftStart.getTime() - existingEnd.getTime()) / (1000 * 60 * 60)
        );
        if (hoursBetween < 8 && hoursBetween > 0) {
          conflicts.push('Less than 8h rest');
        }
      });

      const totalScore = Math.round(
        availabilityScore + skillsScore + hoursScore + seniorityScore + deptScore
      );

      return {
        employee_id: emp.id,
        employee_name: emp.display_name,
        score: conflicts.length > 0 ? 0 : totalScore,
        details: {
          availability_match: availabilityScore,
          skills_match: skillsScore,
          hours_balance: hoursScore,
          seniority: seniorityScore,
          department_match: deptScore,
        },
        warnings,
        conflicts,
      };
    });

    // Sort by score descending
    scores.sort((a, b) => b.score - a.score);

    return new Response(
      JSON.stringify({
        shift_id,
        suggestions: scores,
        shift_details: {
          name: shift.name,
          start_at: shift.start_at,
          end_at: shift.end_at,
          department: shift.department?.name,
          required_skills: shift.required_skills,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in suggest-shift-assignments:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});