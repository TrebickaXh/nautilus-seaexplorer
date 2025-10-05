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

    console.log('[materialize-tasks] Starting task materialization...');

    // Get all active schedules
    const { data: schedules, error: schedError } = await supabase
      .from('schedules')
      .select(`
        id,
        type,
        routine_id,
        window_start,
        window_end,
        days_of_week,
        cron_expr,
        shift_name,
        shift_id,
        department_id,
        assignee_role,
        task_routines (
          id,
          title,
          org_id,
          location_id,
          department_id,
          criticality,
          est_minutes
        )
      `)
      .is('archived_at', null);

    if (schedError) throw schedError;

    console.log(`[materialize-tasks] Found ${schedules?.length || 0} active schedules`);

    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    let totalCreated = 0;

    for (const schedule of schedules || []) {
      try {
        // Get the routine details
        const routine: any = schedule.task_routines;
        if (!routine) continue;

        // Determine which location(s) to use
        let targetLocations: any[] = [];
        if (routine.location_id) {
          // Routine is tied to a specific location
          const { data: loc } = await supabase
            .from('locations')
            .select('id, timezone')
            .eq('id', routine.location_id)
            .maybeSingle();
          if (loc) targetLocations = [loc];
        } else {
          // Get all locations for this org
          const { data: locs } = await supabase
            .from('locations')
            .select('id, timezone')
            .eq('org_id', routine.org_id)
            .is('archived_at', null);
          targetLocations = locs || [];
        }

        for (const location of targetLocations) {
          const instances = generateInstances(schedule, location, now, sevenDaysFromNow);
          
          // Check for duplicates and insert
          for (const instance of instances) {
            const { data: existing } = await supabase
              .from('task_instances')
              .select('id')
              .eq('routine_id', schedule.routine_id)
              .eq('location_id', location.id)
              .eq('due_at', instance.due_at)
              .maybeSingle();

            if (!existing) {
              const { error: insertError } = await supabase
                .from('task_instances')
                .insert(instance);

              if (!insertError) {
                totalCreated++;
              } else {
                console.error('[materialize-tasks] Insert error:', insertError);
              }
            }
          }
        }
      } catch (err) {
        console.error(`[materialize-tasks] Error processing schedule ${schedule.id}:`, err);
      }
    }

    console.log(`[materialize-tasks] Created ${totalCreated} new task instances`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        created: totalCreated,
        schedules_processed: schedules?.length || 0
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[materialize-tasks] Fatal error:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function generateInstances(schedule: any, location: any, startDate: Date, endDate: Date): any[] {
  const instances: any[] = [];
  const timezone = location.timezone || 'UTC';

  if (schedule.type === 'window') {
    // Generate instances for window-based schedules
    const daysOfWeek = schedule.days_of_week || [];
    let currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const dayOfWeek = currentDate.getDay();
      if (daysOfWeek.includes(dayOfWeek)) {
        const [startHour, startMin] = schedule.window_start.split(':').map(Number);
        const [endHour, endMin] = schedule.window_end.split(':').map(Number);
        
        const windowStart = new Date(currentDate);
        windowStart.setHours(startHour, startMin, 0, 0);
        
        const windowEnd = new Date(currentDate);
        windowEnd.setHours(endHour, endMin, 0, 0);
        
        const dueAt = new Date(windowEnd);

        instances.push({
          routine_id: schedule.routine_id,
          location_id: location.id,
          department_id: schedule.department_id,
          shift_id: schedule.shift_id,
          due_at: dueAt.toISOString(),
          window_start: windowStart.toISOString(),
          window_end: windowEnd.toISOString(),
          assigned_role: schedule.assignee_role,
          status: 'pending',
          urgency_score: 0.5,
        });
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
  } else if (schedule.type === 'oneoff') {
    // One-off tasks - only create if within window
    if (schedule.window_start) {
      const dueDate = new Date(schedule.window_start);
      if (dueDate >= startDate && dueDate <= endDate) {
        instances.push({
          routine_id: schedule.routine_id,
          location_id: location.id,
          department_id: schedule.department_id,
          shift_id: schedule.shift_id,
          due_at: dueDate.toISOString(),
          window_start: schedule.window_start,
          window_end: schedule.window_end || schedule.window_start,
          assigned_role: schedule.assignee_role,
          status: 'pending',
          urgency_score: 0.5,
        });
      }
    }
  }
  // TODO: Add cron schedule type parsing

  return instances;
}
