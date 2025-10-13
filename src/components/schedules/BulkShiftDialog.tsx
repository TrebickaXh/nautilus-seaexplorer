import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { addDays, format } from "date-fns";

const bulkShiftSchema = z.object({
  department_id: z.string().uuid(),
  location_id: z.string().uuid(),
  start_time: z.string(),
  end_time: z.string(),
  days_of_week: z.array(z.number()).min(1, "Select at least one day"),
  weeks: z.number().min(1).max(12),
});

type BulkShiftFormData = z.infer<typeof bulkShiftSchema>;

interface BulkShiftDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  startDate: Date;
}

const DAYS = [
  { label: "Monday", value: 1 },
  { label: "Tuesday", value: 2 },
  { label: "Wednesday", value: 3 },
  { label: "Thursday", value: 4 },
  { label: "Friday", value: 5 },
  { label: "Saturday", value: 6 },
  { label: "Sunday", value: 0 },
];

export function BulkShiftDialog({ open, onOpenChange, startDate }: BulkShiftDialogProps) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);

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

  const form = useForm<BulkShiftFormData>({
    resolver: zodResolver(bulkShiftSchema),
    defaultValues: {
      start_time: "08:00",
      end_time: "16:00",
      days_of_week: [],
      weeks: 4,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: BulkShiftFormData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const shifts = [];
      const currentDate = new Date(startDate);

      // Generate shifts for specified weeks
      for (let week = 0; week < data.weeks; week++) {
        for (let day = 0; day < 7; day++) {
          const checkDate = addDays(currentDate, week * 7 + day);
          const dayOfWeek = checkDate.getDay();

          if (data.days_of_week.includes(dayOfWeek)) {
            const shiftDate = format(checkDate, "yyyy-MM-dd");
            shifts.push({
              department_id: data.department_id,
              location_id: data.location_id,
              start_at: `${shiftDate}T${data.start_time}:00`,
              end_at: `${shiftDate}T${data.end_time}:00`,
              status: "open",
              name: `Shift ${data.start_time}`,
              start_time: `${data.start_time}:00`,
              end_time: `${data.end_time}:00`,
              days_of_week: [dayOfWeek],
              created_by: user.id,
            });
          }
        }
      }

      const { error } = await supabase.from("shifts").insert(shifts);
      if (error) throw error;

      return shifts.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["schedule-shifts"] });
      toast.success(`Created ${count} shifts successfully`);
      onOpenChange(false);
      form.reset();
    },
    onError: (error) => {
      toast.error("Failed to create shifts: " + error.message);
    },
  });

  const onSubmit = async (data: BulkShiftFormData) => {
    setLoading(true);
    try {
      await createMutation.mutateAsync(data);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create Recurring Shifts</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="department_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Department</FormLabel>
                  <Select
                    onValueChange={(value) => {
                      field.onChange(value);
                      const dept = departments.find((d: any) => d.id === value);
                      if (dept) {
                        form.setValue("location_id", dept.location_id);
                      }
                    }}
                    value={field.value}
                  >
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
                name="start_time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Time</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="end_time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>End Time</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="days_of_week"
              render={() => (
                <FormItem>
                  <FormLabel>Days of Week</FormLabel>
                  <div className="grid grid-cols-4 gap-3">
                    {DAYS.map((day) => (
                      <FormField
                        key={day.value}
                        control={form.control}
                        name="days_of_week"
                        render={({ field }) => (
                          <FormItem className="flex items-center space-x-2 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value?.includes(day.value)}
                                onCheckedChange={(checked) => {
                                  const current = field.value || [];
                                  field.onChange(
                                    checked
                                      ? [...current, day.value]
                                      : current.filter((v) => v !== day.value)
                                  );
                                }}
                              />
                            </FormControl>
                            <FormLabel className="font-normal cursor-pointer">
                              {day.label}
                            </FormLabel>
                          </FormItem>
                        )}
                      />
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="weeks"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Number of Weeks</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="1"
                      max="12"
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value))}
                    />
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
                {loading ? "Creating..." : "Create Shifts"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
