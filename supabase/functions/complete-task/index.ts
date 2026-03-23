import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CompleteTaskRequest {
  taskInstanceId?: string;
  task_instance_id?: string;
  userId?: string;
  user_id?: string;
  displayName?: string;
  display_name?: string;
  pin: string;
  outcome?: 'completed' | 'skipped';
  note?: string;
  photoUrl?: string;
  photo_url?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const requestBody: CompleteTaskRequest = await req.json();
    const taskInstanceId = requestBody.taskInstanceId ?? requestBody.task_instance_id;
    const providedUserId = requestBody.userId ?? requestBody.user_id;
    const providedDisplayName = requestBody.displayName?.trim() ?? requestBody.display_name?.trim();
    const pin = requestBody.pin;
    const outcome = requestBody.outcome ?? 'completed';
    const note = requestBody.note;
    const photoUrl = requestBody.photoUrl ?? requestBody.photo_url;

    // Validate required fields
    if (!taskInstanceId || !pin || (!providedUserId && !providedDisplayName)) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!/^\d{4,6}$/.test(pin)) {
      return new Response(
        JSON.stringify({ error: 'PIN must be 4 to 6 digits' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Completing task ${taskInstanceId} for user ${providedUserId ?? providedDisplayName}`);

    // Get task details
    const { data: task, error: taskError } = await supabaseAdmin
      .from('task_instances')
      .select('id, status, location_id')
      .eq('id', taskInstanceId)
      .single();

    if (taskError || !task) {
      console.error('Task not found:', taskError);
      return new Response(
        JSON.stringify({ error: 'Task not found' }), 
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (task.status !== 'pending') {
      return new Response(
        JSON.stringify({ error: 'Task is not pending' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user belongs to the same org as the task location
    const { data: location, error: locationError } = await supabaseAdmin
      .from('locations')
      .select('org_id')
      .eq('id', task.location_id)
      .single();

    if (locationError || !location) {
      console.error('Task location not found:', locationError);
      return new Response(
        JSON.stringify({ error: 'Task location not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let userProfile: {
      id: string;
      pin_hash: string | null;
      display_name: string;
      org_id: string;
      pin_attempts: number | null;
      pin_locked_until: string | null;
    } | null = null;

    if (providedUserId) {
      const { data: profileById, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('id, pin_hash, display_name, org_id, pin_attempts, pin_locked_until')
        .eq('id', providedUserId)
        .single();

      if (profileError || !profileById) {
        console.error('User not found by id:', profileError);
        return new Response(
          JSON.stringify({ error: 'Selected team member not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      userProfile = profileById;
    } else if (providedDisplayName) {
      const { data: matchingProfiles, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('id, pin_hash, display_name, org_id, pin_attempts, pin_locked_until')
        .eq('display_name', providedDisplayName)
        .eq('org_id', location.org_id)
        .eq('active', true)
        .limit(2);

      if (profileError) {
        console.error('Error finding team member by display name:', profileError);
        return new Response(
          JSON.stringify({ error: 'Failed to find selected team member' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!matchingProfiles || matchingProfiles.length === 0) {
        return new Response(
          JSON.stringify({ error: 'Selected team member not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (matchingProfiles.length > 1) {
        return new Response(
          JSON.stringify({ error: 'Multiple team members share this name. Please select the exact team member.' }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      userProfile = matchingProfiles[0];
    }

    if (!userProfile) {
      return new Response(
        JSON.stringify({ error: 'Selected team member not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (location.org_id !== userProfile.org_id) {
      return new Response(
        JSON.stringify({ error: 'User cannot complete tasks from different organization' }), 
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!userProfile.pin_hash) {
      console.error('User does not have a PIN set');
      return new Response(
        JSON.stringify({ error: 'This team member does not have a PIN set' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const now = new Date();
    if (userProfile.pin_locked_until && new Date(userProfile.pin_locked_until) > now) {
      return new Response(
        JSON.stringify({ error: 'PIN is temporarily locked. Please try again in a few minutes.' }),
        { status: 423, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (userProfile.pin_locked_until && new Date(userProfile.pin_locked_until) <= now) {
      await supabaseAdmin
        .from('profiles')
        .update({ pin_attempts: 0, pin_locked_until: null })
        .eq('id', userProfile.id);
    }

    // Verify the PIN against the selected user's PIN hash (SHA-256)
    const encoder = new TextEncoder();
    const pinData = encoder.encode(pin);
    const hashBuffer = await crypto.subtle.digest('SHA-256', pinData);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const pinHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    if (pinHash !== userProfile.pin_hash) {
      const currentAttempts = userProfile.pin_attempts ?? 0;
      const updatedAttempts = currentAttempts + 1;
      const shouldLock = updatedAttempts >= 5;
      const pin_locked_until = shouldLock
        ? new Date(Date.now() + 15 * 60 * 1000).toISOString()
        : null;

      await supabaseAdmin
        .from('profiles')
        .update({ pin_attempts: updatedAttempts, pin_locked_until })
        .eq('id', userProfile.id);

      if (shouldLock) {
        return new Response(
          JSON.stringify({ error: 'Too many incorrect PIN attempts. Account locked for 15 minutes.' }),
          { status: 423, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const remainingAttempts = Math.max(0, 5 - updatedAttempts);
      return new Response(
        JSON.stringify({
          error: `Invalid PIN for the selected team member. ${remainingAttempts} attempt${remainingAttempts === 1 ? '' : 's'} remaining.`
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if ((userProfile.pin_attempts ?? 0) > 0 || userProfile.pin_locked_until) {
      await supabaseAdmin
        .from('profiles')
        .update({ pin_attempts: 0, pin_locked_until: null })
        .eq('id', userProfile.id);
    }

    console.log(`PIN verified for user: ${userProfile.display_name}`);

    // Insert completion record
    const { error: completionError } = await supabaseAdmin
      .from('completions')
      .insert({
        task_instance_id: taskInstanceId,
          user_id: userProfile.id,
        outcome: outcome,
        note: note || null,
        photo_url: photoUrl || null
      });

    if (completionError) {
      console.error('Error creating completion:', completionError);
      return new Response(
        JSON.stringify({ error: 'Failed to record completion' }), 
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update task instance status
    const { error: updateError } = await supabaseAdmin
      .from('task_instances')
      .update({ 
        status: 'done',
        completed_at: new Date().toISOString()
      })
      .eq('id', taskInstanceId);

    if (updateError) {
      console.error('Error updating task status:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update task status' }), 
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Task ${taskInstanceId} completed successfully by user ${userProfile.id}`);

    return new Response(
      JSON.stringify({ success: true }), 
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Unexpected error in complete-task function:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});