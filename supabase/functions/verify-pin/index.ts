import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

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

    if (!pin || pin.length < 4) {
      return new Response(
        JSON.stringify({ error: "Invalid PIN format" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("Verifying PIN authentication...");

    // Get all profiles with PINs set
    const { data: profiles, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name, pin_hash, user_roles(role)")
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
      try {
        const isMatch = await bcrypt.compare(pin, profile.pin_hash);
        if (isMatch) {
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

    console.log("No matching PIN found");
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
