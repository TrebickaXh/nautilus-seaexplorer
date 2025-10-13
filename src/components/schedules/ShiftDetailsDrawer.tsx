import { useState } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { Clock, MapPin, Users, Briefcase, RefreshCw, UserX } from "lucide-react";
import { AssignEmployeeDialog } from "./AssignEmployeeDialog";
import { SwapRequestDialog } from "./SwapRequestDialog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useUserRole } from "@/hooks/useUserRole";

interface ShiftDetailsDrawerProps {
  shift: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ShiftDetailsDrawer({ shift, open, onOpenChange }: ShiftDetailsDrawerProps) {
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [swapDialogOpen, setSwapDialogOpen] = useState(false);
  const { isAdmin } = useUserRole();
  const queryClient = useQueryClient();

  const unassignMutation = useMutation({
    mutationFn: async () => {
      if (!shift.assignment_id) return;
      
      const { error } = await supabase
        .from("schedule_assignments")
        .delete()
        .eq("id", shift.assignment_id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Employee unassigned from shift");
      queryClient.invalidateQueries({ queryKey: ["schedule-data"] });
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error("Failed to unassign employee: " + error.message);
    },
  });

  if (!shift) return null;

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Shift Details</DrawerTitle>
          </DrawerHeader>

          <div className="p-6 space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-muted-foreground" />
                <span className="font-medium">
                  {format(new Date(shift.start_at), "MMM d, yyyy · HH:mm")} -{" "}
                  {format(new Date(shift.end_at), "HH:mm")}
                </span>
              </div>

              {shift.department_name && (
                <div className="flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-muted-foreground" />
                  <span>{shift.department_name}</span>
                </div>
              )}

              {shift.position_name && (
                <div className="flex items-center gap-2">
                  <Briefcase className="w-5 h-5 text-muted-foreground" />
                  <span>{shift.position_name}</span>
                </div>
              )}
            </div>

            <div className="flex gap-2 flex-wrap">
              {shift.is_open && <Badge variant="default">Open Shift</Badge>}
              {shift.has_claims && <Badge>Has Claims</Badge>}
              {shift.requires_skills?.length > 0 && <Badge variant="secondary">Skills Required</Badge>}
            </div>

            {shift.requires_skills?.length > 0 && (
              <div>
                <div className="text-sm font-medium mb-2">Required Skills:</div>
                <div className="flex gap-2 flex-wrap">
                  {shift.requires_skills.map((skill: string) => (
                    <Badge key={skill} variant="outline">
                      {skill}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="p-6 pt-0">
            {!shift.employee_id ? (
              isAdmin() ? (
                <Button className="w-full" onClick={() => setAssignDialogOpen(true)}>
                  <Users className="w-4 h-4 mr-2" />
                  Assign Employee
                </Button>
              ) : (
                <Button className="w-full" variant="outline" onClick={() => setSwapDialogOpen(true)}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Request Swap
                </Button>
              )
            ) : (
              <div className="space-y-2">
                {shift.employee_name && (
                  <div className="p-3 bg-muted rounded-lg">
                    <div className="text-sm text-muted-foreground mb-1">Assigned to:</div>
                    <div className="font-medium">{shift.employee_name}</div>
                  </div>
                )}
                {isAdmin() && (
                  <Button 
                    className="w-full" 
                    variant="destructive"
                    onClick={() => unassignMutation.mutate()}
                    disabled={unassignMutation.isPending}
                  >
                    <UserX className="w-4 h-4 mr-2" />
                    Unassign Employee
                  </Button>
                )}
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>

      <AssignEmployeeDialog
        open={assignDialogOpen}
        onOpenChange={setAssignDialogOpen}
        shift={shift}
      />

      {shift.assignment_id && (
        <SwapRequestDialog
          open={swapDialogOpen}
          onOpenChange={setSwapDialogOpen}
          assignmentId={shift.assignment_id}
          shiftDetails={shift}
        />
      )}
    </>
  );
}
