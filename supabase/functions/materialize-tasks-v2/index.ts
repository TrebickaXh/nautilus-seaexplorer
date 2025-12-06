import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * New materializer that reads from task_routines.recurrence_v2
 * Generates one task_instance per area per due time
 * Uses org timezone for accurate date calculations
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

    console.log(`[${correlationId}] Starting task materialization v2...`);

    const now = new Date();
    
    // Generate tasks for next 14 days
    const daysAhead = 14;
    let totalCreated = 0;
    let totalSkipped = 0;
    let totalErrors = 0;

    // Fetch active routines with recurrence_v2
    const { data: routines, error: routineError } = await supabase
      .from('task_routines')
      .select(`
        id,
        org_id,
        title,
        description,
        steps,
        est_minutes,
        criticality,
        required_proof,
        department_id,
        shift_id,
        location_id,
        area_ids,
        recurrence_v2,
        active
      `)
      .eq('active', true)
      .not('recurrence_v2', 'is', null)
      .eq('is_deprecated', false);

    if (routineError) {
      console.error(`[${correlationId}] Error fetching routines:`, routineError);
      
      // Log to edge_function_logs
      await supabase.from('edge_function_logs').insert({
        function_name: 'materialize-tasks-v2',
        level: 'error',
        message: 'Failed to fetch routines',
        payload: { error: routineError.message },
        correlation_id: correlationId,
      });
      
      throw routineError;
    }

    console.log(`[${correlationId}] Found ${routines?.length || 0} active routines with recurrence`);

    for (const routine of routines || []) {
      if (!routine.recurrence_v2 || !routine.area_ids || routine.area_ids.length === 0) {
        console.log(`[${correlationId}] Skipping routine ${routine.id}: missing recurrence or areas`);
        continue;
      }

      const recurrence = routine.recurrence_v2;
      
      // Fetch org timezone separately
      const { data: orgData } = await supabase
        .from('organizations')
        .select('timezone')
        .eq('id', routine.org_id)
        .single();
      
      const orgTimezone = orgData?.timezone || 'UTC';
      
      // Generate due times using org timezone
      const dueSlots = generateDueSlots(recurrence, now, daysAhead, orgTimezone);
      
      console.log(`[${correlationId}] Routine ${routine.id}: generated ${dueSlots.length} due slots for ${routine.area_ids.length} areas (TZ: ${orgTimezone})`);

      // For each due slot, create one instance per area
      for (const dueAt of dueSlots) {
        for (const areaId of routine.area_ids) {
          // Insert with ON CONFLICT DO NOTHING (idempotency via unique index)
          const { error: insertError } = await supabase
            .from('task_instances')
            .insert({
              routine_id: routine.id,
              org_id: routine.org_id,
              location_id: routine.location_id,
              department_id: routine.department_id,
              shift_id: routine.shift_id,
              area_id: areaId,
              due_at: dueAt,
              created_from: 'routine',
              status: 'pending',
              // Denormalized snapshot data - changes to routine only affect NEW instances
              denormalized_data: {
                title: routine.title,
                description: routine.description,
                steps: routine.steps,
                est_minutes: routine.est_minutes,
                criticality: routine.criticality,
                required_proof: routine.required_proof,
              }
            })
            .select('id')
            .maybeSingle();

          if (insertError) {
            // Check if it's a duplicate (unique constraint violation)
            if (insertError.code === '23505') {
              totalSkipped++;
            } else {
              console.error(`[${correlationId}] Error inserting instance for routine ${routine.id}:`, insertError);
              totalErrors++;
            }
          } else {
            totalCreated++;
          }
        }
      }
    }

    console.log(`[${correlationId}] Materialization complete: ${totalCreated} created, ${totalSkipped} skipped (duplicates), ${totalErrors} errors`);

    // Log success summary
    await supabase.from('edge_function_logs').insert({
      function_name: 'materialize-tasks-v2',
      level: 'info',
      message: 'Materialization completed',
      payload: { 
        created: totalCreated, 
        skipped: totalSkipped, 
        errors: totalErrors,
        routines_processed: routines?.length || 0
      },
      correlation_id: correlationId,
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        created: totalCreated,
        skipped: totalSkipped,
        errors: totalErrors,
        routines_processed: routines?.length || 0,
        correlation_id: correlationId
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error: any) {
    console.error(`[${correlationId}] Materialization error:`, error);
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message,
        code: 'MATERIALIZATION_FAILED',
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
 * Generate due timestamps based on recurrence rules
 * Uses org timezone for accurate date/time calculations
 */
function generateDueSlots(
  recurrence: any,
  startDate: Date,
  daysAhead: number,
  timezone: string
): string[] {
  const slots: string[] = [];
  const type = recurrence.type;
  
  // Support both formats: time_of_day (legacy) and time_slots (new from onboarding)
  const timeSlots: string[] = [];
  
  if (recurrence.time_slots && Array.isArray(recurrence.time_slots)) {
    timeSlots.push(...recurrence.time_slots);
  } else if (recurrence.time_of_day) {
    timeSlots.push(recurrence.time_of_day);
  } else {
    console.error('Missing time_of_day or time_slots in recurrence');
    return slots;
  }

  // Generate slots for each time
  for (const timeOfDay of timeSlots) {
    const [hours, minutes] = timeOfDay.split(':').map(Number);

    switch (type) {
    case 'daily': {
      for (let i = 0; i < daysAhead; i++) {
        const dueAt = createDateInTimezone(startDate, i, hours, minutes, timezone);
        
        // Check start_date and end_date if provided
        if (recurrence.start_date && dueAt < new Date(recurrence.start_date)) continue;
        if (recurrence.end_date && dueAt > new Date(recurrence.end_date)) break;
        
        slots.push(dueAt.toISOString());
      }
      break;
    }

    case 'weekly': {
      const daysOfWeek = recurrence.days_of_week || [];
      
      for (let i = 0; i < daysAhead; i++) {
        const dueAt = createDateInTimezone(startDate, i, hours, minutes, timezone);
        const dayOfWeek = getDayOfWeekInTimezone(dueAt, timezone);
        
        if (daysOfWeek.includes(dayOfWeek)) {
          if (recurrence.start_date && dueAt < new Date(recurrence.start_date)) continue;
          if (recurrence.end_date && dueAt > new Date(recurrence.end_date)) break;
          
          slots.push(dueAt.toISOString());
        }
      }
      break;
    }

    case 'custom_weeks': {
      const intervalWeeks = recurrence.interval_weeks || 2;
      const daysOfWeek = recurrence.days_of_week || [];
      const referenceDate = recurrence.start_date ? new Date(recurrence.start_date) : startDate;
      
      for (let i = 0; i < daysAhead; i++) {
        const dueAt = createDateInTimezone(startDate, i, hours, minutes, timezone);
        const weeksDiff = Math.floor((dueAt.getTime() - referenceDate.getTime()) / (7 * 24 * 60 * 60 * 1000));
        const dayOfWeek = getDayOfWeekInTimezone(dueAt, timezone);
        
        if (weeksDiff % intervalWeeks === 0 && daysOfWeek.includes(dayOfWeek)) {
          if (recurrence.end_date && dueAt > new Date(recurrence.end_date)) break;
          
          slots.push(dueAt.toISOString());
        }
      }
      break;
    }

    case 'monthly': {
      const dayOfMonth = recurrence.day_of_month || 1;
      
      for (let i = 0; i < daysAhead; i++) {
        const dueAt = createDateInTimezone(startDate, i, hours, minutes, timezone);
        const dateInTz = getDateInTimezone(dueAt, timezone);
        
        if (dateInTz === dayOfMonth) {
          if (recurrence.start_date && dueAt < new Date(recurrence.start_date)) continue;
          if (recurrence.end_date && dueAt > new Date(recurrence.end_date)) break;
          
          slots.push(dueAt.toISOString());
        }
      }
      break;
    }

    case 'oneoff': {
      const dueAt = createDateInTimezone(startDate, 0, hours, minutes, timezone);
      slots.push(dueAt.toISOString());
      break;
    }

    default:
      console.error(`Unknown recurrence type: ${type}`);
    }
  }

  return slots;
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
  // Get the date string in the target timezone
  const targetDate = new Date(baseDate);
  targetDate.setDate(targetDate.getDate() + daysOffset);
  
  // Format to get the local date in the timezone
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const localDateStr = formatter.format(targetDate);
  
  // Create the full datetime string
  const timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`;
  const fullDateTimeStr = `${localDateStr}T${timeStr}`;
  
  // Parse as if it's in UTC first
  const tempDate = new Date(fullDateTimeStr + 'Z');
  
  // Calculate the offset for the target timezone
  const utcDate = new Date(tempDate.toLocaleString('en-US', { timeZone: 'UTC' }));
  const tzDate = new Date(tempDate.toLocaleString('en-US', { timeZone: timezone }));
  const offsetMs = utcDate.getTime() - tzDate.getTime();
  
  // Apply the offset to get the correct UTC time
  return new Date(tempDate.getTime() - offsetMs);
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
 * Get day of month in a specific timezone
 */
function getDateInTimezone(date: Date, timezone: string): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    day: 'numeric',
  });
  return parseInt(formatter.format(date), 10);
}
