import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

interface AvailabilityDialogProps {
  employeeId: string;
  employeeName: string;
  currentAvailability: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

export function AvailabilityDialog({
  employeeId,
  employeeName,
  currentAvailability,
  open,
  onOpenChange,
}: AvailabilityDialogProps) {
  const queryClient = useQueryClient();
  const [availability, setAvailability] = useState<any>(
    currentAvailability || {
      mon: [],
      tue: [],
      wed: [],
      thu: [],
      fri: [],
      sat: [],
      sun: [],
    }
  );

  const addTimeSlot = (dayKey: string) => {
    setAvailability({
      ...availability,
      [dayKey]: [...(availability[dayKey] || []), ["09:00", "17:00"]],
    });
  };

  const removeTimeSlot = (dayKey: string, index: number) => {
    const slots = [...availability[dayKey]];
    slots.splice(index, 1);
    setAvailability({
      ...availability,
      [dayKey]: slots,
    });
  };

  const updateTimeSlot = (dayKey: string, index: number, timeIndex: number, value: string) => {
    const slots = [...availability[dayKey]];
    slots[index][timeIndex] = value;
    setAvailability({
      ...availability,
      [dayKey]: slots,
    });
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("profiles")
        .update({ availability_rules: availability })
        .eq("id", employeeId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedule-shifts"] });
      queryClient.invalidateQueries({ queryKey: ["available-employees"] });
      toast.success("Availability updated successfully");
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error("Failed to update availability: " + error.message);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Set Availability - {employeeName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {DAYS.map((day, idx) => {
            const dayKey = DAY_KEYS[idx];
            const slots = availability[dayKey] || [];

            return (
              <div key={dayKey} className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-medium">{day}</Label>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => addTimeSlot(dayKey)}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add Slot
                  </Button>
                </div>

                {slots.length === 0 ? (
                  <div className="text-sm text-muted-foreground py-2">No availability</div>
                ) : (
                  <div className="space-y-2">
                    {slots.map((slot: string[], slotIdx: number) => (
                      <div key={slotIdx} className="flex items-center gap-2">
                        <Input
                          type="time"
                          value={slot[0]}
                          onChange={(e) =>
                            updateTimeSlot(dayKey, slotIdx, 0, e.target.value)
                          }
                          className="w-32"
                        />
                        <span className="text-muted-foreground">to</span>
                        <Input
                          type="time"
                          value={slot[1]}
                          onChange={(e) =>
                            updateTimeSlot(dayKey, slotIdx, 1, e.target.value)
                          }
                          className="w-32"
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeTimeSlot(dayKey, slotIdx)}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? "Saving..." : "Save Availability"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
