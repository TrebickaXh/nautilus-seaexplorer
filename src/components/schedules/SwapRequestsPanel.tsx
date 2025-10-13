import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { X, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface SwapRequestsPanelProps {
  onClose: () => void;
}

export function SwapRequestsPanel({ onClose }: SwapRequestsPanelProps) {
  const queryClient = useQueryClient();

  const { data: swapRequests = [], isLoading } = useQuery({
    queryKey: ["swap-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("swap_requests")
        .select(`
          *,
          from_assignment:schedule_assignments!from_assignment_id(
            id,
            employee:profiles!schedule_assignments_employee_id_fkey(display_name),
            shift:shifts(
              id,
              name,
              start_at,
              end_at,
              department:departments(name)
            )
          ),
          to_employee:profiles!swap_requests_to_employee_id_fkey(display_name)
        `)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const updateSwapMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { data: user } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from("swap_requests")
        .update({
          status: status as "pending" | "approved" | "rejected" | "canceled",
          manager_id: user.user?.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Swap request updated");
      queryClient.invalidateQueries({ queryKey: ["swap-requests"] });
      queryClient.invalidateQueries({ queryKey: ["schedule-data"] });
    },
    onError: (error) => {
      toast.error("Failed to update swap request: " + error.message);
    },
  });

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b flex items-center justify-between">
        <h2 className="text-lg font-semibold">Swap Requests</h2>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : swapRequests.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No pending swap requests
          </div>
        ) : (
          <div className="space-y-3">
            {swapRequests.map((request: any) => (
              <Card key={request.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">
                      {request.from_assignment?.shift?.name}
                    </CardTitle>
                    <Badge variant={request.type === "direct" ? "default" : "secondary"}>
                      {request.type === "direct" ? "Direct" : "Open"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">From:</span>
                      <span className="font-medium">
                        {request.from_assignment?.employee?.display_name}
                      </span>
                    </div>
                    {request.to_employee && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">To:</span>
                        <span className="font-medium">
                          {request.to_employee.display_name}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Department:</span>
                      <span>{request.from_assignment?.shift?.department?.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Date:</span>
                      <span>
                        {format(
                          new Date(request.from_assignment?.shift?.start_at),
                          "MMM d, yyyy"
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Time:</span>
                      <span>
                        {format(
                          new Date(request.from_assignment?.shift?.start_at),
                          "HH:mm"
                        )}{" "}
                        -{" "}
                        {format(
                          new Date(request.from_assignment?.shift?.end_at),
                          "HH:mm"
                        )}
                      </span>
                    </div>
                    {request.reason && (
                      <div className="pt-2 border-t">
                        <p className="text-muted-foreground text-xs mb-1">Reason:</p>
                        <p className="text-sm">{request.reason}</p>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button
                      size="sm"
                      variant="default"
                      className="flex-1"
                      onClick={() =>
                        updateSwapMutation.mutate({
                          id: request.id,
                          status: "approved",
                        })
                      }
                    >
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="flex-1"
                      onClick={() =>
                        updateSwapMutation.mutate({
                          id: request.id,
                          status: "denied",
                        })
                      }
                    >
                      <XCircle className="w-4 h-4 mr-1" />
                      Deny
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
