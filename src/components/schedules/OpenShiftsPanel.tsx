import { Button } from "@/components/ui/button";
import { X, Clock, MapPin } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface OpenShiftsPanelProps {
  onClose: () => void;
}

export function OpenShiftsPanel({ onClose }: OpenShiftsPanelProps) {
  const { data: openShifts, isLoading } = useQuery({
    queryKey: ["open-shifts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("open_shift_pool")
        .select(`
          *,
          shift:shifts(
            *,
            department:departments(name),
            location:locations(name)
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const handleClaim = async (shiftId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from("shift_claims")
      .insert({
        shift_id: shiftId,
        claimant_employee_id: user.id,
        status: "waiting",
      });

    if (error) {
      toast.error("Failed to claim shift");
    } else {
      toast.success("Claim submitted for manager review");
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b flex items-center justify-between">
        <h2 className="font-semibold">Open Shifts Marketplace</h2>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : openShifts && openShifts.length > 0 ? (
          <div className="space-y-3">
            {openShifts.map((openShift: any) => {
              const shift = openShift.shift;
              return (
                <div key={openShift.id} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-medium">
                        {shift.department?.name || "Unknown Dept"}
                      </div>
                      <div className="text-sm text-muted-foreground flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {shift.location?.name || "Unknown Location"}
                      </div>
                    </div>
                    {openShift.bonus_cents > 0 && (
                      <Badge variant="default">
                        +${(openShift.bonus_cents / 100).toFixed(2)}
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="w-4 h-4" />
                    <span>
                      {format(new Date(shift.start_at), "MMM d, HH:mm")} -{" "}
                      {format(new Date(shift.end_at), "HH:mm")}
                    </span>
                  </div>

                  {openShift.post_reason && (
                    <div className="text-xs text-muted-foreground italic">
                      "{openShift.post_reason}"
                    </div>
                  )}

                  <Button
                    className="w-full"
                    size="sm"
                    onClick={() => handleClaim(shift.id)}
                  >
                    Claim Shift
                  </Button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            No open shifts available
          </div>
        )}
      </div>
    </div>
  );
}
