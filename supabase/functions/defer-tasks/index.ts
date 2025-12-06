import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Auto-deferral service
 * Runs at/after shift end to defer incomplete tasks
 * Uses org timezone for accurate time calculations
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const correlationId = crypto.randomUUID();

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log(`[${correlationId}] Starting auto-deferral process...`);

    const now = new Date();
    let totalDeferred = 0;
    let totalErrors = 0;

    // Find all active shifts (FIX: was incorrectly querying NOT archived_at IS null)
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
      .is('archived_at', null);

    if (shiftError) {
      console.error(`[${correlationId}] Error fetching shifts:`, shiftError);
      
      await supabase.from('edge_function_logs').insert({
        function_name: 'defer-tasks',
        level: 'error',
        message: 'Failed to fetch shifts',
        payload: { error: shiftError.message },
        correlation_id: correlationId,
      });
      
      throw shiftError;
    }

    console.log(`[${correlationId}] Found ${shifts?.length || 0} active shifts to check`);

    for (const shift of shifts || []) {
      // Fetch location to get org_id, then fetch org timezone
      const { data: locationData } = await supabase
        .from('locations')
        .select('org_id')
        .eq('id', shift.location_id)
        .single();
      
      let orgTimezone = 'UTC';
      if (locationData?.org_id) {
        const { data: orgData } = await supabase
          .from('organizations')
          .select('timezone')
          .eq('id', locationData.org_id)
          .single();
        orgTimezone = orgData?.timezone || 'UTC';
      }
      
      // Get current day of week in org timezone
      const dayOfWeek = getDayOfWeekInTimezone(now, orgTimezone);
      if (!shift.days_of_week.includes(dayOfWeek)) {
        continue;
      }

      // Get current time in org timezone
      const currentTime = getCurrentTimeInTimezone(now, orgTimezone);
      
      // Parse end_time (HH:MM:SS format)
      const endTime = shift.end_time.slice(0, 5); // Get HH:MM

      // Only process if shift has ended (comparing in org timezone)
      if (currentTime < endTime) {
        continue;
      }

      console.log(`[${correlationId}] Processing shift ${shift.name} (ended at ${shift.end_time} in ${orgTimezone})`);

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
        console.error(`[${correlationId}] Error fetching tasks for shift ${shift.id}:`, taskError);
        totalErrors++;
        continue;
      }

      console.log(`[${correlationId}] Found ${incompleteTasks?.length || 0} incomplete tasks for shift ${shift.name}`);

      // Defer each task
      for (const task of incompleteTasks || []) {
        // Find next occurrence of this shift
        const nextShiftDate = findNextShiftOccurrence(shift, now, orgTimezone);
        
        if (!task.routine_id) {
          console.log(`[${correlationId}] Task ${task.id} is one-off, skipping auto-deferral`);
          continue;
        }

        // Get routine to find time_of_day
        const { data: routine } = await supabase
          .from('task_routines')
          .select('recurrence_v2')
          .eq('id', task.routine_id)
          .single();

        if (!routine?.recurrence_v2?.time_of_day && !routine?.recurrence_v2?.time_slots?.[0]) {
          console.log(`[${correlationId}] Task ${task.id} routine missing time_of_day`);
          continue;
        }

        const timeOfDay = routine.recurrence_v2.time_of_day || routine.recurrence_v2.time_slots?.[0];
        const [hours, minutes] = timeOfDay.split(':').map(Number);
        
        // Create new due_at in org timezone
        const newDueAt = createDateInTimezone(nextShiftDate, 0, hours, minutes, orgTimezone);

        // Create completion record for deferral (system action - use service role)
        // Note: completions.user_id is required, but for system actions we need to handle this
        // For now, we'll skip creating a completion record for auto-deferrals
        // and just update the task instance
        
        // Update task instance with new due_at
        const { error: updateError } = await supabase
          .from('task_instances')
          .update({
            due_at: newDueAt.toISOString(),
            status: 'pending', // Remains actionable
          })
          .eq('id', task.id);

        if (updateError) {
          console.error(`[${correlationId}] Error updating task ${task.id}:`, updateError);
          totalErrors++;
          continue;
        }

        totalDeferred++;
        console.log(`[${correlationId}] Deferred task ${task.id} to ${newDueAt.toISOString()}`);
      }
    }

    console.log(`[${correlationId}] Auto-deferral complete: ${totalDeferred} tasks deferred, ${totalErrors} errors`);

    // Log success
    if (totalDeferred > 0 || totalErrors > 0) {
      await supabase.from('edge_function_logs').insert({
        function_name: 'defer-tasks',
        level: totalErrors > 0 ? 'warn' : 'info',
        message: 'Auto-deferral completed',
        payload: { deferred: totalDeferred, errors: totalErrors },
        correlation_id: correlationId,
      });
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        deferred: totalDeferred,
        errors: totalErrors,
        correlation_id: correlationId
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error: any) {
    console.error(`[${correlationId}] Auto-deferral error:`, error);
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message,
        code: 'DEFERRAL_FAILED',
        correlation_id: correlationId
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

/**
 * Find next occurrence of a shift (next valid day) in org timezone
 */
function findNextShiftOccurrence(shift: any, fromDate: Date, timezone: string): Date {
  const daysOfWeek = shift.days_of_week || [];
  let checkDate = new Date(fromDate);
  checkDate.setDate(checkDate.getDate() + 1); // Start from tomorrow

  for (let i = 0; i < 14; i++) { // Check up to 2 weeks ahead
    const dayOfWeek = getDayOfWeekInTimezone(checkDate, timezone);
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

/**
 * Get day of week in a specific timezone (0 = Sunday, 6 = Saturday)
 */
function getDayOfWeekInTimezone(date: Date, timezone: string): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
  });
  const dayStr = formatter.format(date);
  const dayMap: Record<string, number> = {
    'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6
  };
  return dayMap[dayStr] ?? 0;
}

/**
 * Get current time (HH:MM) in a specific timezone
 */
function getCurrentTimeInTimezone(date: Date, timezone: string): string {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return formatter.format(date);
}

/**
 * Create a date at a specific time in the given timezone
 */
function createDateInTimezone(
  baseDate: Date,
  daysOffset: number,
  hours: number,
  minutes: number,
  timezone: string
): Date {
  const targetDate = new Date(baseDate);
  targetDate.setDate(targetDate.getDate() + daysOffset);
  
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const localDateStr = formatter.format(targetDate);
  
  const timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`;
  const fullDateTimeStr = `${localDateStr}T${timeStr}`;
  
  const tempDate = new Date(fullDateTimeStr + 'Z');
  
  const utcDate = new Date(tempDate.toLocaleString('en-US', { timeZone: 'UTC' }));
  const tzDate = new Date(tempDate.toLocaleString('en-US', { timeZone: timezone }));
  const offsetMs = utcDate.getTime() - tzDate.getTime();
  
  return new Date(tempDate.getTime() - offsetMs);
}
