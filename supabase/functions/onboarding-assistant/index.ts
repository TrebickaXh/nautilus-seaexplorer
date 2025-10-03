import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `You are Nautilus' onboarding assistant. Your job is to help set up a new organization's task management system through a conversational interview.

You should ask concise questions to learn about:
1. Organization name and timezone
2. Locations (with approximate lat/lng - you can make reasonable estimates)
3. Areas within each location (e.g., Front Desk, Kitchen, Lobby)
4. Roles (e.g., Manager, Front Desk Staff, Housekeeping)
5. Common daily/weekly/monthly tasks for each area
6. Which tasks require photo proof, notes, or dual sign-off

Keep the conversation natural and friendly. Ask one or two questions at a time.

When you have enough information (typically after 5-8 exchanges), generate a completion signal by including "ONBOARDING_COMPLETE" at the start of your response, followed by a JSON configuration that follows this structure:

{
  "orgName": "Hotel Example",
  "timezone": "America/New_York",
  "locations": [
    {
      "name": "Main Location",
      "latitude": 40.7128,
      "longitude": -74.0060,
      "areas": ["Front Desk", "Lobby", "Kitchen"]
    }
  ],
  "roles": ["Manager", "Front Desk", "Housekeeping"],
  "taskTemplates": [
    {
      "title": "Morning Lobby Inspection",
      "description": "Check and tidy lobby area",
      "steps": ["Check cleanliness", "Arrange furniture", "Stock supplies"],
      "areas": ["Lobby"],
      "defaultRole": "Housekeeping",
      "estMinutes": 15,
      "criticality": 3,
      "requiredProof": "photo"
    }
  ]
}

Be helpful and conversational until you have enough info, then generate the config.`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sessionId, message, conversationHistory } = await req.json();
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Build messages for AI
    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...conversationHistory.map((msg: any) => ({
        role: msg.role,
        content: msg.content
      })),
      { role: "user", content: message }
    ];

    // Call Lovable AI
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
      }),
    });

    if (!response.ok) {
      throw new Error(`AI request failed: ${response.statusText}`);
    }

    const data = await response.json();
    const assistantResponse = data.choices[0].message.content;

    // Check if onboarding is complete
    const isComplete = assistantResponse.startsWith("ONBOARDING_COMPLETE");
    
    let generatedConfig = null;
    let cleanResponse = assistantResponse;

    if (isComplete) {
      // Extract JSON config
      const jsonMatch = assistantResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          generatedConfig = JSON.parse(jsonMatch[0]);
          cleanResponse = "Perfect! I have all the information I need. Let me set up your organization now...";
          
          // Create organization and related records
          await setupOrganization(supabase, sessionId, generatedConfig);
        } catch (error) {
          console.error("Failed to parse or create config:", error);
          cleanResponse = "I have the information, but there was an issue processing it. Let me try again - could you confirm your organization name?";
        }
      }
    }

    // Update session
    const updatedHistory = [...conversationHistory, 
      { role: "user", content: message },
      { role: "assistant", content: cleanResponse }
    ];

    await supabase
      .from("onboarding_sessions")
      .update({ 
        conversation_history: updatedHistory,
        generated_config: generatedConfig,
        status: isComplete ? 'completed' : 'in_progress',
        completed_at: isComplete ? new Date().toISOString() : null
      })
      .eq("id", sessionId);

    return new Response(
      JSON.stringify({ 
        response: cleanResponse,
        complete: isComplete && generatedConfig !== null
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error: any) {
    console.error("Onboarding error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

async function setupOrganization(supabase: any, sessionId: string, config: any) {
  // Get user from session
  const { data: session } = await supabase
    .from("onboarding_sessions")
    .select("user_id")
    .eq("id", sessionId)
    .single();

  if (!session) throw new Error("Session not found");

  // Create organization
  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .insert({
      name: config.orgName,
      timezone: config.timezone || "UTC"
    })
    .select()
    .single();

  if (orgError) throw orgError;

  // Update user profile with org_id
  await supabase
    .from("profiles")
    .update({ org_id: org.id })
    .eq("id", session.user_id);

  // Assign org_admin role
  await supabase
    .from("user_roles")
    .insert({ 
      user_id: session.user_id, 
      role: "org_admin" 
    });

  // Create locations and areas
  for (const loc of config.locations || []) {
    const { data: location, error: locError } = await supabase
      .from("locations")
      .insert({
        org_id: org.id,
        name: loc.name,
        latitude: loc.latitude,
        longitude: loc.longitude
      })
      .select()
      .single();

    if (locError) throw locError;

    // Create areas
    for (const areaName of loc.areas || []) {
      await supabase
        .from("areas")
        .insert({
          location_id: location.id,
          name: areaName
        });
    }
  }

  // Create task templates
  for (const template of config.taskTemplates || []) {
    await supabase
      .from("task_templates")
      .insert({
        org_id: org.id,
        title: template.title,
        description: template.description,
        steps: template.steps || [],
        est_minutes: template.estMinutes || 15,
        criticality: template.criticality || 3,
        required_proof: template.requiredProof || 'none'
      });
  }
}
