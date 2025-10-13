import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { addDays, format } from "date-fns";

interface CopyWeekDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceWeekStart: Date;
}

export function CopyWeekDialog({ open, onOpenChange, sourceWeekStart }: CopyWeekDialogProps) {
  const [targetDate, setTargetDate] = useState<Date>();
  const [copyAssignments, setCopyAssignments] = useState(true);
  const queryClient = useQueryClient();

  const copyMutation = useMutation({
    mutationFn: async () => {
      if (!targetDate) throw new Error("Please select a target week");

      const sourceEnd = addDays(sourceWeekStart, 7);
      
      // Fetch source week shifts
      const { data: sourceShifts, error: fetchError } = await supabase
        .from("shifts")
        .select(`
          *,
          assignments:schedule_assignments(*)
        `)
        .gte("start_at", sourceWeekStart.toISOString())
        .lt("start_at", sourceEnd.toISOString());

      if (fetchError) throw fetchError;
      if (!sourceShifts?.length) throw new Error("No shifts found in source week");

      // Calculate day offset
      const dayOffset = Math.floor(
        (targetDate.getTime() - sourceWeekStart.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Create new shifts
      const newShifts = sourceShifts.map((shift) => ({
        location_id: shift.location_id,
        department_id: shift.department_id,
        name: shift.name,
        start_at: new Date(
          new Date(shift.start_at).getTime() + dayOffset * 24 * 60 * 60 * 1000
        ).toISOString(),
        end_at: new Date(
          new Date(shift.end_at).getTime() + dayOffset * 24 * 60 * 60 * 1000
        ).toISOString(),
        start_time: shift.start_time,
        end_time: shift.end_time,
        days_of_week: shift.days_of_week,
        required_skills: shift.required_skills,
        notes: shift.notes,
        status: "scheduled" as const,
      }));

      const { data: createdShifts, error: insertError } = await supabase
        .from("shifts")
        .insert(newShifts)
        .select();

      if (insertError) throw insertError;

      // Copy assignments if requested
      if (copyAssignments && createdShifts) {
        const assignments = [];
        for (let i = 0; i < sourceShifts.length; i++) {
          const sourceAssignment = sourceShifts[i].assignments?.[0];
          if (sourceAssignment) {
            assignments.push({
              shift_id: createdShifts[i].id,
              employee_id: sourceAssignment.employee_id,
              status: "assigned",
            });
          }
        }

        if (assignments.length > 0) {
          const { error: assignError } = await supabase
            .from("schedule_assignments")
            .insert(assignments);

          if (assignError) throw assignError;
        }
      }

      return createdShifts;
    },
    onSuccess: (data) => {
      toast.success(`Copied ${data?.length || 0} shifts to target week`);
      queryClient.invalidateQueries({ queryKey: ["schedule-shifts"] });
      onOpenChange(false);
      setTargetDate(undefined);
    },
    onError: (error) => {
      toast.error("Failed to copy week: " + error.message);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Copy Week</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Source Week</Label>
            <div className="text-sm text-muted-foreground mt-1">
              {format(sourceWeekStart, "MMM d")} -{" "}
              {format(addDays(sourceWeekStart, 6), "MMM d, yyyy")}
            </div>
          </div>

          <div>
            <Label>Target Week Start</Label>
            <Calendar
              mode="single"
              selected={targetDate}
              onSelect={setTargetDate}
              className="mt-2 rounded-md border"
            />
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="copy-assignments"
              checked={copyAssignments}
              onCheckedChange={(checked) => setCopyAssignments(checked === true)}
            />
            <Label htmlFor="copy-assignments" className="text-sm cursor-pointer">
              Copy employee assignments
            </Label>
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => copyMutation.mutate()}
              disabled={!targetDate || copyMutation.isPending}
            >
              Copy Week
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
