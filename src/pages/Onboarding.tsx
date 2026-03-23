import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Anchor, CheckCircle2 } from "lucide-react";
import { useEffect } from "react";

import OnboardingStep1 from "@/components/onboarding/OnboardingStep1";
import OnboardingStep2, { Step2Data } from "@/components/onboarding/OnboardingStep2";
import OnboardingStep3, { CustomTask } from "@/components/onboarding/OnboardingStep3";
import OnboardingChatBubble from "@/components/onboarding/OnboardingChatBubble";
import { Industry, INDUSTRY_TASKS, TaskTemplate } from "@/lib/industryTemplates";

const PLACEHOLDER_ORG_ID = "00000000-0000-0000-0000-000000000000";

const STEP_LABELS = ["Company Basics", "Your Structure", "Your First Tasks"];

export default function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  // Step 1
  const [step1, setStep1] = useState({
    orgName: "",
    timezone: "",
    industry: "" as Industry,
  });

  // Step 2
  const [step2, setStep2] = useState<Step2Data>({
    locationName: "",
    departmentName: "",
    shiftName: "",
    shiftStart: "",
    shiftEnd: "",
    shiftDays: [],
  });

  // Step 3
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([]);
  const [customTasks, setCustomTasks] = useState<CustomTask[]>([]);

  useEffect(() => {
    checkExistingOrg();
  }, []);

  const checkExistingOrg = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
      return;
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("org_id")
      .eq("id", user.id)
      .single();

    if (profile && profile.org_id && profile.org_id !== PLACEHOLDER_ORG_ID) {
      navigate("/dashboard");
      return;
    }
    setInitialLoading(false);
  };

  const toggleTemplate = (id: string) => {
    setSelectedTemplateIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleFinish = async () => {
    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // 1. Create organization
      const { data: org, error: orgError } = await supabase
        .from("organizations")
        .insert({
          name: step1.orgName.trim(),
          timezone: step1.timezone,
          settings: { industry: step1.industry },
        })
        .select()
        .single();
      if (orgError) throw orgError;

      // 2. Update user profile
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ org_id: org.id })
        .eq("id", user.id);
      if (profileError) throw profileError;

      // 3. Assign org_admin role
      await supabase.from("user_roles").insert({ user_id: user.id, role: "org_admin" });

      // 4. Create location
      const { data: location, error: locError } = await supabase
        .from("locations")
        .insert({ org_id: org.id, name: step2.locationName.trim() })
        .select()
        .single();
      if (locError) throw locError;

      // 5. Create department
      const { data: department, error: deptError } = await supabase
        .from("departments")
        .insert({ location_id: location.id, name: step2.departmentName.trim() })
        .select()
        .single();
      if (deptError) throw deptError;

      // 6. Create shift
      const { data: shift, error: shiftError } = await supabase
        .from("shifts")
        .insert({
          location_id: location.id,
          department_id: department.id,
          name: step2.shiftName.trim(),
          start_time: step2.shiftStart,
          end_time: step2.shiftEnd,
          days_of_week: step2.shiftDays,
        })
        .select()
        .single();
      if (shiftError) throw shiftError;

      // 7. Create task routines
      const templates = INDUSTRY_TASKS[step1.industry] || [];
      const selectedTemplates = templates.filter((t) =>
        selectedTemplateIds.includes(t.id)
      );

      const routineInserts = [
        ...selectedTemplates.map((t) => buildRoutine(t, org.id, location.id, department.id, shift.id)),
        ...customTasks.map((t) => ({
          org_id: org.id,
          location_id: location.id,
          department_id: department.id,
          shift_id: shift.id,
          title: t.title,
          est_minutes: t.estMinutes,
          criticality: t.criticality,
          required_proof: "none" as const,
          active: true,
          recurrence_v2: {
            type: t.frequency === "daily" ? "daily" : "weekly",
            time_slots: [step2.shiftStart],
            ...(t.frequency === "weekly" ? { days_of_week: step2.shiftDays } : {}),
          },
        })),
      ];

      if (routineInserts.length > 0) {
        const { error: routineError } = await supabase
          .from("task_routines")
          .insert(routineInserts);
        if (routineError) throw routineError;
      }

      // 8. Trigger materialization
      try {
        await supabase.functions.invoke("materialize-tasks-v2");
      } catch (matError) {
        console.warn("Materialization trigger failed, tasks will be created on next cron:", matError);
      }

      toast.success("Your workspace is ready!");
      navigate("/dashboard");
    } catch (error: any) {
      console.error("Setup error:", error);
      toast.error(error.message || "Setup failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <div className="max-w-4xl mx-auto py-8 space-y-8">
        {/* Header */}
        <div className="text-center space-y-1">
          <div className="inline-flex items-center gap-2">
            <Anchor className="w-6 h-6 text-primary" />
            <span className="font-semibold text-lg">Nautilus</span>
          </div>
        </div>

        {/* Step indicator */}
        <div className="max-w-md mx-auto space-y-3">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Step {step} of 3</span>
            <span>{STEP_LABELS[step - 1]}</span>
          </div>
          <Progress value={(step / 3) * 100} className="h-2" />
          <div className="flex justify-between">
            {STEP_LABELS.map((label, idx) => {
              const num = idx + 1;
              const done = num < step;
              const active = num === step;
              return (
                <div
                  key={label}
                  className={`flex items-center gap-1.5 text-xs font-medium ${
                    active ? "text-primary" : done ? "text-success" : "text-muted-foreground/40"
                  }`}
                >
                  {done ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    <span
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                        active ? "bg-primary text-primary-foreground" : "bg-muted"
                      }`}
                    >
                      {num}
                    </span>
                  )}
                  <span className="hidden sm:inline">{label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Step content */}
        <div className="bg-card rounded-2xl border p-6 sm:p-8 shadow-sm">
          {step === 1 && (
            <OnboardingStep1
              data={step1}
              onChange={setStep1}
              onNext={() => setStep(2)}
            />
          )}
          {step === 2 && (
            <OnboardingStep2
              data={step2}
              industry={step1.industry}
              onChange={setStep2}
              onNext={() => setStep(3)}
              onBack={() => setStep(1)}
            />
          )}
          {step === 3 && (
            <OnboardingStep3
              industry={step1.industry}
              selectedTemplateIds={selectedTemplateIds}
              customTasks={customTasks}
              onToggleTemplate={toggleTemplate}
              onAddCustomTask={(t) => setCustomTasks((prev) => [...prev, t])}
              onRemoveCustomTask={(idx) => setCustomTasks((prev) => prev.filter((_, i) => i !== idx))}
              onBack={() => setStep(2)}
              onFinish={handleFinish}
              isSubmitting={isSubmitting}
            />
          )}
        </div>
      </div>

      {/* Optional AI help bubble */}
      <OnboardingChatBubble />
    </div>
  );
}

function buildRoutine(
  template: TaskTemplate,
  orgId: string,
  locationId: string,
  departmentId: string,
  shiftId: string,
) {
  return {
    org_id: orgId,
    location_id: locationId,
    department_id: departmentId,
    shift_id: shiftId,
    title: template.title,
    description: template.description,
    est_minutes: template.estMinutes,
    criticality: template.criticality,
    required_proof: "none" as const,
    active: true,
    recurrence_v2: {
      type: template.frequency === "daily" ? "daily" : "weekly",
      time_slots: ["09:00"],
      ...(template.frequency === "weekly" ? { days_of_week: [1, 2, 3, 4, 5] } : {}),
    },
  };
}
