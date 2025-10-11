import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Hash PIN using Web Crypto API (compatible with Deno Deploy)
async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Compare PIN with hash
async function verifyPin(pin: string, hash: string): Promise<boolean> {
  const pinHash = await hashPin(pin);
  return pinHash === hash;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SetPinRequest {
  userId: string;
  pin: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get authenticated user
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error('Authentication error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }), 
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user is org_admin
    const { data: roles, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    if (roleError || !roles?.some(r => r.role === 'org_admin')) {
      console.error('Authorization error: User is not org_admin');
      return new Response(
        JSON.stringify({ error: 'Forbidden: Only org admins can set PINs' }), 
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { userId, pin } = await req.json() as SetPinRequest;

    // Validate PIN format (4-6 digits)
    if (!/^\d{4,6}$/.test(pin)) {
      return new Response(
        JSON.stringify({ error: 'PIN must be 4-6 digits' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check rate limiting: max 5 PIN changes per user per hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: recentChanges, error: auditError } = await supabase
      .from('audit_events')
      .select('id')
      .eq('event_type', 'pin_set')
      .eq('payload->>target_user_id', userId)
      .gte('created_at', oneHourAgo);

    if (auditError) {
      console.error('Error checking rate limit:', auditError);
    } else if (recentChanges && recentChanges.length >= 5) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }), 
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify target user is in same org
    const { data: targetProfile } = await supabase
      .from('profiles')
      .select('org_id')
      .eq('id', userId)
      .single();

    const { data: adminProfile } = await supabase
      .from('profiles')
      .select('org_id')
      .eq('id', user.id)
      .single();

    if (!targetProfile || !adminProfile || targetProfile.org_id !== adminProfile.org_id) {
      return new Response(
        JSON.stringify({ error: 'Cannot set PIN for user in different organization' }), 
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Hash the PIN server-side
    const pinHash = await hashPin(pin);

    // Update profile with hashed PIN and reset attempt counter
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ 
        pin_hash: pinHash,
        pin_attempts: 0,
        pin_locked_until: null
      })
      .eq('id', userId);

    if (updateError) {
      console.error('Error updating PIN:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to set PIN' }), 
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log audit event
    await supabase
      .from('audit_events')
      .insert({
        org_id: adminProfile.org_id,
        event_type: 'pin_set',
        actor_type: 'user',
        actor_id: user.id,
        payload: {
          target_user_id: userId,
          timestamp: new Date().toISOString()
        }
      });

    console.log(`PIN set successfully for user ${userId} by admin ${user.id}`);

    return new Response(
      JSON.stringify({ success: true }), 
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Unexpected error in set-pin function:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
