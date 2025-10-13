import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { Clock, MapPin, Briefcase, DollarSign } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ShiftClaimDialogProps {
  shift: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ShiftClaimDialog({ shift, open, onOpenChange }: ShiftClaimDialogProps) {
  const [reason, setReason] = useState("");
  const queryClient = useQueryClient();

  const claimMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("shift_claims")
        .insert({
          shift_id: shift.id,
          claimant_employee_id: user.id,
          status: "waiting",
        });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Shift claim submitted for approval");
      queryClient.invalidateQueries({ queryKey: ["schedule-shifts"] });
      onOpenChange(false);
      setReason("");
    },
    onError: (error) => {
      toast.error("Failed to claim shift: " + error.message);
    },
  });

  if (!shift) return null;

  const bonusAmount = shift.bonus_cents ? (shift.bonus_cents / 100).toFixed(2) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Claim Open Shift</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm">
                {format(new Date(shift.start_at), "MMM d, yyyy · HH:mm")} -{" "}
                {format(new Date(shift.end_at), "HH:mm")}
              </span>
            </div>

            {shift.department_name && (
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">{shift.department_name}</span>
              </div>
            )}

            {shift.position_name && (
              <div className="flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">{shift.position_name}</span>
              </div>
            )}

            {bonusAmount && (
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-success" />
                <span className="text-sm font-medium text-success">
                  ${bonusAmount} bonus
                </span>
              </div>
            )}
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

          <div>
            <label className="text-sm font-medium mb-2 block">
              Why are you interested? (Optional)
            </label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Add any relevant information..."
              rows={3}
            />
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => claimMutation.mutate()}
              disabled={claimMutation.isPending}
            >
              Submit Claim
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
