import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface SwapRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignmentId: string;
  shiftDetails: any;
}

export function SwapRequestDialog({
  open,
  onOpenChange,
  assignmentId,
  shiftDetails,
}: SwapRequestDialogProps) {
  const [swapType, setSwapType] = useState<"market" | "direct">("market");
  const [targetEmployeeId, setTargetEmployeeId] = useState<string>("");
  const [reason, setReason] = useState("");
  const queryClient = useQueryClient();

  const { data: employees = [] } = useQuery({
    queryKey: ["employees-for-swap", shiftDetails?.department_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, position_id")
        .eq("active", true)
        .neq("id", (await supabase.auth.getUser()).data.user?.id);

      if (error) throw error;
      return data;
    },
    enabled: open && swapType === "direct",
  });

  const createSwapMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("swap_requests").insert({
        from_assignment_id: assignmentId,
        type: swapType,
        to_employee_id: swapType === "direct" ? targetEmployeeId : null,
        reason: reason || null,
        status: "pending",
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Swap request created successfully");
      queryClient.invalidateQueries({ queryKey: ["schedule-data"] });
      queryClient.invalidateQueries({ queryKey: ["swap-requests"] });
      onOpenChange(false);
      setReason("");
      setTargetEmployeeId("");
    },
    onError: (error) => {
      toast.error("Failed to create swap request: " + error.message);
    },
  });

  const handleSubmit = () => {
    if (swapType === "direct" && !targetEmployeeId) {
      toast.error("Please select an employee to swap with");
      return;
    }
    createSwapMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Request Shift Swap</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label>Swap Type</Label>
            <Select value={swapType} onValueChange={(v: any) => setSwapType(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="market">Open to Anyone</SelectItem>
                <SelectItem value="direct">Direct Swap</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              {swapType === "market"
                ? "Your shift will be available for any qualified employee to claim"
                : "Request a swap with a specific employee"}
            </p>
          </div>

          {swapType === "direct" && (
            <div>
              <Label>Select Employee</Label>
              <Select value={targetEmployeeId} onValueChange={setTargetEmployeeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose an employee" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((emp: any) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.display_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label>Reason (Optional)</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why you need to swap this shift..."
              rows={3}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={createSwapMutation.isPending}>
            {createSwapMutation.isPending && (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            )}
            Submit Request
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
