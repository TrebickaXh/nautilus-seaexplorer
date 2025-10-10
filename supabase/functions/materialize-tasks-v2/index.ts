import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * New materializer that reads from task_routines.recurrence_v2
 * Generates one task_instance per area per due time
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

    console.log('Starting task materialization v2...');

    // Get system timezone from org (default UTC)
    const systemTz = Deno.env.get('SYSTEM_TZ') || 'UTC';
    const now = new Date();
    
    // Generate tasks for next 14 days
    const daysAhead = 14;
    let totalCreated = 0;
    let totalSkipped = 0;

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
      console.error('Error fetching routines:', routineError);
      throw routineError;
    }

    console.log(`Found ${routines?.length || 0} active routines with recurrence`);

    for (const routine of routines || []) {
      if (!routine.recurrence_v2 || !routine.area_ids || routine.area_ids.length === 0) {
        console.log(`Skipping routine ${routine.id}: missing recurrence or areas`);
        continue;
      }

      const recurrence = routine.recurrence_v2;
      
      // Generate due times for the next N days
      const dueSlots = generateDueSlots(recurrence, now, daysAhead, systemTz);
      
      console.log(`Routine ${routine.id}: generated ${dueSlots.length} due slots for ${routine.area_ids.length} areas`);

      // For each due slot, create one instance per area
      for (const dueAt of dueSlots) {
        for (const areaId of routine.area_ids) {
          // Insert with ON CONFLICT DO NOTHING (idempotency via unique index)
          const { error: insertError } = await supabase
            .from('task_instances')
            .insert({
              routine_id: routine.id,
              location_id: routine.location_id,
              department_id: routine.department_id,
              shift_id: routine.shift_id,
              area_id: areaId,
              due_at: dueAt,
              created_from: 'routine',
              status: 'pending',
              // Denormalized snapshot data
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
              console.error(`Error inserting instance for routine ${routine.id}:`, insertError);
            }
          } else {
            totalCreated++;
          }
        }
      }
    }

    console.log(`Materialization complete: ${totalCreated} created, ${totalSkipped} skipped (duplicates)`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        created: totalCreated,
        skipped: totalSkipped,
        routines_processed: routines?.length || 0
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error: any) {
    console.error('Materialization error:', error);
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
 * Generate due timestamps based on recurrence rules
 * Supports both time_of_day (legacy) and time_slots (new format from onboarding)
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
    // New format: array of time slots
    timeSlots.push(...recurrence.time_slots);
  } else if (recurrence.time_of_day) {
    // Legacy format: single time_of_day
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
      // Every day at specified time
      for (let i = 0; i < daysAhead; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
        date.setHours(hours, minutes, 0, 0);
        
        // Check start_date and end_date if provided
        if (recurrence.start_date && date < new Date(recurrence.start_date)) continue;
        if (recurrence.end_date && date > new Date(recurrence.end_date)) break;
        
        slots.push(date.toISOString());
      }
      break;
    }

    case 'weekly': {
      // Specific days of week
      const daysOfWeek = recurrence.days_of_week || []; // [0=Sun, 1=Mon, ..., 6=Sat]
      
      for (let i = 0; i < daysAhead; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
        
        const dayOfWeek = date.getDay();
        if (daysOfWeek.includes(dayOfWeek)) {
          date.setHours(hours, minutes, 0, 0);
          
          if (recurrence.start_date && date < new Date(recurrence.start_date)) continue;
          if (recurrence.end_date && date > new Date(recurrence.end_date)) break;
          
          slots.push(date.toISOString());
        }
      }
      break;
    }

    case 'custom_weeks': {
      // Every N weeks on specific days
      const intervalWeeks = recurrence.interval_weeks || 2;
      const daysOfWeek = recurrence.days_of_week || [];
      const referenceDate = recurrence.start_date ? new Date(recurrence.start_date) : startDate;
      
      for (let i = 0; i < daysAhead; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
        
        const weeksDiff = Math.floor((date.getTime() - referenceDate.getTime()) / (7 * 24 * 60 * 60 * 1000));
        const dayOfWeek = date.getDay();
        
        if (weeksDiff % intervalWeeks === 0 && daysOfWeek.includes(dayOfWeek)) {
          date.setHours(hours, minutes, 0, 0);
          
          if (recurrence.end_date && date > new Date(recurrence.end_date)) break;
          
          slots.push(date.toISOString());
        }
      }
      break;
    }

    case 'monthly': {
      // Specific day of month
      const dayOfMonth = recurrence.day_of_month || 1;
      
      for (let i = 0; i < daysAhead; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
        
        if (date.getDate() === dayOfMonth) {
          date.setHours(hours, minutes, 0, 0);
          
          if (recurrence.start_date && date < new Date(recurrence.start_date)) continue;
          if (recurrence.end_date && date > new Date(recurrence.end_date)) break;
          
          slots.push(date.toISOString());
        }
      }
      break;
    }

    case 'oneoff': {
      // Single occurrence - should not be in routines, but handle gracefully
      const date = new Date(startDate);
      date.setHours(hours, minutes, 0, 0);
      slots.push(date.toISOString());
      break;
    }

    default:
      console.error(`Unknown recurrence type: ${type}`);
    }
  }

  return slots;
}
