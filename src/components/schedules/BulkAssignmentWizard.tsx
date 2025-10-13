import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Users, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useConflictDetection } from "@/hooks/useConflictDetection";

interface BulkAssignmentWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shifts: any[];
  employees: any[];
}

export function BulkAssignmentWizard({
  open,
  onOpenChange,
  shifts,
  employees,
}: BulkAssignmentWizardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedShifts, setSelectedShifts] = useState<Set<string>>(new Set());
  const [assignments, setAssignments] = useState<Map<string, string>>(new Map());

  const conflicts = useConflictDetection(
    shifts.filter(s => selectedShifts.has(s.id))
  );

  const assignMutation = useMutation({
    mutationFn: async () => {
      const assignmentsToCreate = Array.from(assignments.entries()).map(([shiftId, employeeId]) => ({
        shift_id: shiftId,
        employee_id: employeeId,
        status: "assigned" as const,
        assignment_method: "bulk",
      }));

      const { error } = await supabase
        .from("schedule_assignments")
        .insert(assignmentsToCreate);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedule-shifts"] });
      queryClient.invalidateQueries({ queryKey: ["schedule-assignments"] });
      toast({
        title: "Bulk assignment complete",
        description: `Successfully assigned ${assignments.size} shifts.`,
      });
      setSelectedShifts(new Set());
      setAssignments(new Map());
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

  const toggleShift = (shiftId: string) => {
    const newSelected = new Set(selectedShifts);
    if (newSelected.has(shiftId)) {
      newSelected.delete(shiftId);
      const newAssignments = new Map(assignments);
      newAssignments.delete(shiftId);
      setAssignments(newAssignments);
    } else {
      newSelected.add(shiftId);
    }
    setSelectedShifts(newSelected);
  };

  const assignEmployee = (shiftId: string, employeeId: string) => {
    const newAssignments = new Map(assignments);
    newAssignments.set(shiftId, employeeId);
    setAssignments(newAssignments);
  };

  const unassignedShifts = shifts.filter(
    s => selectedShifts.has(s.id) && !assignments.has(s.id)
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Bulk Assignment Wizard
          </SheetTitle>
          <SheetDescription>
            Select shifts and assign employees in bulk
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <div>
            <h3 className="text-sm font-medium mb-3">Step 1: Select Shifts</h3>
            <ScrollArea className="h-[200px] border rounded-lg p-3">
              <div className="space-y-2">
                {shifts.map((shift) => (
                  <div
                    key={shift.id}
                    className="flex items-center gap-3 p-2 hover:bg-accent rounded"
                  >
                    <Checkbox
                      checked={selectedShifts.has(shift.id)}
                      onCheckedChange={() => toggleShift(shift.id)}
                    />
                    <div className="flex-1">
                      <p className="font-medium">{shift.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(shift.start_at).toLocaleDateString()} •{" "}
                        {new Date(shift.start_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}{" "}
                        -{" "}
                        {new Date(shift.end_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    {shift.department_name && (
                      <Badge variant="outline">{shift.department_name}</Badge>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
            <p className="text-sm text-muted-foreground mt-2">
              {selectedShifts.size} shift{selectedShifts.size !== 1 ? "s" : ""} selected
            </p>
          </div>

          {selectedShifts.size > 0 && (
            <div>
              <h3 className="text-sm font-medium mb-3">Step 2: Assign Employees</h3>
              <ScrollArea className="h-[300px] border rounded-lg p-3">
                <div className="space-y-4">
                  {Array.from(selectedShifts).map((shiftId) => {
                    const shift = shifts.find(s => s.id === shiftId);
                    if (!shift) return null;

                    return (
                      <div key={shiftId} className="space-y-2 pb-4 border-b last:border-b-0">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          <p className="font-medium text-sm">{shift.name}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-2 ml-6">
                          {employees.map((emp) => (
                            <Button
                              key={emp.id}
                              variant={assignments.get(shiftId) === emp.id ? "default" : "outline"}
                              size="sm"
                              onClick={() => assignEmployee(shiftId, emp.id)}
                              className="justify-start text-xs"
                            >
                              {emp.display_name}
                            </Button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
              <p className="text-sm text-muted-foreground mt-2">
                {assignments.size}/{selectedShifts.size} shifts assigned
              </p>
            </div>
          )}

          {unassignedShifts.length > 0 && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                {unassignedShifts.length} shift{unassignedShifts.length !== 1 ? "s" : ""} still
                need employee assignment
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => assignMutation.mutate()}
              disabled={assignments.size === 0 || assignMutation.isPending}
            >
              {assignMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Assign {assignments.size} Shift{assignments.size !== 1 ? "s" : ""}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}