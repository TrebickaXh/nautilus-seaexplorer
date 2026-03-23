import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Anchor, CheckCircle2 } from "lucide-react";

import OnboardingStep1 from "@/components/onboarding/OnboardingStep1";
import OnboardingStep2, { Step2Data } from "@/components/onboarding/OnboardingStep2";
import OnboardingStep3, { CustomTask } from "@/components/onboarding/OnboardingStep3";
import OnboardingChatBubble from "@/components/onboarding/OnboardingChatBubble";
import { Industry, INDUSTRY_TASKS } from "@/lib/industryTemplates";

const PLACEHOLDER_ORG_ID = "00000000-0000-0000-0000-000000000000";
const STORAGE_KEY = "nautilus_onboarding_state";
const STEP_LABELS = ["Company Basics", "Your Structure", "Your First Tasks"];

interface OnboardingState {
  step: number;
  step1: { orgName: string; timezone: string; industry: Industry };
  step2: Step2Data;
  selectedTemplateIds: string[];
  customTasks: CustomTask[];
}

function loadSavedState(): OnboardingState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as OnboardingState;
  } catch {
    return null;
  }
}

function clearSavedState() {
  localStorage.removeItem(STORAGE_KEY);
}

const DEFAULT_STEP1 = { orgName: "", timezone: "", industry: "" as Industry };
const DEFAULT_STEP2: Step2Data = {
  locationName: "",
  departmentName: "",
  shiftName: "",
  shiftStart: "",
  shiftEnd: "",
  shiftDays: [],
};

export default function Onboarding() {
  const navigate = useNavigate();
  const saved = loadSavedState();

  const [step, setStep] = useState(saved?.step || 1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  const [step1, setStep1] = useState(saved?.step1 || DEFAULT_STEP1);
  const [step2, setStep2] = useState<Step2Data>(saved?.step2 || DEFAULT_STEP2);
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>(saved?.selectedTemplateIds || []);
  const [customTasks, setCustomTasks] = useState<CustomTask[]>(saved?.customTasks || []);

  // Persist state to localStorage on every change
  useEffect(() => {
    if (initialLoading) return;
    const state: OnboardingState = { step, step1, step2, selectedTemplateIds, customTasks };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [step, step1, step2, selectedTemplateIds, customTasks, initialLoading]);

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
      clearSavedState();
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
      const templates = INDUSTRY_TASKS[step1.industry] || [];
      const selectedTemplates = templates.filter((t) =>
        selectedTemplateIds.includes(t.id)
      );

      const taskRoutinePayloads = [
        ...selectedTemplates.map((t) => ({
          title: t.title,
          description: t.description,
          steps: t.steps,
          est_minutes: t.estMinutes,
          criticality: t.criticality,
          required_proof: t.requiredProof,
          recurrence_v2: {
            ...t.recurrence_v2,
            time_slots: t.recurrence_v2.time_slots || [step2.shiftStart],
            ...(t.recurrence_v2.type === "weekly" && !t.recurrence_v2.days_of_week
              ? { days_of_week: step2.shiftDays }
              : {}),
          },
        })),
        ...customTasks.map((t) => ({
          title: t.title,
          description: null,
          steps: [],
          est_minutes: t.estMinutes,
          criticality: t.criticality,
          required_proof: t.requiredProof,
          recurrence_v2: {
            type: t.frequency === "daily" ? "daily" : "weekly",
            time_slots: [step2.shiftStart],
            ...(t.frequency === "weekly" ? { days_of_week: step2.shiftDays } : {}),
          },
        })),
      ];

      const { data, error } = await supabase.functions.invoke("create-organization", {
        body: {
          orgName: step1.orgName,
          timezone: step1.timezone,
          industry: step1.industry,
          locationName: step2.locationName,
          departmentName: step2.departmentName,
          shiftName: step2.shiftName,
          shiftStart: step2.shiftStart,
          shiftEnd: step2.shiftEnd,
          shiftDays: step2.shiftDays,
          taskRoutines: taskRoutinePayloads,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Setup failed");

      // Clear saved state on success
      clearSavedState();

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
        <div className="text-center space-y-1">
          <div className="inline-flex items-center gap-2">
            <Anchor className="w-6 h-6 text-primary" />
            <span className="font-semibold text-lg">Nautilus</span>
          </div>
        </div>

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

      <OnboardingChatBubble />
    </div>
  );
}
