import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate the caller
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const anonClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = claimsData.claims.sub as string;

    // Service role client for all writes (bypasses RLS)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // --- Idempotency check ---
    const PLACEHOLDER = '00000000-0000-0000-0000-000000000000';
    const { data: profile } = await supabase
      .from('profiles')
      .select('org_id')
      .eq('id', userId)
      .single();

    if (profile && profile.org_id && profile.org_id !== PLACEHOLDER) {
      // Already set up — return existing org
      return new Response(
        JSON.stringify({ success: true, orgId: profile.org_id, alreadyExists: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // --- Parse payload ---
    const {
      orgName,
      timezone,
      industry,
      locationName,
      departmentName,
      shiftName,
      shiftStart,
      shiftEnd,
      shiftDays,
      taskRoutines,
    } = await req.json();

    // Basic validation
    if (!orgName?.trim() || !timezone || !locationName?.trim() || !departmentName?.trim() ||
        !shiftName?.trim() || !shiftStart || !shiftEnd || !shiftDays?.length) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let createdOrgId: string | null = null;

    try {
      // 1. Create organization
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .insert({
          name: orgName.trim(),
          timezone,
          settings: { industry },
        })
        .select('id')
        .single();
      if (orgError) throw orgError;
      createdOrgId = org.id;

      // 2. Update user profile with org_id
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ org_id: org.id })
        .eq('id', userId);
      if (profileError) throw profileError;

      // 3. Assign org_admin role
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({ user_id: userId, role: 'org_admin' });
      if (roleError) throw roleError;

      // 4. Create location
      const { data: location, error: locError } = await supabase
        .from('locations')
        .insert({ org_id: org.id, name: locationName.trim() })
        .select('id')
        .single();
      if (locError) throw locError;

      // 5. Create department
      const { data: department, error: deptError } = await supabase
        .from('departments')
        .insert({ location_id: location.id, name: departmentName.trim() })
        .select('id')
        .single();
      if (deptError) throw deptError;

      // 6. Create shift
      const { data: shift, error: shiftError } = await supabase
        .from('shifts')
        .insert({
          location_id: location.id,
          department_id: department.id,
          name: shiftName.trim(),
          start_time: shiftStart,
          end_time: shiftEnd,
          days_of_week: shiftDays,
        })
        .select('id')
        .single();
      if (shiftError) throw shiftError;

      // 7. Create task routines
      if (taskRoutines && taskRoutines.length > 0) {
        const routineRows = taskRoutines.map((r: any) => ({
          org_id: org.id,
          location_id: location.id,
          department_id: department.id,
          shift_id: shift.id,
          title: r.title,
          description: r.description || null,
          steps: r.steps || [],
          est_minutes: r.est_minutes || 15,
          criticality: r.criticality || 3,
          required_proof: r.required_proof || 'none',
          active: true,
          recurrence_v2: r.recurrence_v2 || { type: 'daily' },
        }));

        const { error: routineError } = await supabase
          .from('task_routines')
          .insert(routineRows);
        if (routineError) throw routineError;
      }

      return new Response(
        JSON.stringify({ success: true, orgId: org.id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (innerError: any) {
      // Rollback: delete the org (cascading deletes will clean up locations, etc. if FK cascades exist)
      // Otherwise do best-effort cleanup
      if (createdOrgId) {
        console.error(`Setup failed, cleaning up org ${createdOrgId}:`, innerError.message);

        // Reset profile back to placeholder
        await supabase.from('profiles').update({ org_id: PLACEHOLDER }).eq('id', userId).catch(() => {});
        // Remove role assignment
        await supabase.from('user_roles').delete().eq('user_id', userId).eq('role', 'org_admin').catch(() => {});
        // Delete task_routines, shifts, departments, locations for this org
        await supabase.from('task_routines').delete().eq('org_id', createdOrgId).catch(() => {});
        // Shifts/departments are linked via locations — get location ids first
        const { data: locs } = await supabase.from('locations').select('id').eq('org_id', createdOrgId);
        if (locs) {
          for (const loc of locs) {
            await supabase.from('shifts').delete().eq('location_id', loc.id).catch(() => {});
            await supabase.from('departments').delete().eq('location_id', loc.id).catch(() => {});
          }
        }
        await supabase.from('locations').delete().eq('org_id', createdOrgId).catch(() => {});
        // Finally delete the org
        await supabase.from('organizations').delete().eq('id', createdOrgId).catch(() => {});
      }

      throw innerError;
    }

  } catch (error: any) {
    console.error('create-organization error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Setup failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
