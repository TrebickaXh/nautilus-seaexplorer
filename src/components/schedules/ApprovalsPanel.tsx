import { Button } from "@/components/ui/button";
import { X, CheckCircle, XCircle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface ApprovalsPanelProps {
  onClose: () => void;
}

export function ApprovalsPanel({ onClose }: ApprovalsPanelProps) {
  const { data: claims, isLoading: claimsLoading, refetch: refetchClaims } = useQuery({
    queryKey: ["pending-claims"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shift_claims")
        .select(`
          *,
          claimant:profiles!shift_claims_claimant_employee_id_fkey(display_name),
          shift:shifts(
            *,
            department:departments(name)
          )
        `)
        .in("status", ["waiting", "manager_review"])
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const { data: swaps, isLoading: swapsLoading, refetch: refetchSwaps } = useQuery({
    queryKey: ["pending-swaps"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("swap_requests")
        .select(`
          *,
          from_assignment:schedule_assignments!swap_requests_from_assignment_id_fkey(
            employee:profiles(display_name),
            shift:shifts(*)
          ),
          to_employee:profiles!swap_requests_to_employee_id_fkey(display_name)
        `)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const handleApproveClaim = async (claimId: string, shiftId: string, employeeId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Update claim status
    const { error: claimError } = await supabase
      .from("shift_claims")
      .update({
        status: "accepted",
        reviewed_at: new Date().toISOString(),
        reviewed_by_user_id: user.id,
      })
      .eq("id", claimId);

    if (claimError) {
      toast.error("Failed to approve claim");
      return;
    }

    // Create assignment
    const { error: assignError } = await supabase
      .from("schedule_assignments")
      .insert({
        shift_id: shiftId,
        employee_id: employeeId,
        status: "assigned",
      });

    if (assignError) {
      toast.error("Failed to create assignment");
      return;
    }

    // Remove from open shift pool
    await supabase.from("open_shift_pool").delete().eq("shift_id", shiftId);

    toast.success("Claim approved");
    refetchClaims();
  };

  const handleRejectClaim = async (claimId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from("shift_claims")
      .update({
        status: "rejected",
        reviewed_at: new Date().toISOString(),
        reviewed_by_user_id: user.id,
      })
      .eq("id", claimId);

    if (error) {
      toast.error("Failed to reject claim");
    } else {
      toast.success("Claim rejected");
      refetchClaims();
    }
  };

  const handleApproveSwap = async (swapId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from("swap_requests")
      .update({
        status: "approved",
        manager_id: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", swapId);

    if (error) {
      toast.error("Failed to approve swap");
    } else {
      toast.success("Swap approved");
      refetchSwaps();
    }
  };

  const handleRejectSwap = async (swapId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from("swap_requests")
      .update({
        status: "rejected",
        manager_id: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", swapId);

    if (error) {
      toast.error("Failed to reject swap");
    } else {
      toast.success("Swap rejected");
      refetchSwaps();
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b flex items-center justify-between">
        <h2 className="font-semibold">Approvals</h2>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <Tabs defaultValue="claims" className="flex-1 flex flex-col">
        <TabsList className="mx-4 mt-4">
          <TabsTrigger value="claims">
            Claims {claims && claims.length > 0 && `(${claims.length})`}
          </TabsTrigger>
          <TabsTrigger value="swaps">
            Swaps {swaps && swaps.length > 0 && `(${swaps.length})`}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="claims" className="flex-1 overflow-auto p-4">
          {claimsLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : claims && claims.length > 0 ? (
            <div className="space-y-3">
              {claims.map((claim: any) => (
                <div key={claim.id} className="border rounded-lg p-3 space-y-3">
                  <div>
                    <div className="font-medium">{claim.claimant?.display_name}</div>
                    <div className="text-sm text-muted-foreground">
                      {claim.shift?.department?.name} • {format(new Date(claim.shift?.start_at), "MMM d, HH:mm")}
                    </div>
                  </div>

                  {claim.priority_score > 0 && (
                    <Badge variant="secondary">Priority: {claim.priority_score}</Badge>
                  )}

                  <div className="text-xs text-muted-foreground">
                    Requested {format(new Date(claim.created_at), "MMM d, HH:mm")}
                  </div>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={() =>
                        handleApproveClaim(claim.id, claim.shift_id, claim.claimant_employee_id)
                      }
                    >
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => handleRejectClaim(claim.id)}
                    >
                      <XCircle className="w-4 h-4 mr-1" />
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No pending claims
            </div>
          )}
        </TabsContent>

        <TabsContent value="swaps" className="flex-1 overflow-auto p-4">
          {swapsLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : swaps && swaps.length > 0 ? (
            <div className="space-y-3">
              {swaps.map((swap: any) => (
                <div key={swap.id} className="border rounded-lg p-3 space-y-3">
                  <div>
                    <div className="font-medium">
                      {swap.from_assignment?.employee?.display_name}
                      {swap.to_employee && ` ↔ ${swap.to_employee.display_name}`}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {format(new Date(swap.from_assignment?.shift?.start_at), "MMM d, HH:mm")}
                    </div>
                  </div>

                  <Badge variant="outline">{swap.type === "direct" ? "Direct Swap" : "Market"}</Badge>

                  {swap.reason && (
                    <div className="text-xs text-muted-foreground italic">"{swap.reason}"</div>
                  )}

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={() => handleApproveSwap(swap.id)}
                    >
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => handleRejectSwap(swap.id)}
                    >
                      <XCircle className="w-4 h-4 mr-1" />
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">No pending swaps</div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
