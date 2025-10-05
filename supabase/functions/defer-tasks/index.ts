import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Auto-deferral service
 * Runs at/after shift end to defer incomplete tasks
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Starting auto-deferral process...');

    const now = new Date();
    const today = now.toISOString().split('T')[0]; // YYYY-MM-DD
    let totalDeferred = 0;

    // Find all shifts that have ended today
    const { data: shifts, error: shiftError } = await supabase
      .from('shifts')
      .select(`
        id,
        name,
        end_time,
        department_id,
        location_id,
        days_of_week
      `)
      .not('archived_at', 'is', null);

    if (shiftError) {
      console.error('Error fetching shifts:', shiftError);
      throw shiftError;
    }

    for (const shift of shifts || []) {
      // Check if shift applies to today
      const dayOfWeek = now.getDay();
      if (!shift.days_of_week.includes(dayOfWeek)) {
        continue;
      }

      // Parse end_time (HH:MM:SS format)
      const [endHours, endMinutes] = shift.end_time.split(':').map(Number);
      const shiftEndToday = new Date(today);
      shiftEndToday.setHours(endHours, endMinutes, 0, 0);

      // Only process if shift has ended
      if (now < shiftEndToday) {
        continue;
      }

      console.log(`Processing shift ${shift.name} (ended at ${shift.end_time})`);

      // Find incomplete tasks for this shift that are overdue
      const { data: incompleteTasks, error: taskError } = await supabase
        .from('task_instances')
        .select(`
          id,
          routine_id,
          due_at,
          area_id,
          department_id,
          shift_id,
          location_id,
          org_id
        `)
        .eq('shift_id', shift.id)
        .eq('status', 'pending')
        .lte('due_at', now.toISOString());

      if (taskError) {
        console.error(`Error fetching tasks for shift ${shift.id}:`, taskError);
        continue;
      }

      console.log(`Found ${incompleteTasks?.length || 0} incomplete tasks for shift ${shift.name}`);

      // Defer each task
      for (const task of incompleteTasks || []) {
        // Find next occurrence of this shift
        const nextShiftDate = findNextShiftOccurrence(shift, now);
        
        if (!task.routine_id) {
          console.log(`Task ${task.id} is one-off, skipping auto-deferral`);
          continue;
        }

        // Get routine to find time_of_day
        const { data: routine } = await supabase
          .from('task_routines')
          .select('recurrence_v2')
          .eq('id', task.routine_id)
          .single();

        if (!routine?.recurrence_v2?.time_of_day) {
          console.log(`Task ${task.id} routine missing time_of_day`);
          continue;
        }

        const [hours, minutes] = routine.recurrence_v2.time_of_day.split(':').map(Number);
        const newDueAt = new Date(nextShiftDate);
        newDueAt.setHours(hours, minutes, 0, 0);

        // Create completion record for deferral
        const { error: completionError } = await supabase
          .from('completions')
          .insert({
            task_instance_id: task.id,
            user_id: null, // System action
            outcome: 'deferred',
            outcome_reason: 'auto: shift ended',
            defer_settings: {
              auto: true,
              original_due_at: task.due_at,
              new_due_at: newDueAt.toISOString(),
              deferred_at: now.toISOString(),
            }
          });

        if (completionError) {
          console.error(`Error creating completion for task ${task.id}:`, completionError);
          continue;
        }

        // Update task instance
        const { error: updateError } = await supabase
          .from('task_instances')
          .update({
            due_at: newDueAt.toISOString(),
            status: 'pending', // Remains actionable
          })
          .eq('id', task.id);

        if (updateError) {
          console.error(`Error updating task ${task.id}:`, updateError);
          continue;
        }

        totalDeferred++;
        console.log(`Deferred task ${task.id} to ${newDueAt.toISOString()}`);
      }
    }

    console.log(`Auto-deferral complete: ${totalDeferred} tasks deferred`);

    return new Response(
      JSON.stringify({ 
        success: true,
        deferred: totalDeferred
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error: any) {
    console.error('Auto-deferral error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

/**
 * Find next occurrence of a shift (next valid day)
 */
function findNextShiftOccurrence(shift: any, fromDate: Date): Date {
  const daysOfWeek = shift.days_of_week || [];
  let checkDate = new Date(fromDate);
  checkDate.setDate(checkDate.getDate() + 1); // Start from tomorrow

  for (let i = 0; i < 14; i++) { // Check up to 2 weeks ahead
    const dayOfWeek = checkDate.getDay();
    if (daysOfWeek.includes(dayOfWeek)) {
      return checkDate;
    }
    checkDate.setDate(checkDate.getDate() + 1);
  }

  // Fallback: return tomorrow if no match found
  const tomorrow = new Date(fromDate);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow;
}
