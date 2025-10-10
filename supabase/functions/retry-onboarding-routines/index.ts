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
    const { sessionId } = await req.json();
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get onboarding session
    const { data: session, error: sessionError } = await supabase
      .from("onboarding_sessions")
      .select("*")
      .eq("id", sessionId)
      .single();

    if (sessionError || !session) {
      throw new Error("Session not found");
    }

    const config = session.generated_config;
    if (!config) {
      throw new Error("No config found in session");
    }

    // Get user's org
    const { data: profile } = await supabase
      .from("profiles")
      .select("org_id")
      .eq("id", session.user_id)
      .single();

    if (!profile?.org_id) {
      throw new Error("User has no org");
    }

    // Build maps for lookups
    const { data: locations } = await supabase
      .from("locations")
      .select("id, name")
      .eq("org_id", profile.org_id);

    const locationMap: Record<string, string> = {};
    (locations || []).forEach((loc: any) => {
      locationMap[loc.name] = loc.id;
    });

    const { data: departments } = await supabase
      .from("departments")
      .select("id, name")
      .eq("location_id", locations?.[0]?.id);

    const departmentMap: Record<string, string> = {};
    (departments || []).forEach((dept: any) => {
      departmentMap[dept.name] = dept.id;
    });

    const { data: shifts } = await supabase
      .from("shifts")
      .select("id, name")
      .eq("location_id", locations?.[0]?.id);

    const shiftMap: Record<string, string> = {};
    (shifts || []).forEach((shift: any) => {
      shiftMap[shift.name] = shift.id;
    });

    const { data: areas } = await supabase
      .from("areas")
      .select("id, name")
      .eq("location_id", locations?.[0]?.id);

    const areaMap: Record<string, string> = {};
    (areas || []).forEach((area: any) => {
      areaMap[area.name] = area.id;
    });

    console.log('Available departments:', Object.keys(departmentMap));
    console.log('Available locations:', Object.keys(locationMap));
    console.log('Available shifts:', Object.keys(shiftMap));
    console.log('Available areas:', Object.keys(areaMap));

    // Create task routines
    const results = [];
    for (const routine of config.taskRoutines || []) {
      const departmentId = departmentMap[routine.departmentName];
      const shiftId = shiftMap[routine.shiftName];
      const locationId = locationMap[routine.locationName];
      const areaIds = (routine.areaNames || []).map((n: string) => areaMap[n]).filter(Boolean);

      console.log(`Routine "${routine.title}": dept="${routine.departmentName}" (${departmentId ? 'found' : 'MISSING'}), loc="${routine.locationName}" (${locationId ? 'found' : 'MISSING'}), shift="${routine.shiftName}" (${shiftId ? 'found' : 'MISSING'}), areas="${routine.areaNames?.join(', ')}" (matched ${areaIds.length})`);

      if (!departmentId || !locationId) {
        console.error(`Skipping routine "${routine.title}" due to missing department or location`);
        results.push({ title: routine.title, status: 'skipped', reason: 'missing department or location' });
        continue;
      }

      const { error: routineError } = await supabase
        .from("task_routines")
        .insert({
          org_id: profile.org_id,
          location_id: locationId,
          department_id: departmentId,
          shift_id: shiftId || null,
          title: routine.title,
          description: routine.description || null,
          steps: routine.steps || [],
          area_ids: areaIds,
          recurrence_v2: routine.recurrence_v2,
          est_minutes: routine.est_minutes || 15,
          criticality: routine.criticality || 3,
          required_proof: routine.required_proof || 'none',
          active: true
        });

      if (routineError) {
        console.error(`Failed to create routine "${routine.title}":`, routineError);
        results.push({ title: routine.title, status: 'error', error: routineError.message });
      } else {
        console.log(`Created routine: "${routine.title}"`);
        results.push({ title: routine.title, status: 'created' });
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        routinesProcessed: results.length,
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error("Recovery error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
