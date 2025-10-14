import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { AlertTriangle, Clock, Users, ArrowRight } from "lucide-react";
import { useConflictDetection } from "@/hooks/useConflictDetection";
import { format } from "date-fns";
import { useState } from "react";
import { AssignEmployeeDialog } from "./AssignEmployeeDialog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ConflictResolutionPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shifts: any[];
  employees: any[];
}

export function ConflictResolutionPanel({ open, onOpenChange, shifts, employees }: ConflictResolutionPanelProps) {
  const conflicts = useConflictDetection(shifts);
  const [selectedShift, setSelectedShift] = useState<any>(null);
  const [reassignDialogOpen, setReassignDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  // Group conflicts by type
  const groupedConflicts = {
    critical: [] as any[],
    warnings: [] as any[],
  };

  Object.entries(conflicts).forEach(([employeeId, employeeConflicts]) => {
    const employee = employees.find(e => e.id === employeeId);
    employeeConflicts.forEach(conflict => {
      const affectedShifts = conflict.shiftIds.map(sid => shifts.find(s => s.id === sid)).filter(Boolean);
      
      const conflictData = {
        ...conflict,
        employee,
        affectedShifts,
      };

      if (conflict.type === "overlap" || conflict.type === "rest_violation") {
        groupedConflicts.critical.push(conflictData);
      } else {
        groupedConflicts.warnings.push(conflictData);
      }
    });
  });

  const unassignMutation = useMutation({
    mutationFn: async (shiftId: string) => {
      const { error } = await supabase
        .from("schedule_assignments")
        .delete()
        .eq("shift_id", shiftId);
      
      if (error) throw error;

      await supabase
        .from("shifts")
        .update({ status: "open" })
        .eq("id", shiftId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedule-shifts"] });
      toast.success("Shift unassigned");
    },
    onError: (error: Error) => {
      toast.error("Failed to unassign: " + error.message);
    },
  });

  const getIcon = (type: string) => {
    switch (type) {
      case "rest_violation":
      case "overtime":
        return <Clock className="w-4 h-4" />;
      case "availability":
        return <Users className="w-4 h-4" />;
      default:
        return <AlertTriangle className="w-4 h-4" />;
    }
  };

  const totalConflicts = groupedConflicts.critical.length + groupedConflicts.warnings.length;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Conflict Resolution
              {totalConflicts > 0 && (
                <Badge variant="destructive">{totalConflicts}</Badge>
              )}
            </SheetTitle>
          </SheetHeader>

          <ScrollArea className="h-[calc(100vh-8rem)] mt-6">
            {totalConflicts === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="rounded-full bg-green-100 p-3 mb-4">
                  <Clock className="w-6 h-6 text-green-600" />
                </div>
                <h3 className="font-semibold mb-2">No Conflicts Found</h3>
                <p className="text-muted-foreground text-sm">
                  All shifts are properly scheduled with no conflicts
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Critical Conflicts */}
                {groupedConflicts.critical.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <AlertTriangle className="w-5 h-5 text-destructive" />
                      <h3 className="font-semibold">Critical Issues</h3>
                      <Badge variant="destructive">{groupedConflicts.critical.length}</Badge>
                    </div>
                    
                    <div className="space-y-4">
                      {groupedConflicts.critical.map((conflict, idx) => (
                        <div key={idx} className="border border-destructive/50 rounded-lg p-4 bg-destructive/5">
                          <div className="flex items-start gap-3">
                            {getIcon(conflict.type)}
                            <div className="flex-1 space-y-2">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <p className="font-medium">{conflict.employee?.display_name}</p>
                                  <p className="text-sm text-muted-foreground">{conflict.message}</p>
                                </div>
                              </div>
                              
                              <div className="flex flex-wrap gap-2 items-center text-sm">
                                {conflict.affectedShifts.map((shift: any, i: number) => (
                                  <div key={shift.id} className="flex items-center gap-2">
                                    <Badge variant="outline">
                                      {format(new Date(shift.start_at), "MMM d, h:mm a")} - 
                                      {format(new Date(shift.end_at), "h:mm a")}
                                    </Badge>
                                    {i < conflict.affectedShifts.length - 1 && (
                                      <ArrowRight className="w-3 h-3 text-muted-foreground" />
                                    )}
                                  </div>
                                ))}
                              </div>

                              <div className="flex gap-2 mt-3">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setSelectedShift(conflict.affectedShifts[0]);
                                    setReassignDialogOpen(true);
                                  }}
                                >
                                  Reassign
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => unassignMutation.mutate(conflict.affectedShifts[0].id)}
                                  disabled={unassignMutation.isPending}
                                >
                                  Unassign
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {groupedConflicts.critical.length > 0 && groupedConflicts.warnings.length > 0 && (
                  <Separator />
                )}

                {/* Warning Conflicts */}
                {groupedConflicts.warnings.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <AlertTriangle className="w-5 h-5 text-amber-500" />
                      <h3 className="font-semibold">Warnings</h3>
                      <Badge variant="secondary">{groupedConflicts.warnings.length}</Badge>
                    </div>
                    
                    <div className="space-y-4">
                      {groupedConflicts.warnings.map((conflict, idx) => (
                        <div key={idx} className="border rounded-lg p-4 bg-amber-50/50">
                          <div className="flex items-start gap-3">
                            {getIcon(conflict.type)}
                            <div className="flex-1 space-y-2">
                              <div>
                                <p className="font-medium">{conflict.employee?.display_name}</p>
                                <p className="text-sm text-muted-foreground">{conflict.message}</p>
                              </div>
                              
                              <div className="flex flex-wrap gap-2 items-center text-sm">
                                {conflict.affectedShifts.map((shift: any) => (
                                  <Badge key={shift.id} variant="outline">
                                    {format(new Date(shift.start_at), "MMM d, h:mm a")} - 
                                    {format(new Date(shift.end_at), "h:mm a")}
                                  </Badge>
                                ))}
                              </div>

                              <div className="flex gap-2 mt-3">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setSelectedShift(conflict.affectedShifts[0]);
                                    setReassignDialogOpen(true);
                                  }}
                                >
                                  Reassign
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {selectedShift && (
        <AssignEmployeeDialog
          shift={selectedShift}
          open={reassignDialogOpen}
          onOpenChange={setReassignDialogOpen}
        />
      )}
    </>
  );
}
