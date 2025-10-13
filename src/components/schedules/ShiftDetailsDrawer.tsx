import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { Clock, MapPin, User, Edit, Trash2, Share2, RefreshCw } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useUserRole } from "@/hooks/useUserRole";
import { useState } from "react";
import { ShiftDialog } from "./ShiftDialog";
import { AssignEmployeeDialog } from "./AssignEmployeeDialog";

interface ShiftDetailsDrawerProps {
  shift: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ShiftDetailsDrawer({ shift, open, onOpenChange }: ShiftDetailsDrawerProps) {
  const queryClient = useQueryClient();
  const { isAdmin } = useUserRole();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);

  const postToOpenMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Create open shift pool entry
      const { error } = await supabase.from("open_shift_pool").insert({
        shift_id: shift.id,
        posted_by_employee_id: user.id,
        post_reason: "Employee posted to marketplace",
      });
      if (error) throw error;

      // Update shift status
      await supabase.from("shifts").update({ status: "open" }).eq("id", shift.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedule-shifts"] });
      toast.success("Shift posted to marketplace");
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error("Failed to post shift: " + error.message);
    },
  });

  const deleteShiftMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("shifts").delete().eq("id", shift.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedule-shifts"] });
      toast.success("Shift deleted");
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error("Failed to delete shift: " + error.message);
    },
  });

  const requestSwapMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Find user's assignment for this shift
      const { data: assignment } = await supabase
        .from("schedule_assignments")
        .select("id")
        .eq("shift_id", shift.id)
        .eq("employee_id", user.id)
        .single();

      if (!assignment) throw new Error("No assignment found");

      const { error } = await supabase.from("swap_requests").insert({
        from_assignment_id: assignment.id,
        type: "market",
        status: "pending",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedule-shifts"] });
      toast.success("Swap request submitted");
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error("Failed to request swap: " + error.message);
    },
  });

  if (!shift) return null;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Shift Details</SheetTitle>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            {/* Time and Location */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span>
                  {format(new Date(shift.start_at), "MMM d, yyyy")}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-muted-foreground" />
                <div>
                  <div className="font-semibold">
                    {format(new Date(shift.start_at), "HH:mm")} - {format(new Date(shift.end_at), "HH:mm")}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {Math.round((new Date(shift.end_at).getTime() - new Date(shift.start_at).getTime()) / (1000 * 60 * 60))} hours
                  </div>
                </div>
              </div>

              {shift.department_name && (
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  <span>{shift.department_name}</span>
                </div>
              )}

              {shift.employee_name && (
                <div className="flex items-center gap-2 text-sm">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <span>{shift.employee_name}</span>
                </div>
              )}
            </div>

            <Separator />

            {/* Status and Badges */}
            <div className="space-y-2">
              <div className="flex gap-2 flex-wrap">
                <Badge variant={shift.status === "open" ? "default" : "secondary"}>
                  {shift.status}
                </Badge>
                {shift.is_open && <Badge variant="outline">Open Shift</Badge>}
                {shift.has_claims && <Badge variant="default">Has Claims</Badge>}
                {shift.requires_skills?.length > 0 && (
                  <Badge variant="secondary">Skills Required</Badge>
                )}
              </div>
            </div>

            {shift.requires_skills?.length > 0 && (
              <>
                <Separator />
                <div>
                  <div className="text-sm font-medium mb-2">Required Skills</div>
                  <div className="flex gap-2 flex-wrap">
                    {shift.requires_skills.map((skill: string) => (
                      <Badge key={skill} variant="outline">{skill}</Badge>
                    ))}
                  </div>
                </div>
              </>
            )}

            {shift.notes && (
              <>
                <Separator />
                <div>
                  <div className="text-sm font-medium mb-2">Notes</div>
                  <p className="text-sm text-muted-foreground">{shift.notes}</p>
                </div>
              </>
            )}

            <Separator />

            {/* Actions */}
            <div className="space-y-2">
              {isAdmin && (
                <>
                  {!shift.employee_name && (
                    <Button
                      className="w-full"
                      onClick={() => setAssignDialogOpen(true)}
                    >
                      <User className="w-4 h-4 mr-2" />
                      Assign Employee
                    </Button>
                  )}
                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={() => setEditDialogOpen(true)}
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Edit Shift
                  </Button>
                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={() => deleteShiftMutation.mutate()}
                    disabled={deleteShiftMutation.isPending}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Shift
                  </Button>
                </>
              )}

              {shift.employee_id && !shift.is_open && (
                <>
                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={() => postToOpenMutation.mutate()}
                    disabled={postToOpenMutation.isPending}
                  >
                    <Share2 className="w-4 h-4 mr-2" />
                    Post to Marketplace
                  </Button>
                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={() => requestSwapMutation.mutate()}
                    disabled={requestSwapMutation.isPending}
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Request Swap
                  </Button>
                </>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {editDialogOpen && (
        <ShiftDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          editShift={shift}
        />
      )}

      <AssignEmployeeDialog
        shift={shift}
        open={assignDialogOpen}
        onOpenChange={setAssignDialogOpen}
      />
    </>
  );
}
