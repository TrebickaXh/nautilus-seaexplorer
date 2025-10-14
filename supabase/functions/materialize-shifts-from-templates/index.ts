import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { start_date, end_date, department_id, auto_assign = true } = await req.json();

    console.log('Materializing shifts from templates:', { start_date, end_date, department_id, auto_assign });

    // Fetch shift templates
    let query = supabase
      .from('shifts')
      .select(`
        *,
        departments(name, location_id),
        locations(name, org_id)
      `)
      .eq('is_template', true)
      .is('archived_at', null);

    if (department_id) {
      query = query.eq('department_id', department_id);
    }

    const { data: templates, error: templatesError } = await query;

    if (templatesError) {
      console.error('Error fetching templates:', templatesError);
      throw templatesError;
    }

    console.log(`Found ${templates?.length || 0} shift templates`);

    const startDate = new Date(start_date);
    const endDate = new Date(end_date);
    const shiftsToCreate: any[] = [];
    const assignmentsToCreate: any[] = [];

    // For each template, generate shifts for the date range
    for (const template of templates || []) {
      console.log(`Processing template: ${template.name}`);

      // Get eligible employees for this template
      const { data: eligibleEmployees, error: employeesError } = await supabase
        .from('user_shifts')
        .select('user_id, profiles(id, display_name, skills, position_id)')
        .eq('shift_id', template.id);

      if (employeesError) {
        console.error('Error fetching eligible employees:', employeesError);
        continue;
      }

      // Generate shifts for each matching day
      for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
        const dayOfWeek = date.getDay();

        if (template.days_of_week.includes(dayOfWeek)) {
          // Create shift instance for this date
          const shiftDate = new Date(date);
          const [startHours, startMinutes] = template.start_time.split(':');
          const [endHours, endMinutes] = template.end_time.split(':');

          const startAt = new Date(shiftDate);
          startAt.setHours(parseInt(startHours), parseInt(startMinutes), 0, 0);

          const endAt = new Date(shiftDate);
          endAt.setHours(parseInt(endHours), parseInt(endMinutes), 0, 0);

          // If end time is before start time, it crosses midnight
          if (endAt <= startAt) {
            endAt.setDate(endAt.getDate() + 1);
          }

          const newShift = {
            name: template.name,
            location_id: template.location_id,
            department_id: template.department_id,
            start_time: template.start_time,
            end_time: template.end_time,
            days_of_week: [dayOfWeek],
            start_at: startAt.toISOString(),
            end_at: endAt.toISOString(),
            status: 'scheduled',
            template_shift_id: template.id,
            is_template: false,
            required_skills: template.required_skills,
            notes: template.notes,
          };

          shiftsToCreate.push({
            shift: newShift,
            eligibleEmployees: eligibleEmployees || [],
            template,
          });
        }
      }
    }

    console.log(`Generated ${shiftsToCreate.length} shift instances`);

    // Insert shifts and create assignments
    const createdShifts: any[] = [];
    const createdAssignments: any[] = [];

    for (const { shift, eligibleEmployees, template } of shiftsToCreate) {
      // Check if shift already exists
      const { data: existingShift } = await supabase
        .from('shifts')
        .select('id')
        .eq('template_shift_id', template.id)
        .eq('start_at', shift.start_at)
        .maybeSingle();

      if (existingShift) {
        console.log('Shift already exists, skipping:', shift.name, shift.start_at);
        continue;
      }

      // Create the shift
      const { data: createdShift, error: shiftError } = await supabase
        .from('shifts')
        .insert(shift)
        .select()
        .single();

      if (shiftError) {
        console.error('Error creating shift:', shiftError);
        continue;
      }

      createdShifts.push(createdShift);

      // Auto-assign if enabled and there are eligible employees
      if (auto_assign && eligibleEmployees.length > 0) {
        // Simple direct assignment of all eligible employees
        for (const emp of eligibleEmployees) {
          const assignment = {
            shift_id: createdShift.id,
            employee_id: emp.user_id,
            status: 'assigned',
            assignment_method: 'auto_from_template',
            metadata: { template_id: template.id },
          };
          assignmentsToCreate.push(assignment);
        }
      } else if (!auto_assign || eligibleEmployees.length === 0) {
        // Create as open shift if no auto-assign or no eligible employees
        const { error: openShiftError } = await supabase
          .from('open_shift_pool')
          .insert({
            shift_id: createdShift.id,
            post_reason: auto_assign ? 'No assigned employees' : 'Auto-assign disabled',
          });

        if (openShiftError) {
          console.error('Error creating open shift:', openShiftError);
        }
      }
    }

    // Batch insert assignments
    if (assignmentsToCreate.length > 0) {
      const { data: assignments, error: assignmentError } = await supabase
        .from('schedule_assignments')
        .insert(assignmentsToCreate)
        .select();

      if (assignmentError) {
        console.error('Error creating assignments:', assignmentError);
      } else {
        createdAssignments.push(...(assignments || []));
      }
    }

    console.log(`Created ${createdShifts.length} shifts and ${createdAssignments.length} assignments`);

    return new Response(
      JSON.stringify({
        success: true,
        shifts_created: createdShifts.length,
        assignments_created: createdAssignments.length,
        shifts: createdShifts,
        assignments: createdAssignments,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in materialize-shifts-from-templates:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
