import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { evaluateAssignment, RuleResult } from "@/lib/rulesEngine";
import { AlertCircle, CheckCircle, AlertTriangle, Clock } from "lucide-react";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface AssignEmployeeDialogProps {
  shift: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AssignEmployeeDialog({ shift, open, onOpenChange }: AssignEmployeeDialogProps) {
  const queryClient = useQueryClient();
  const [validationResults, setValidationResults] = useState<Record<string, RuleResult>>({});

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ["available-employees", shift?.department_id],
    queryFn: async () => {
      if (!shift?.department_id) return [];
      
      const { data, error } = await supabase
        .from("profiles")
        .select(`
          *,
          user_departments!inner(department_id, is_primary),
          positions(name)
        `)
        .eq("user_departments.department_id", shift.department_id)
        .eq("active", true);
      
      if (error) throw error;

      // Pre-validate all employees
      const validations: Record<string, RuleResult> = {};
      for (const emp of data) {
        const result = await evaluateAssignment({
          employeeId: emp.id,
          shiftId: shift.id,
          departmentId: shift.department_id,
          startAt: shift.start_at,
          endAt: shift.end_at,
          requiredSkills: shift.required_skills || [],
        });
        validations[emp.id] = result;
      }
      setValidationResults(validations);
      
      return data;
    },
    enabled: open && !!shift?.department_id,
  });

  const assignMutation = useMutation({
    mutationFn: async (employeeId: string) => {
      // Run rules engine validation
      const validation = await evaluateAssignment({
        employeeId,
        shiftId: shift.id,
        departmentId: shift.department_id,
        startAt: shift.start_at,
        endAt: shift.end_at,
        requiredSkills: shift.required_skills || [],
      });

      if (!validation.eligible) {
        throw new Error(validation.blocks.join("; "));
      }

      // Create assignment
      const { error: assignError } = await supabase
        .from("schedule_assignments")
        .insert({
          shift_id: shift.id,
          employee_id: employeeId,
          status: "assigned",
        });

      if (assignError) throw assignError;

      // Update shift status
      await supabase
        .from("shifts")
        .update({ status: "scheduled" })
        .eq("id", shift.id);

      return validation;
    },
    onSuccess: (validation) => {
      queryClient.invalidateQueries({ queryKey: ["schedule-shifts"] });
      
      if (validation.warnings.length > 0) {
        toast.success("Employee assigned with warnings: " + validation.warnings.join("; "));
      } else {
        toast.success("Employee assigned successfully");
      }
      
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error("Failed to assign: " + error.message);
    },
  });

  if (!shift) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Assign Employee to Shift</DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-[400px] pr-4">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading employees...</div>
          ) : employees.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No employees available</div>
          ) : (
            <div className="space-y-2">
              {employees.map((employee: any) => {
                const validation = validationResults[employee.id];
                const hasConflicts = validation && (validation.conflicts?.length || 0) > 0;
                const isBlocked = validation && !validation.eligible;

                return (
                  <div
                    key={employee.id}
                    className={`p-3 border rounded-lg ${
                      isBlocked ? "opacity-60 bg-destructive/5" : "hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{employee.display_name}</span>
                          {employee.positions?.name && (
                            <Badge variant="outline">{employee.positions.name}</Badge>
                          )}
                        </div>

                        {/* Validation Status */}
                        {validation && (
                          <div className="space-y-1">
                            {/* Blocks */}
                            {validation.blocks.length > 0 && (
                              <div className="flex items-start gap-2 text-sm text-destructive">
                                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                <span>{validation.blocks[0]}</span>
                              </div>
                            )}

                            {/* Warnings */}
                            {validation.warnings.length > 0 && !isBlocked && (
                              <div className="flex items-start gap-2 text-sm text-amber-600">
                                <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                <span>
                                  {validation.warnings.includes("OVERTIME_FORECAST") 
                                    ? `${validation.metrics.projectedWeeklyHours}h weekly (${validation.metrics.projectedOvertimeHours}h OT)`
                                    : validation.warnings[0]
                                  }
                                </span>
                              </div>
                            )}

                            {/* Success */}
                            {!hasConflicts && !isBlocked && (
                              <div className="flex items-center gap-2 text-sm text-green-600">
                                <CheckCircle className="w-4 h-4" />
                                <span>No conflicts</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <Button
                        onClick={() => assignMutation.mutate(employee.id)}
                        disabled={assignMutation.isPending || isBlocked}
                        size="sm"
                        variant={validation?.warnings.length > 0 ? "outline" : "default"}
                      >
                        {isBlocked ? "Blocked" : "Assign"}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
