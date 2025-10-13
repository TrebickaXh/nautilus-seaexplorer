import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { X, Check, XCircle, Calendar } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

interface TimeOffPanelProps {
  onClose: () => void;
}

export function TimeOffPanel({ onClose }: TimeOffPanelProps) {
  const queryClient = useQueryClient();

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["time-off-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_off_requests")
        .select(`
          *,
          employee:profiles!time_off_requests_employee_id_fkey(id, display_name)
        `)
        .eq("status", "pending")
        .order("start_date", { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("time_off_requests")
        .update({
          status: "approved",
          approved_by_user_id: user.id,
          approved_at: new Date().toISOString(),
        })
        .eq("id", requestId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["time-off-requests"] });
      toast.success("Time off request approved");
    },
    onError: (error) => {
      toast.error("Failed to approve: " + error.message);
    },
  });

  const denyMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const { error } = await supabase
        .from("time_off_requests")
        .update({ status: "denied" })
        .eq("id", requestId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["time-off-requests"] });
      toast.success("Time off request denied");
    },
    onError: (error) => {
      toast.error("Failed to deny: " + error.message);
    },
  });

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          <h2 className="text-lg font-semibold">Time Off Requests</h2>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1 p-4">
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : requests.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No pending time off requests
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map((request: any) => (
              <div key={request.id} className="p-4 border rounded-lg space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-medium">{request.employee?.display_name}</div>
                    <div className="text-sm text-muted-foreground">
                      {format(new Date(request.start_date), "MMM d")} -{" "}
                      {format(new Date(request.end_date), "MMM d, yyyy")}
                    </div>
                  </div>
                  <Badge variant="secondary">{request.type}</Badge>
                </div>

                {request.reason && (
                  <div className="text-sm text-muted-foreground">
                    <span className="font-medium">Reason:</span> {request.reason}
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => approveMutation.mutate(request.id)}
                    disabled={approveMutation.isPending}
                  >
                    <Check className="w-4 h-4 mr-1" />
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => denyMutation.mutate(request.id)}
                    disabled={denyMutation.isPending}
                  >
                    <XCircle className="w-4 h-4 mr-1" />
                    Deny
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
