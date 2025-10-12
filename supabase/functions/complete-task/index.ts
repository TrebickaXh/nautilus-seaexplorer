import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CompleteTaskRequest {
  taskInstanceId: string;
  userId: string;
  pin: string;
  outcome?: 'completed' | 'skipped';
  note?: string;
  photoUrl?: string;
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

    const { taskInstanceId, userId, pin, outcome = 'completed', note, photoUrl }: CompleteTaskRequest = await req.json();

    // Validate required fields
    if (!taskInstanceId || !userId || !pin) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Completing task ${taskInstanceId} for user ${userId}`);

    // Get the selected user's PIN hash and org_id
    const { data: userProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('pin_hash, display_name, org_id')
      .eq('id', userId)
      .single();

    if (profileError || !userProfile) {
      console.error('User not found:', profileError);
      return new Response(
        JSON.stringify({ error: 'User not found' }), 
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!userProfile.pin_hash) {
      console.error('User does not have a PIN set');
      return new Response(
        JSON.stringify({ error: 'This team member does not have a PIN set' }), 
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the PIN against the selected user's PIN hash (SHA-256)
    const encoder = new TextEncoder();
    const data = encoder.encode(pin);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const pinHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    if (pinHash !== userProfile.pin_hash) {
      console.error('Invalid PIN for selected user:', { userId, displayName: userProfile.display_name });
      return new Response(
        JSON.stringify({ error: 'Invalid PIN for the selected team member' }), 
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`PIN verified for user: ${userProfile.display_name}`);

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
    const { data: location } = await supabaseAdmin
      .from('locations')
      .select('org_id')
      .eq('id', task.location_id)
      .single();

    if (!location || location.org_id !== userProfile.org_id) {
      return new Response(
        JSON.stringify({ error: 'User cannot complete tasks from different organization' }), 
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Insert completion record
    const { error: completionError } = await supabaseAdmin
      .from('completions')
      .insert({
        task_instance_id: taskInstanceId,
        user_id: userId,
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

    console.log(`Task ${taskInstanceId} completed successfully by user ${userId}`);

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