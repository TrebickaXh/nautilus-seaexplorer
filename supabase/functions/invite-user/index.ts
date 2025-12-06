import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InviteUserRequest {
  email: string;
  displayName: string;
  role: string;
  phone?: string;
  departmentId: string;
  employeeId?: string;
  shiftType?: string;
  orgId: string;
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

    const {
      email,
      displayName,
      role,
      phone,
      departmentId,
      employeeId,
      shiftType,
      orgId,
    }: InviteUserRequest = await req.json();

    // Auto-generate employee ID if not provided
    let finalEmployeeId = employeeId;
    if (!finalEmployeeId || finalEmployeeId.trim() === '') {
      // Generate unique employee ID: EMP-YYYYMMDD-XXXXX (5 random alphanumeric chars)
      const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const randomPart = Array.from({ length: 5 }, () => 
        '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.floor(Math.random() * 33)]
      ).join('');
      finalEmployeeId = `EMP-${datePart}-${randomPart}`;
    }

    // Create user without sending email
    const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        display_name: displayName,
        org_id: orgId,
        role,
        phone,
        department_id: departmentId,
        employee_id: finalEmployeeId,
      },
    });

    if (createError) {
      console.error("Error creating user:", createError);
      
      // Return user-friendly error messages
      let errorMessage = createError.message;
      if (createError.message.includes("already been registered")) {
        errorMessage = "This email is already registered. Please use a different email address.";
      }
      
      return new Response(
        JSON.stringify({ error: errorMessage }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Ensure employee_id is set in profiles table (in case trigger doesn't populate it)
    if (userData.user) {
      await supabaseAdmin
        .from("profiles")
        .update({ employee_id: finalEmployeeId })
        .eq("id", userData.user.id);
    }

    // Update profile with shift_type if provided
    if (shiftType && userData.user) {
      await supabaseAdmin
        .from("profiles")
        .update({ shift_type: shiftType })
        .eq("id", userData.user.id);
    }

    return new Response(
      JSON.stringify({ success: true, user: userData.user }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in invite-user function:", error);
    
    // Handle specific error cases
    let errorMessage = "Failed to create team member";
    let statusCode = 500;
    
    if (error.message?.includes("already been registered")) {
      errorMessage = "This email is already registered. Please use a different email address.";
      statusCode = 400;
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: statusCode,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
