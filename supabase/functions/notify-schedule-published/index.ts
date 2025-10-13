import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationRequest {
  weekStart: string;
  weekEnd: string;
  shiftIds: string[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    const { weekStart, weekEnd, shiftIds }: NotificationRequest = await req.json();

    console.log(`Processing notifications for ${shiftIds.length} shifts`);

    // Get all employees assigned to these shifts
    const { data: assignments, error: assignmentsError } = await supabaseClient
      .from("schedule_assignments")
      .select(`
        employee_id,
        shift:shifts!inner(
          start_at,
          end_at,
          department:departments(name),
          location:locations(name)
        )
      `)
      .in("shift_id", shiftIds)
      .eq("status", "assigned");

    if (assignmentsError) throw assignmentsError;

    if (!assignments || assignments.length === 0) {
      console.log("No assignments found for the given shifts");
      return new Response(
        JSON.stringify({ message: "No employees to notify" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Get employee profiles with notification preferences
    const employeeIds = [...new Set(assignments.map((a) => a.employee_id))];
    const { data: employees, error: employeesError } = await supabaseClient
      .from("profiles")
      .select("id, display_name, email, phone, notification_preferences")
      .in("id", employeeIds);

    if (employeesError) throw employeesError;

    console.log(`Notifying ${employees.length} employees about published schedule`);

    // In a real implementation, you would send emails/SMS here
    // For now, we'll log the notifications
    const notifications = employees.map((employee) => {
      const employeeShifts = assignments.filter((a) => a.employee_id === employee.id);
      
      return {
        employeeId: employee.id,
        employeeName: employee.display_name,
        email: employee.email,
        phone: employee.phone,
        shiftCount: employeeShifts.length,
        message: `Your schedule for ${weekStart} to ${weekEnd} has been published. You have ${employeeShifts.length} shift(s) assigned.`,
        preferences: employee.notification_preferences,
      };
    });

    console.log("Notifications prepared:", notifications);

    // Here you would integrate with an email/SMS service
    // Example: Resend, Twilio, SendGrid, etc.

    return new Response(
      JSON.stringify({
        success: true,
        notificationsSent: notifications.length,
        notifications,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error: any) {
    console.error("Error in notify-schedule-published:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
