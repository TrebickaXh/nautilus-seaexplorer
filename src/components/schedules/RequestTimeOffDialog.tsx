import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

interface RequestTimeOffDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RequestTimeOffDialog({ open, onOpenChange }: RequestTimeOffDialogProps) {
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [type, setType] = useState<string>("vacation");
  const [reason, setReason] = useState("");
  const queryClient = useQueryClient();

  const requestMutation = useMutation({
    mutationFn: async () => {
      if (!startDate || !endDate) throw new Error("Please select start and end dates");

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("time_off_requests")
        .insert({
          employee_id: user.id,
          start_date: format(startDate, "yyyy-MM-dd"),
          end_date: format(endDate, "yyyy-MM-dd"),
          type,
          reason,
          status: "pending",
        });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Time-off request submitted");
      queryClient.invalidateQueries({ queryKey: ["time-off-requests"] });
      onOpenChange(false);
      setStartDate(undefined);
      setEndDate(undefined);
      setReason("");
    },
    onError: (error) => {
      toast.error("Failed to submit request: " + error.message);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Request Time Off</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Start Date</Label>
              <Calendar
                mode="single"
                selected={startDate}
                onSelect={setStartDate}
                className="mt-2 rounded-md border"
              />
            </div>

            <div>
              <Label>End Date</Label>
              <Calendar
                mode="single"
                selected={endDate}
                onSelect={setEndDate}
                disabled={(date) => startDate ? date < startDate : false}
                className="mt-2 rounded-md border"
              />
            </div>
          </div>

          <div>
            <Label>Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="vacation">Vacation</SelectItem>
                <SelectItem value="sick">Sick Leave</SelectItem>
                <SelectItem value="personal">Personal Day</SelectItem>
                <SelectItem value="unpaid">Unpaid Leave</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Reason (Optional)</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Provide additional context..."
              className="mt-2"
              rows={3}
            />
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => requestMutation.mutate()}
              disabled={!startDate || !endDate || requestMutation.isPending}
            >
              Submit Request
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
