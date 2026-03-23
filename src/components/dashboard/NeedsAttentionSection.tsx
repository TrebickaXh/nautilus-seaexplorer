import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  X,
  Loader2,
  Clock,
  Send,
} from "lucide-react";

interface UrgentTask {
  id: string;
  due_at: string;
  urgency_score: number | null;
  window_end: string | null;
  department_id: string | null;
  area_id: string | null;
  denormalized_data: any;
  task_routines: { title: string; required_proof: string } | null;
  departments: { name: string } | null;
  areas: { name: string } | null;
  locations: { name: string } | null;
}

interface NeedsAttentionProps {
  tasks: UrgentTask[];
  orgId: string;
}

function getUrgencyColor(score: number) {
  if (score >= 0.85) return { bg: "bg-destructive/10", text: "text-destructive", border: "border-destructive/30", label: "CRITICAL" };
  if (score >= 0.6) return { bg: "bg-warning/10", text: "text-warning", border: "border-warning/30", label: "HIGH" };
  return { bg: "bg-success/10", text: "text-success", border: "border-success/30", label: "NORMAL" };
}

function formatDueTime(dueAt: string, windowEnd: string | null) {
  const now = new Date();
  const due = new Date(dueAt);

  // If window_end is set and within 1 hour, show "Window closes in X min"
  if (windowEnd) {
    const end = new Date(windowEnd);
    const minUntilClose = Math.round((end.getTime() - now.getTime()) / 60_000);
    if (minUntilClose > 0 && minUntilClose <= 60) {
      return `Window closes in ${minUntilClose}m`;
    }
  }

  // Otherwise show "Due at HH:MM"
  const minUntilDue = Math.round((due.getTime() - now.getTime()) / 60_000);
  if (minUntilDue < 0) {
    return `Overdue by ${Math.abs(minUntilDue)}m`;
  }
  return `Due at ${due.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
}

export default function NeedsAttentionSection({ tasks, orgId }: NeedsAttentionProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [skippingId, setSkippingId] = useState<string | null>(null);
  const [skipReason, setSkipReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSkip = async (taskId: string) => {
    if (!skipReason.trim()) return;
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error: updateError } = await supabase
        .from("task_instances")
        .update({ status: "skipped", completed_at: new Date().toISOString() })
        .eq("id", taskId);
      if (updateError) throw updateError;

      const { error: completionError } = await supabase
        .from("completions")
        .insert({
          task_instance_id: taskId,
          user_id: user.id,
          outcome: "skipped" as const,
          outcome_reason: skipReason.trim(),
          note: skipReason.trim(),
        });
      if (completionError) throw completionError;

      toast({ title: "Task skipped", description: "Reason recorded." });
      setSkippingId(null);
      setSkipReason("");
      queryClient.invalidateQueries({ queryKey: ["dashboard", orgId] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  // All caught up state
  if (tasks.length === 0) {
    return (
      <Card className="shadow-ocean border-success/30 bg-success/5">
        <CardContent className="flex items-center justify-center gap-3 py-8">
          <CheckCircle2 className="w-6 h-6 text-success" />
          <p className="text-lg font-semibold text-success">
            All caught up — no urgent tasks right now ✓
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-lg border-2 border-warning/20 bg-gradient-to-r from-card to-warning/[0.03]">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <AlertTriangle className="w-5 h-5 text-warning" />
          Needs Attention
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {tasks.map((task) => {
            const score = task.urgency_score ?? 0;
            const urgency = getUrgencyColor(score);
            const title =
              task.task_routines?.title ||
              (task.denormalized_data as any)?.title ||
              "Untitled Task";
            const isSkipping = skippingId === task.id;

            return (
              <div
                key={task.id}
                className={`flex flex-col gap-2 p-3 rounded-lg border ${urgency.border} ${urgency.bg} transition-all`}
              >
                <div className="flex items-start gap-3">
                  {/* Left: info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold truncate">{title}</p>
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1.5 py-0 ${urgency.text} ${urgency.border}`}
                      >
                        {urgency.label} {Math.round(score * 100)}%
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground flex-wrap">
                      {task.departments?.name && <span>{task.departments.name}</span>}
                      {task.areas?.name && (
                        <>
                          <span>•</span>
                          <span>{task.areas.name}</span>
                        </>
                      )}
                      {task.locations?.name && (
                        <>
                          <span>•</span>
                          <span>{task.locations.name}</span>
                        </>
                      )}
                    </div>
                    <p className={`text-sm font-medium mt-1 flex items-center gap-1 ${score >= 0.85 ? "text-destructive" : "text-muted-foreground"}`}>
                      <Clock className="w-3.5 h-3.5" />
                      {formatDueTime(task.due_at, task.window_end)}
                    </p>
                  </div>

                  {/* Right: actions */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs"
                      onClick={() => navigate(`/kiosk?task=${task.id}`)}
                    >
                      <ExternalLink className="w-3 h-3 mr-1" />
                      Kiosk
                    </Button>
                    {!isSkipping && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 text-xs text-warning hover:text-warning"
                        onClick={() => setSkippingId(task.id)}
                      >
                        Skip
                      </Button>
                    )}
                    {isSkipping && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 text-xs"
                        onClick={() => { setSkippingId(null); setSkipReason(""); }}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Inline skip reason */}
                {isSkipping && (
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      placeholder="Reason for skipping..."
                      value={skipReason}
                      onChange={(e) => setSkipReason(e.target.value)}
                      className="h-8 text-sm flex-1"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSkip(task.id);
                        if (e.key === "Escape") { setSkippingId(null); setSkipReason(""); }
                      }}
                    />
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-8 text-xs"
                      disabled={!skipReason.trim() || submitting}
                      onClick={() => handleSkip(task.id)}
                    >
                      {submitting ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Send className="w-3 h-3" />
                      )}
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
