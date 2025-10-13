import { useState } from "react";
import { AutoAssignDialog } from "./AutoAssignDialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

const shiftSchema = z.object({
  department_id: z.string().uuid(),
  location_id: z.string().uuid(),
  start_at: z.string(),
  end_at: z.string(),
  status: z.enum(["scheduled", "open", "pending_swap", "approved", "canceled"]).default("scheduled"),
  required_skills: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

type ShiftFormData = z.infer<typeof shiftSchema>;

interface ShiftDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editShift?: any;
  defaultDate?: Date;
}

export function ShiftDialog({ open, onOpenChange, editShift, defaultDate }: ShiftDialogProps) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [showAutoAssign, setShowAutoAssign] = useState(false);
  const [createdShiftId, setCreatedShiftId] = useState<string | null>(null);

  const { data: departments = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("departments")
        .select("id, name, location_id, locations(id, name)")
        .is("archived_at", null);
      if (error) throw error;
      return data;
    },
  });

  const { data: positions = [] } = useQuery({
    queryKey: ["positions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("positions")
        .select("id, name, required_skills")
        .is("archived_at", null);
      if (error) throw error;
      return data;
    },
  });

  const form = useForm<ShiftFormData>({
    resolver: zodResolver(shiftSchema),
    defaultValues: editShift ? {
      department_id: editShift.department_id,
      location_id: editShift.location_id,
      start_at: editShift.start_at,
      end_at: editShift.end_at,
      status: editShift.status,
      notes: editShift.notes || "",
    } : {
      start_at: defaultDate ? format(defaultDate, "yyyy-MM-dd'T'08:00") : "",
      end_at: defaultDate ? format(defaultDate, "yyyy-MM-dd'T'16:00") : "",
      status: "scheduled",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: ShiftFormData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Generate a default name from start time
      const shiftName = `Shift ${format(new Date(data.start_at), "HH:mm")}`;

      const { data: newShift, error } = await supabase.from("shifts").insert({
        department_id: data.department_id,
        location_id: data.location_id,
        start_at: data.start_at,
        end_at: data.end_at,
        status: data.status,
        required_skills: data.required_skills || [],
        notes: data.notes,
        created_by: user.id,
        name: shiftName,
        start_time: format(new Date(data.start_at), "HH:mm:ss"),
        end_time: format(new Date(data.end_at), "HH:mm:ss"),
        days_of_week: [new Date(data.start_at).getDay()],
      }).select().single();
      if (error) throw error;
      return newShift;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["schedule-shifts"] });
      toast.success("Shift created successfully");
      setCreatedShiftId(data.id);
      setShowAutoAssign(true);
    },
    onError: (error) => {
      toast.error("Failed to create shift: " + error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: ShiftFormData) => {
      const { error } = await supabase
        .from("shifts")
        .update(data)
        .eq("id", editShift.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedule-shifts"] });
      toast.success("Shift updated successfully");
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error("Failed to update shift: " + error.message);
    },
  });

  const onSubmit = async (data: ShiftFormData) => {
    setLoading(true);
    try {
      if (editShift) {
        await updateMutation.mutateAsync(data);
      } else {
        await createMutation.mutateAsync(data);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editShift ? "Edit Shift" : "Create Shift"}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="department_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Department</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select department" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {departments.map((dept: any) => (
                        <SelectItem key={dept.id} value={dept.id}>
                          {dept.name} - {dept.locations?.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="start_at"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Time</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="end_at"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>End Time</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="scheduled">Scheduled</SelectItem>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Optional shift notes" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Saving..." : editShift ? "Update" : "Create"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>

      {createdShiftId && (
        <AutoAssignDialog
          open={showAutoAssign}
          onOpenChange={(open) => {
            setShowAutoAssign(open);
            if (!open) {
              setCreatedShiftId(null);
              onOpenChange(false);
              form.reset();
            }
          }}
          shiftId={createdShiftId}
        />
      )}
    </Dialog>
  );
}
