import { X, User, Clock, Award } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { ConflictIndicator } from "./ConflictIndicator";

interface ClaimsPanelProps {
  onClose: () => void;
}

export function ClaimsPanel({ onClose }: ClaimsPanelProps) {
  const queryClient = useQueryClient();

  const { data: claims, isLoading } = useQuery({
    queryKey: ["shift-claims-pending"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shift_claims")
        .select(`
          *,
          shift:shifts(
            *,
            department:departments(name),
            location:locations(name)
          ),
          claimant:profiles!shift_claims_claimant_employee_id_fkey(
            id,
            display_name,
            position_id
          )
        `)
        .eq("status", "waiting")
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  const approveMutation = useMutation({
    mutationFn: async ({ claimId, shiftId, employeeId }: { claimId: string; shiftId: string; employeeId: string }) => {
      // Create assignment
      const { error: assignError } = await supabase
        .from("schedule_assignments")
        .insert({
          shift_id: shiftId,
          employee_id: employeeId,
          status: "assigned",
        });

      if (assignError) throw assignError;

      // Update claim status
      const { error: claimError } = await supabase
        .from("shift_claims")
        .update({ 
          status: "accepted",
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", claimId);

      if (claimError) throw claimError;

      // Remove from open shift pool
      const { error: poolError } = await supabase
        .from("open_shift_pool")
        .delete()
        .eq("shift_id", shiftId);

      if (poolError) throw poolError;
    },
    onSuccess: () => {
      toast.success("Claim approved and shift assigned");
      queryClient.invalidateQueries({ queryKey: ["shift-claims-pending"] });
      queryClient.invalidateQueries({ queryKey: ["schedule-shifts"] });
      queryClient.invalidateQueries({ queryKey: ["open-shifts"] });
    },
    onError: (error) => {
      toast.error("Failed to approve claim: " + error.message);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (claimId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("shift_claims")
        .update({ 
          status: "rejected",
          reviewed_by_user_id: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", claimId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Claim rejected");
      queryClient.invalidateQueries({ queryKey: ["shift-claims-pending"] });
    },
    onError: (error) => {
      toast.error("Failed to reject claim: " + error.message);
    },
  });

  const conflicts = (rulesResult: any) => {
    if (!rulesResult?.conflicts) return [];
    return Object.entries(rulesResult.conflicts)
      .filter(([_, hasConflict]) => hasConflict)
      .map(([type]) => ({
        type: type as any,
        message: `${type.replace(/_/g, " ")} detected`,
      }));
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b flex items-center justify-between">
        <h2 className="font-semibold">Shift Claims</h2>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : claims && claims.length > 0 ? (
          <div className="space-y-3">
            {claims.map((claim: any) => {
              const shift = claim.shift;
              const claimant = claim.claimant;
              const claimConflicts = conflicts(claim.rules_result);

              return (
                <Card key={claim.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium">{claimant?.display_name}</span>
                        {claim.priority_score > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            <Award className="w-3 h-3 mr-1" />
                            Priority: {claim.priority_score}
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {shift.department?.name} · {shift.location?.name}
                      </div>
                    </div>
                    {claimConflicts.length > 0 && (
                      <ConflictIndicator conflicts={claimConflicts} />
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span>
                      {format(new Date(shift.start_at), "MMM d, HH:mm")} -{" "}
                      {format(new Date(shift.end_at), "HH:mm")}
                    </span>
                  </div>

                  <div className="text-xs text-muted-foreground">
                    Claimed {format(new Date(claim.created_at), "MMM d 'at' HH:mm")}
                  </div>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => rejectMutation.mutate(claim.id)}
                      disabled={rejectMutation.isPending}
                    >
                      Reject
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={() =>
                        approveMutation.mutate({
                          claimId: claim.id,
                          shiftId: shift.id,
                          employeeId: claimant.id,
                        })
                      }
                      disabled={approveMutation.isPending}
                    >
                      Approve & Assign
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            No pending claims
          </div>
        )}
      </div>
    </div>
  );
}
