import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `You are Nautilus' onboarding assistant. Guide users through a comprehensive 10-step setup process.

Your goal is to gather detailed information about their organization, locations, departments, shifts, team members, and task routines.

**Process Overview (10 Steps):**

**Step 1 – Company Setup**
Ask about:
- Organization name
- Timezone (e.g., America/New_York, Europe/London, Asia/Tokyo)
- Industry (Hospitality, Cleaning, Manufacturing, Retail, Facilities, etc.)
- Operating days (which days of the week they work)
- Operating hours (typical start and end times)

**Step 2 – Locations**
Ask about:
- Number of locations (single or multiple sites)
- For each location: name, address/area, and any specific zones/areas within (e.g., Kitchen, Lobby, Storage, Parking)

**Step 3 – Departments**
Ask about:
- Which departments exist (Kitchen, Housekeeping, Security, Maintenance, Front Desk, etc.)
- Which location each department belongs to
- Who manages each department (name and email if available)

**Step 4 – Shifts**
Ask about:
- How many shifts each department has (Morning, Afternoon, Night, etc.)
- For each shift: name, start time, end time, days of week it runs, whether it goes overnight

**Step 5 – Team Members**
Ask about:
- How many team members to add initially
- For each: full name, email, role (Admin/Manager/Staff), departments, shifts, optional PIN for kiosk

**Step 6 – Tasks & Routines**
Ask about:
- Whether they want ready-made templates for their industry
- For each task: title, description, steps, department, shift, location, area, recurrence (daily/weekly/monthly/custom), due time, duration, importance (1-5), proof requirement (photo/note/signature/none)

**Step 7 – One-Time Tasks (Optional)**
Ask about:
- Any one-off tasks that don't repeat
- For each: title, description (optional), steps (optional), department, shift, area, location, due date/time, duration (est_minutes), importance (1-5), proof requirement (photo/note/signature/both/none)

**Step 8 – Task Rules & Completion**
Ask about:
- Assignment rules (anyone on shift or specific person)
- What happens to incomplete tasks (move to next shift, keep overdue)
- Can tasks be deferred manually
- Options when task isn't done (skip with reason, defer, reassign, cancel)

**Step 9 – Notifications & Reports**
Ask about:
- Notifications for overdue tasks (yes/no)
- Automatic end-of-shift reports (yes/no)
- Who gets access to reports (admins only, managers, everyone)

**Step 10 – Review & Confirmation**
Summarize what will be created:
- Company profile
- Locations & Areas
- Departments & Shifts  
- Team Members
- Task Routines
- One-Off Tasks
- Reporting setup

Ask for final confirmation.

**Important Guidelines:**
- Ask 1-2 questions at a time, keep it conversational
- Track progress through the 10 steps
- When asking about shifts, collect: name, start_time (HH:MM format), end_time (HH:MM format), days_of_week (array of 0-6, where 0=Sunday)
- For recurrence, use this format:
  {
    "type": "daily" | "weekly" | "custom_weeks" | "monthly",
    "time_slots": ["HH:MM", ...],
    "days_of_week": [0-6],  // for weekly
    "week_interval": 1,      // for custom_weeks
    "weeks_pattern": [[0-6]], // for custom_weeks
    "day_of_month": [1-31]   // for monthly
  }

When you have collected ALL 10 steps of information and the user confirms, respond with:
"ONBOARDING_COMPLETE" followed by this JSON structure:

{
  "orgName": "string",
  "timezone": "string",
  "industry": "string",
  "operatingDays": [0-6],
  "operatingHours": {"start": "HH:MM", "end": "HH:MM"},
  "locations": [
    {
      "name": "string",
      "address": "string",
      "latitude": number,
      "longitude": number,
      "areas": ["string"]
    }
  ],
  "departments": [
    {
      "name": "string",
      "locationName": "string",
      "manager": "string (optional)",
      "managerEmail": "string (optional)"
    }
  ],
  "shifts": [
    {
      "name": "string",
      "departmentName": "string",
      "locationName": "string",
      "start_time": "HH:MM",
      "end_time": "HH:MM",
      "days_of_week": [0-6],
      "overnight": boolean
    }
  ],
  "teamMembers": [
    {
      "name": "string",
      "email": "string",
      "role": "org_admin" | "location_manager" | "crew",
      "departments": ["string"],
      "shifts": ["string"],
      "pin": "string (optional 4-6 digits)"
    }
  ],
  "taskRoutines": [
    {
      "title": "string",
      "description": "string",
      "steps": ["string"],
      "departmentName": "string",
      "shiftName": "string",
      "locationName": "string",
      "areaNames": ["string"],
      "recurrence_v2": {...},
      "est_minutes": number,
      "criticality": 1-5,
      "required_proof": "photo" | "note" | "signature" | "none"
    }
  ],
  "oneOffTasks": [
    {
      "title": "string",
      "description": "string (optional)",
      "steps": ["string"] (optional),
      "departmentName": "string",
      "shiftName": "string",
      "areaName": "string",
      "locationName": "string",
      "due_at": "ISO8601 datetime",
      "est_minutes": number (optional),
      "criticality": 1-5 (optional),
      "required_proof": "photo" | "note" | "signature" | "both" | "none"
    }
  ],
  "taskRules": {
    "assignmentType": "shift" | "individual",
    "incompleteAction": "defer_next_shift" | "keep_overdue",
    "allowManualDefer": boolean,
    "skipOptions": ["skip_with_reason", "defer", "reassign", "cancel"]
  },
  "notifications": {
    "overdueAlerts": boolean,
    "autoReports": boolean,
    "reportAccess": "admins" | "managers" | "everyone"
  }
}

Keep the conversation friendly, helpful, and concise. Guide them through each step systematically.`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sessionId, message, conversationHistory, restart } = await req.json();
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Handle restart request
    if (restart) {
      await supabase
        .from("onboarding_sessions")
        .update({ 
          conversation_history: [],
          generated_config: null,
          status: 'in_progress',
          completed_at: null
        })
        .eq("id", sessionId);

      return new Response(
        JSON.stringify({ 
          response: "No problem! Let's start fresh. What's your organization's name?",
          complete: false,
          restarted: true
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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
      const errorText = await response.text();
      console.error("AI API error:", response.status, errorText);
      throw new Error(`AI request failed: ${response.statusText}`);
    }

    const data = await response.json();
    const assistantResponse = data.choices[0].message.content;

    // Check if onboarding is complete
    const isComplete = assistantResponse.includes("ONBOARDING_COMPLETE");
    
    let generatedConfig = null;
    let cleanResponse = assistantResponse;

    if (isComplete) {
      // Extract JSON config
      const jsonMatch = assistantResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          generatedConfig = JSON.parse(jsonMatch[0]);
          cleanResponse = "Perfect! I have all the information I need. Setting up your organization now...";
          
          // Create organization and related records
          await setupOrganization(supabase, sessionId, generatedConfig);
        } catch (error) {
          console.error("Failed to parse or create config:", error);
          cleanResponse = "I have the information, but there was an issue processing it. Could you confirm your organization name?";
        }
      }
    }

    // Update session with conversation history
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
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  
  const { data: session } = await supabase
    .from("onboarding_sessions")
    .select("user_id")
    .eq("id", sessionId)
    .single();

  if (!session) throw new Error("Session not found");

  // Create organization with settings
  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .insert({
      name: config.orgName,
      timezone: config.timezone || "UTC",
      settings: {
        operatingDays: config.operatingDays || null,
        operatingHours: config.operatingHours || null,
        taskRules: config.taskRules || null,
        notifications: config.notifications || null
      }
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
  const locationMap: Record<string, string> = {};
  for (const loc of config.locations || []) {
    const { data: location, error: locError } = await supabase
      .from("locations")
      .insert({
        org_id: org.id,
        name: loc.name,
        latitude: loc.latitude || null,
        longitude: loc.longitude || null,
        address: loc.address || null
      })
      .select()
      .single();

    if (locError) throw locError;
    locationMap[loc.name] = location.id;

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

  // Create departments (will update manager_user_id after users are created)
  const departmentMap: Record<string, string> = {};
  const departmentsWithManagers: Array<{id: string, managerEmail: string}> = [];
  
  for (const dept of config.departments || []) {
    const locationId = locationMap[dept.locationName];
    if (!locationId) continue;

    const { data: department, error: deptError } = await supabase
      .from("departments")
      .insert({
        location_id: locationId,
        name: dept.name,
        description: dept.manager ? `Managed by ${dept.manager}` : null
      })
      .select()
      .single();

    if (deptError) throw deptError;
    departmentMap[dept.name] = department.id;
    
    // Track departments with managers (if email provided)
    if (dept.managerEmail) {
      departmentsWithManagers.push({ id: department.id, managerEmail: dept.managerEmail });
    }
  }

  // Create shifts (and auto-fill 24-hour coverage)
  const shiftMap: Record<string, string> = {};
  const createdShifts: Array<{start: string, end: string, days: number[]}> = [];
  
  for (const shift of config.shifts || []) {
    const locationId = locationMap[shift.locationName];
    const departmentId = departmentMap[shift.departmentName];
    if (!locationId || !departmentId) continue;

    const { data: createdShift, error: shiftError } = await supabase
      .from("shifts")
      .insert({
        location_id: locationId,
        department_id: departmentId,
        name: shift.name,
        start_time: shift.start_time,
        end_time: shift.end_time,
        days_of_week: shift.days_of_week
      })
      .select()
      .single();

    if (shiftError) throw shiftError;
    shiftMap[shift.name] = createdShift.id;
    createdShifts.push({
      start: shift.start_time,
      end: shift.end_time,
      days: shift.days_of_week
    });
  }

  // Note: No auto-fill of shifts - users define what they need

  // Create team member invitations and assignments
  const userByEmail = new Map<string, string>();
  
  for (const member of config.teamMembers || []) {
    console.log(`Team member to invite: ${member.email} as ${member.role}`);
    
    // Get department IDs for this member
    const memberDeptIds = (member.departments || [])
      .map((deptName: string) => departmentMap[deptName])
      .filter(Boolean);
    
    const primaryDeptId = memberDeptIds[0] || null;
    
    // Call the invite-user edge function
    try {
      const inviteResponse = await fetch(`${supabaseUrl}/functions/v1/invite-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`
        },
        body: JSON.stringify({
          email: member.email,
          displayName: member.name,
          role: member.role || 'crew',
          departmentId: primaryDeptId,
          orgId: org.id,
          pin: member.pin || null
        })
      });
      
      if (!inviteResponse.ok) {
        const errorText = await inviteResponse.text();
        console.error(`Failed to invite ${member.email}:`, errorText);
        continue;
      }

      const inviteData = await inviteResponse.json();
      const invitedUserId = inviteData.user?.id;
      
      if (!invitedUserId) {
        console.error(`No user ID returned for ${member.email}`);
        continue;
      }

      // Store for department manager lookups
      userByEmail.set(member.email, invitedUserId);

      // Assign ALL departments (not just primary)
      if (memberDeptIds.length > 0) {
        const deptAssignments = memberDeptIds.map((deptId: string, idx: number) => ({
          user_id: invitedUserId,
          department_id: deptId,
          is_primary: idx === 0
        }));
        
        await supabase.from('user_departments').insert(deptAssignments);
      }

      // Assign ALL shifts
      const memberShiftIds = (member.shifts || [])
        .map((shiftName: string) => shiftMap[shiftName])
        .filter(Boolean);
      
      if (memberShiftIds.length > 0) {
        const shiftAssignments = memberShiftIds.map((shiftId: string) => ({
          user_id: invitedUserId,
          shift_id: shiftId
        }));
        
        await supabase.from('user_shifts').insert(shiftAssignments);
      }
    } catch (inviteError) {
      console.error(`Error inviting ${member.email}:`, inviteError);
    }
  }

  // Get area IDs for task routines
  const { data: areas } = await supabase
    .from("areas")
    .select("id, name, location_id");

  const areaMap: Record<string, string> = {};
  (areas || []).forEach((a: any) => {
    areaMap[a.name] = a.id;
  });

  // Create task routines
  console.log(`Creating ${(config.taskRoutines || []).length} task routines...`);
  console.log('Available departments:', Object.keys(departmentMap));
  console.log('Available locations:', Object.keys(locationMap));
  console.log('Available areas:', Object.keys(areaMap));
  
  for (const routine of config.taskRoutines || []) {
    const departmentId = departmentMap[routine.departmentName];
    const shiftId = shiftMap[routine.shiftName];
    const locationId = locationMap[routine.locationName];
    const areaIds = (routine.areaNames || []).map((n: string) => areaMap[n]).filter(Boolean);

    console.log(`Routine "${routine.title}": dept=${routine.departmentName} (${departmentId ? 'found' : 'MISSING'}), loc=${routine.locationName} (${locationId ? 'found' : 'MISSING'}), areas=${routine.areaNames?.join(', ')} (matched ${areaIds.length})`);

    if (!departmentId || !locationId) {
      console.error(`Skipping routine "${routine.title}" due to missing department or location`);
      continue;
    }

    const { error: routineError } = await supabase
      .from("task_routines")
      .insert({
        org_id: org.id,
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
    } else {
      console.log(`Created routine: "${routine.title}"`);
    }
  }

  // Update department managers now that users are created
  for (const deptWithManager of departmentsWithManagers) {
    const managerUserId = userByEmail.get(deptWithManager.managerEmail);
    if (managerUserId) {
      await supabase
        .from('departments')
        .update({ manager_user_id: managerUserId })
        .eq('id', deptWithManager.id);
    }
  }

  // Create one-off tasks with required_proof
  for (const task of config.oneOffTasks || []) {
    const departmentId = departmentMap[task.departmentName];
    const shiftId = shiftMap[task.shiftName];
    const locationId = locationMap[task.locationName];
    const areaId = areaMap[task.areaName];

    if (!departmentId || !locationId || !areaId) continue;

    await supabase
      .from("task_instances")
      .insert({
        routine_id: null, // one-off tasks don't have a routine
        location_id: locationId,
        department_id: departmentId,
        shift_id: shiftId || null,
        area_id: areaId,
        due_at: task.due_at,
        status: 'pending',
        created_from_v2: 'oneoff',
        required_proof: task.required_proof || 'none',
        denormalized_data: {
          routine_title: task.title || 'One-off Task',
          routine_description: task.description || null,
          area_name: task.areaName,
          est_minutes: task.est_minutes || 15,
          criticality: task.criticality || 3,
          required_proof: task.required_proof || 'none',
          steps: task.steps || []
        }
      });
  }

  // Materialize task instances from the routines we just created
  try {
    console.log("Materializing task instances from routines...");
    const materializeResponse = await fetch(`${supabaseUrl}/functions/v1/materialize-tasks-v2`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`
      }
    });
    
    if (materializeResponse.ok) {
      const materializeResult = await materializeResponse.json();
      console.log("Task materialization result:", materializeResult);
    } else {
      const errorText = await materializeResponse.text();
      console.error("Failed to materialize tasks:", errorText);
    }
  } catch (materializeError) {
    console.error("Error calling materialize-tasks-v2:", materializeError);
  }

  console.log("Organization setup complete!");
}
