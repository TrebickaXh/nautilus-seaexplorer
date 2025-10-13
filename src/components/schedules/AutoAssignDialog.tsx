import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, CheckCircle2, AlertTriangle, XCircle, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AutoAssignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shiftId: string;
}

export function AutoAssignDialog({ open, onOpenChange, shiftId }: AutoAssignDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);

  const { data: suggestions, isLoading } = useQuery({
    queryKey: ["shift-suggestions", shiftId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("suggest-shift-assignments", {
        body: { shift_id: shiftId },
      });
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const assignMutation = useMutation({
    mutationFn: async (employeeId: string) => {
      const suggestion = suggestions?.suggestions.find(
        (s: any) => s.employee_id === employeeId
      );

      const { error } = await supabase.from("schedule_assignments").insert({
        shift_id: shiftId,
        employee_id: employeeId,
        status: "assigned",
        assignment_method: "auto",
        assignment_score: suggestion?.score,
        metadata: {
          details: suggestion?.details,
          warnings: suggestion?.warnings,
          auto_assigned_at: new Date().toISOString(),
        },
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedule-shifts"] });
      queryClient.invalidateQueries({ queryKey: ["schedule-assignments"] });
      toast({
        title: "Employee assigned",
        description: "The shift has been auto-assigned successfully.",
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Assignment failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  const getScoreBadge = (score: number) => {
    if (score >= 80) return { variant: "default" as const, label: "Excellent Match" };
    if (score >= 60) return { variant: "secondary" as const, label: "Good Match" };
    return { variant: "destructive" as const, label: "Poor Match" };
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            Auto-Assign Employee
          </DialogTitle>
          <DialogDescription>
            AI-ranked suggestions based on availability, skills, hours, and seniority
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        )}

        {suggestions && (
          <div className="space-y-4">
            <div className="bg-muted p-3 rounded-lg text-sm">
              <p className="font-medium">{suggestions.shift_details.name}</p>
              <p className="text-muted-foreground">
                {new Date(suggestions.shift_details.start_at).toLocaleString()} -{" "}
                {new Date(suggestions.shift_details.end_at).toLocaleTimeString()}
              </p>
              {suggestions.shift_details.department && (
                <p className="text-muted-foreground">
                  Department: {suggestions.shift_details.department}
                </p>
              )}
            </div>

            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-3">
                {suggestions.suggestions.map((emp: any) => {
                  const scoreBadge = getScoreBadge(emp.score);
                  const hasConflicts = emp.conflicts.length > 0;

                  return (
                    <div
                      key={emp.employee_id}
                      className={`p-4 border rounded-lg space-y-3 ${
                        hasConflicts
                          ? "border-destructive bg-destructive/5"
                          : "hover:bg-accent cursor-pointer"
                      } ${selectedEmployee === emp.employee_id ? "ring-2 ring-primary" : ""}`}
                      onClick={() => !hasConflicts && setSelectedEmployee(emp.employee_id)}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium">{emp.employee_name}</p>
                          <p className={`text-2xl font-bold ${getScoreColor(emp.score)}`}>
                            {emp.score}/100
                          </p>
                        </div>
                        <Badge variant={scoreBadge.variant}>{scoreBadge.label}</Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">Availability:</span>
                          <span className="font-medium">{emp.details.availability_match}/30</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">Skills:</span>
                          <span className="font-medium">{emp.details.skills_match}/25</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">Hours:</span>
                          <span className="font-medium">{emp.details.hours_balance}/20</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">Seniority:</span>
                          <span className="font-medium">{emp.details.seniority.toFixed(0)}/15</span>
                        </div>
                      </div>

                      {emp.conflicts.length > 0 && (
                        <div className="flex items-start gap-2 text-sm text-destructive">
                          <XCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="font-medium">Conflicts:</p>
                            <ul className="list-disc list-inside">
                              {emp.conflicts.map((c: string, i: number) => (
                                <li key={i}>{c}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      )}

                      {emp.warnings.length > 0 && !hasConflicts && (
                        <div className="flex items-start gap-2 text-sm text-yellow-600">
                          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                          <div>
                            <ul className="list-disc list-inside">
                              {emp.warnings.map((w: string, i: number) => (
                                <li key={i}>{w}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => selectedEmployee && assignMutation.mutate(selectedEmployee)}
                disabled={!selectedEmployee || assignMutation.isPending}
              >
                {assignMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Assign Selected
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}