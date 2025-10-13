import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { evaluateAssignment } from "@/lib/rulesEngine";
import { AlertCircle, CheckCircle } from "lucide-react";

interface AssignEmployeeDialogProps {
  shift: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AssignEmployeeDialog({ shift, open, onOpenChange }: AssignEmployeeDialogProps) {
  const queryClient = useQueryClient();

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
                const hasRequiredSkills = (shift.required_skills || []).every((skill: string) =>
                  (employee.skills || []).includes(skill)
                );

                return (
                  <div
                    key={employee.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{employee.display_name}</span>
                        {employee.positions?.name && (
                          <Badge variant="outline">{employee.positions.name}</Badge>
                        )}
                      </div>
                      
                      {shift.required_skills?.length > 0 && (
                        <div className="flex items-center gap-2 mt-1 text-sm">
                          {hasRequiredSkills ? (
                            <>
                              <CheckCircle className="w-4 h-4 text-green-500" />
                              <span className="text-muted-foreground">Has required skills</span>
                            </>
                          ) : (
                            <>
                              <AlertCircle className="w-4 h-4 text-amber-500" />
                              <span className="text-muted-foreground">Missing skills</span>
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    <Button
                      onClick={() => assignMutation.mutate(employee.id)}
                      disabled={assignMutation.isPending}
                      size="sm"
                    >
                      Assign
                    </Button>
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
