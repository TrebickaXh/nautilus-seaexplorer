import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { format } from 'date-fns';

const formSchema = z.object({
  routine_id: z.string().min(1, 'Routine is required'),
  location_id: z.string().min(1, 'Location is required'),
  department_id: z.string().min(1, 'Department is required'),
  due_date: z.string().min(1, 'Due date is required'),
  due_time: z.string().min(1, 'Due time is required'),
  assigned_role: z.enum(['crew', 'location_manager', 'org_admin']).optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface OneOffTaskDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function OneOffTaskDialog({ open, onClose, onSuccess }: OneOffTaskDialogProps) {
  const [templates, setTemplates] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      due_date: format(new Date(), 'yyyy-MM-dd'),
      due_time: '09:00',
    },
  });

  const selectedLocationId = form.watch('location_id');
  const selectedDepartmentId = form.watch('department_id');

  useEffect(() => {
    if (open) {
      loadTemplates();
      loadLocations();
    }
  }, [open]);

  useEffect(() => {
    if (selectedLocationId) {
      loadDepartments(selectedLocationId);
    } else {
      setDepartments([]);
      form.setValue('department_id', '');
    }
  }, [selectedLocationId]);

  useEffect(() => {
    if (selectedLocationId && selectedDepartmentId) {
      loadShifts(selectedLocationId, selectedDepartmentId);
    } else {
      setShifts([]);
    }
  }, [selectedLocationId, selectedDepartmentId]);

  const loadTemplates = async () => {
    const { data } = await supabase
      .from('task_routines')
      .select('*')
      .is('archived_at', null)
      .order('title');
    if (data) setTemplates(data);
  };

  const loadLocations = async () => {
    const { data } = await supabase
      .from('locations')
      .select('*')
      .is('archived_at', null)
      .order('name');
    if (data) setLocations(data);
  };

  const loadDepartments = async (locationId: string) => {
    const { data } = await supabase
      .from('departments')
      .select('id, name')
      .eq('location_id', locationId)
      .is('archived_at', null)
      .order('name');
    if (data) setDepartments(data);
  };

  const loadShifts = async (locationId: string, departmentId: string) => {
    const { data } = await supabase
      .from('shifts')
      .select('id, name, start_time, end_time, days_of_week')
      .eq('location_id', locationId)
      .eq('department_id', departmentId)
      .is('archived_at', null)
      .order('start_time');
    if (data) setShifts(data);
  };

  const determineShift = (dueTime: string): string | null => {
    if (shifts.length === 0) return null;

    // Find shift that contains the due time
    const matchingShift = shifts.find(shift => {
      return dueTime >= shift.start_time && dueTime <= shift.end_time;
    });

    if (matchingShift) {
      return matchingShift.id;
    }

    // Find the most recent shift that ended before the due time
    const priorShifts = shifts.filter(shift => shift.end_time < dueTime);
    if (priorShifts.length > 0) {
      // Return the shift with the latest end_time
      const sortedPriorShifts = priorShifts.sort((a, b) => 
        b.end_time.localeCompare(a.end_time)
      );
      return sortedPriorShifts[0].id;
    }

    // If no prior shift, return the last shift of the day
    return shifts[shifts.length - 1].id;
  };

  const onSubmit = async (values: FormValues) => {
    setLoading(true);
    try {
      const dueAt = `${values.due_date}T${values.due_time}:00`;
      
      // Automatically determine the shift based on due time
      const shiftId = determineShift(values.due_time);
      
      const payload: any = {
        routine_id: values.routine_id,
        location_id: values.location_id,
        department_id: values.department_id,
        due_at: dueAt,
        status: 'pending',
        created_from: 'manual',
      };

      if (shiftId) {
        payload.shift_id = shiftId;
      }

      if (values.assigned_role) {
        payload.assigned_role = values.assigned_role;
      }

      const { error } = await supabase
        .from('task_instances')
        .insert(payload);

      if (error) throw error;

      toast.success('One-off task created successfully');
      form.reset();
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create task');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create One-off Task</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="routine_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Task Routine</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select template" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {templates.map(t => (
                        <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="location_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select location" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {locations.map(l => (
                        <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="department_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Department</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    value={field.value}
                    disabled={!selectedLocationId}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={selectedLocationId ? "Select department" : "Select location first"} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {departments.map(d => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
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
                name="due_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Due Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} min={format(new Date(), 'yyyy-MM-dd')} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="due_time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Due Time</FormLabel>
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
              name="assigned_role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Assigned Role (Optional)</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="None - Select role if needed" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="crew">Crew</SelectItem>
                      <SelectItem value="location_manager">Location Manager</SelectItem>
                      <SelectItem value="org_admin">Organization Admin</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Creating...' : 'Create Task'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
