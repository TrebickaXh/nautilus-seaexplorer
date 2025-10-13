import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { AlertTriangle, CheckCircle2, Send, Users } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface PublishScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  weekStart: Date;
  weekEnd: Date;
  shifts: any[];
}

export function PublishScheduleDialog({
  open,
  onOpenChange,
  weekStart,
  weekEnd,
  shifts,
}: PublishScheduleDialogProps) {
  const queryClient = useQueryClient();
  const [notifyEmployees, setNotifyEmployees] = useState(true);

  const stats = {
    total: shifts.length,
    assigned: shifts.filter((s) => s.employee_id).length,
    unassigned: shifts.filter((s) => !s.employee_id).length,
    conflicts: shifts.filter((s) => s.has_conflicts).length,
  };

  const hasIssues = stats.unassigned > 0 || stats.conflicts > 0;

  const publishMutation = useMutation({
    mutationFn: async () => {
      // Update shift statuses to scheduled (published state)
      const shiftIds = shifts.map((s) => s.id);
      
      const { error: updateError } = await supabase
        .from("shifts")
        .update({ status: "scheduled" })
        .in("id", shiftIds);

      if (updateError) throw updateError;

      // If notify is enabled, trigger notifications (edge function)
      if (notifyEmployees) {
        const { error: notifyError } = await supabase.functions.invoke(
          "notify-schedule-published",
          {
            body: {
              weekStart: weekStart.toISOString(),
              weekEnd: weekEnd.toISOString(),
              shiftIds,
            },
          }
        );

        if (notifyError) {
          console.error("Notification error:", notifyError);
          // Don't fail the entire operation if notifications fail
        }
      }
    },
    onSuccess: () => {
      toast.success(
        `Schedule published for ${format(weekStart, "MMM d")} - ${format(
          weekEnd,
          "MMM d"
        )}`
      );
      queryClient.invalidateQueries({ queryKey: ["schedule-data"] });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to publish schedule");
    },
  });

  const handlePublish = () => {
    if (hasIssues) {
      const confirm = window.confirm(
        "This schedule has unassigned shifts or conflicts. Are you sure you want to publish?"
      );
      if (!confirm) return;
    }
    publishMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="w-5 h-5" />
            Publish Schedule
          </DialogTitle>
          <DialogDescription>
            Publish schedule for {format(weekStart, "MMM d")} -{" "}
            {format(weekEnd, "MMM d, yyyy")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-muted">
              <div className="text-2xl font-bold">{stats.total}</div>
              <div className="text-xs text-muted-foreground">Total Shifts</div>
            </div>
            <div className="p-3 rounded-lg bg-green-50 border border-green-200">
              <div className="text-2xl font-bold text-green-700">
                {stats.assigned}
              </div>
              <div className="text-xs text-green-600">Assigned</div>
            </div>
            {stats.unassigned > 0 && (
              <div className="p-3 rounded-lg bg-orange-50 border border-orange-200">
                <div className="text-2xl font-bold text-orange-700">
                  {stats.unassigned}
                </div>
                <div className="text-xs text-orange-600">Unassigned</div>
              </div>
            )}
            {stats.conflicts > 0 && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                <div className="text-2xl font-bold text-red-700">
                  {stats.conflicts}
                </div>
                <div className="text-xs text-red-600">Conflicts</div>
              </div>
            )}
          </div>

          {/* Warnings */}
          {hasIssues && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {stats.unassigned > 0 && (
                  <div>• {stats.unassigned} shifts are unassigned</div>
                )}
                {stats.conflicts > 0 && (
                  <div>• {stats.conflicts} shifts have conflicts</div>
                )}
              </AlertDescription>
            </Alert>
          )}

          {!hasIssues && (
            <Alert>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription>
                All shifts are assigned with no conflicts detected.
              </AlertDescription>
            </Alert>
          )}

          {/* Notification Option */}
          <div className="flex items-center space-x-2 p-4 border rounded-lg">
            <Checkbox
              id="notify"
              checked={notifyEmployees}
              onCheckedChange={(checked) => setNotifyEmployees(checked as boolean)}
            />
            <div className="flex-1">
              <Label
                htmlFor="notify"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Notify employees
              </Label>
              <p className="text-xs text-muted-foreground mt-1">
                Send notifications to all assigned employees
              </p>
            </div>
            <Users className="w-4 h-4 text-muted-foreground" />
          </div>

          {/* Info */}
          <div className="text-xs text-muted-foreground space-y-1 p-3 bg-muted rounded-lg">
            <p>
              <strong>What happens when you publish:</strong>
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Schedule becomes visible to all employees</li>
              <li>Employees receive notifications (if enabled)</li>
              <li>Shifts are locked from accidental changes</li>
              <li>Time-off requests for this period are finalized</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={publishMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handlePublish}
            disabled={publishMutation.isPending}
            className="gap-2"
          >
            {publishMutation.isPending ? (
              "Publishing..."
            ) : (
              <>
                <Send className="w-4 h-4" />
                Publish Schedule
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
