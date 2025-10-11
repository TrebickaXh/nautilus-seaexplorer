import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.2.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VerifyPinRequest {
  pin: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const { pin }: VerifyPinRequest = await req.json();
    const clientIp = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';

    if (!pin || !/^\d{4,6}$/.test(pin)) {
      return new Response(
        JSON.stringify({ error: "Invalid PIN format" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("Verifying PIN authentication...");

    // Rate limiting: Check recent failed attempts from this IP
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { data: recentAttempts } = await supabaseAdmin
      .from('audit_events')
      .select('id')
      .eq('event_type', 'pin_verification_failed')
      .eq('payload->>client_ip', clientIp)
      .gte('created_at', fifteenMinutesAgo);

    if (recentAttempts && recentAttempts.length >= 5) {
      console.log(`Rate limit exceeded for IP: ${clientIp}`);
      return new Response(
        JSON.stringify({ error: 'Too many attempts. Please try again in 15 minutes.' }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get all profiles with PINs set
    const { data: profiles, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name, pin_hash, pin_attempts, pin_locked_until, org_id, user_roles(role)")
      .not("pin_hash", "is", null)
      .eq("active", true);

    if (profileError) {
      console.error("Error fetching profiles:", profileError);
      return new Response(
        JSON.stringify({ error: "Authentication failed" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Try to match PIN with each profile
    for (const profile of profiles || []) {
      // Check if account is locked
      if (profile.pin_locked_until) {
        const lockExpiry = new Date(profile.pin_locked_until);
        if (lockExpiry > new Date()) {
          console.log(`Account ${profile.id} is locked until ${profile.pin_locked_until}`);
          continue;
        } else {
          // Unlock if time has passed
          await supabaseAdmin
            .from('profiles')
            .update({ pin_locked_until: null, pin_attempts: 0 })
            .eq('id', profile.id);
        }
      }

      try {
        const isMatch = await bcrypt.compare(pin, profile.pin_hash);
        if (isMatch) {
          // Reset attempt counter on successful login
          await supabaseAdmin
            .from('profiles')
            .update({ pin_attempts: 0, pin_locked_until: null })
            .eq('id', profile.id);

          // Log successful verification
          await supabaseAdmin
            .from('audit_events')
            .insert({
              org_id: profile.org_id,
              event_type: 'pin_verification_success',
              actor_type: 'user',
              actor_id: profile.id,
              payload: {
                client_ip: clientIp,
                timestamp: new Date().toISOString()
              }
            });

          console.log(`PIN matched for user: ${profile.display_name}`);
          return new Response(
            JSON.stringify({
              success: true,
              user: {
                id: profile.id,
                display_name: profile.display_name,
                roles: profile.user_roles,
              },
            }),
            {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
      } catch (error) {
        console.error("Error comparing PIN:", error);
        continue;
      }
    }

    // No match found - log failed attempt
    await supabaseAdmin
      .from('audit_events')
      .insert({
        org_id: profiles?.[0]?.org_id || null,
        event_type: 'pin_verification_failed',
        actor_type: 'system',
        payload: {
          client_ip: clientIp,
          timestamp: new Date().toISOString()
        }
      });

    console.log(`Failed PIN verification attempt from IP: ${clientIp}`);
    return new Response(
      JSON.stringify({ error: "Invalid PIN" }),
      {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in verify-pin function:", error);
    return new Response(
      JSON.stringify({ error: "Authentication failed" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
