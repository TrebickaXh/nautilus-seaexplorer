import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { CronBuilder } from './CronBuilder';
import { toast } from 'sonner';
import { format } from 'date-fns';

const formSchema = z.object({
  template_id: z.string().min(1, 'Template is required'),
  type: z.enum(['window', 'cron', 'oneoff']),
  department_id: z.string().optional(),
  shift_id: z.string().optional(),
  days_of_week: z.array(z.number()).optional(),
  window_start: z.string().optional(),
  window_end: z.string().optional(),
  cron_expr: z.string()
    .regex(/^(@(annually|yearly|monthly|weekly|daily|hourly|reboot))|(@every (\d+(ns|us|µs|ms|s|m|h))+)|((((\d+,)+\d+|(\d+(\/|-)\d+)|\d+|\*) ?){5,7})$/, 
      'Invalid cron expression')
    .optional(),
  oneoff_date: z.string().optional(),
  oneoff_time: z.string().optional(),
  assignee_role: z.enum(['crew', 'location_manager', 'org_admin']).optional(),
  shift_name: z.string().trim().max(100, 'Shift name must be less than 100 characters').optional(),
}).refine(
  (data) => {
    if (data.type === 'window' && data.window_start && data.window_end) {
      return data.window_end > data.window_start;
    }
    return true;
  },
  {
    message: 'End time must be after start time',
    path: ['window_end'],
  }
);

type FormValues = z.infer<typeof formSchema>;

interface ScheduleFormProps {
  scheduleId?: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export function ScheduleForm({ scheduleId, onSuccess, onCancel }: ScheduleFormProps) {
  const [templates, setTemplates] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      type: 'window',
      days_of_week: [],
      window_start: '08:00',
      window_end: '10:00',
      assignee_role: 'crew',
      department_id: undefined,
      shift_id: undefined,
    },
  });

  const scheduleType = form.watch('type');

  const loadTemplates = async () => {
    const { data } = await supabase
      .from('task_templates')
      .select('id, title, department_id, departments(name)')
      .is('archived_at', null)
      .order('title');
    if (data) setTemplates(data);
  };

  const loadDepartments = async () => {
    const { data } = await supabase
      .from('departments')
      .select('id, name')
      .is('archived_at', null)
      .order('name');
    if (data) setDepartments(data);
  };

  const loadShifts = async (departmentId?: string) => {
    if (!departmentId) {
      setShifts([]);
      return;
    }
    const { data } = await supabase
      .from('shifts')
      .select('id, name, start_time, end_time')
      .eq('department_id', departmentId)
      .is('archived_at', null)
      .order('start_time');
    if (data) setShifts(data);
  };

  const loadSchedule = async () => {
    if (!scheduleId) return;
    const { data } = await supabase
      .from('schedules')
      .select('*')
      .eq('id', scheduleId)
      .single();
    if (data) {
      form.reset(data);
      if (data.department_id) {
        loadShifts(data.department_id);
      }
    }
  };

  useEffect(() => {
    loadTemplates();
    loadDepartments();
    if (scheduleId) {
      loadSchedule();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheduleId]);

  // Load shifts when department_id changes
  useEffect(() => {
    const deptId = form.watch('department_id');
    if (deptId) {
      loadShifts(deptId);
    } else {
      setShifts([]);
      form.setValue('shift_id', undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.watch('department_id')]);

  const onSubmit = async (values: FormValues) => {
    setLoading(true);
    try {
      const payload: any = {
        template_id: values.template_id,
        type: values.type,
        department_id: values.department_id || null,
        shift_id: values.shift_id || null,
        assignee_role: values.assignee_role || null,
        shift_name: values.shift_name || null,
      };

      if (values.type === 'window') {
        payload.days_of_week = values.days_of_week;
        payload.window_start = values.window_start;
        payload.window_end = values.window_end;
      } else if (values.type === 'cron') {
        payload.cron_expr = values.cron_expr;
      } else if (values.type === 'oneoff') {
        const datetime = `${values.oneoff_date} ${values.oneoff_time}`;
        payload.window_start = datetime;
      }

      if (scheduleId) {
        const { error } = await supabase
          .from('schedules')
          .update(payload)
          .eq('id', scheduleId);
        if (error) throw error;
        toast.success('Schedule updated');
      } else {
        const { error } = await supabase
          .from('schedules')
          .insert(payload);
        if (error) throw error;
        toast.success('Schedule created');
      }

      onSuccess();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const daysOfWeek = [
    { label: 'Monday', value: 1 },
    { label: 'Tuesday', value: 2 },
    { label: 'Wednesday', value: 3 },
    { label: 'Thursday', value: 4 },
    { label: 'Friday', value: 5 },
    { label: 'Saturday', value: 6 },
    { label: 'Sunday', value: 0 },
  ];

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {step === 1 && (
          <>
            <FormField
              control={form.control}
              name="template_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Task Template</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select template" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {templates.map(t => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.title}
                          {t.departments?.name && ` (${t.departments.name})`}
                        </SelectItem>
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
                  <FormLabel>Department (Optional)</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="None - Select if needed" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {departments.map(d => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Link this schedule to a specific department
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        )}

        {step === 2 && (
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Schedule Type</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="window">Window (Days of Week)</SelectItem>
                    <SelectItem value="cron">Cron Expression</SelectItem>
                    <SelectItem value="oneoff">One-off</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {step === 3 && scheduleType === 'window' && (
          <>
            <FormField
              control={form.control}
              name="days_of_week"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Days of Week</FormLabel>
                  <div className="grid grid-cols-2 gap-2">
                    {daysOfWeek.map(day => (
                      <div key={day.value} className="flex items-center space-x-2">
                        <Checkbox
                          checked={field.value?.includes(day.value)}
                          onCheckedChange={(checked) => {
                            const current = field.value || [];
                            const updated = checked
                              ? [...current, day.value]
                              : current.filter(v => v !== day.value);
                            field.onChange(updated);
                          }}
                        />
                        <label className="text-sm">{day.label}</label>
                      </div>
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="window_start"
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
                name="window_end"
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
          </>
        )}

        {step === 3 && scheduleType === 'cron' && (
          <FormField
            control={form.control}
            name="cron_expr"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Cron Schedule</FormLabel>
                <CronBuilder value={field.value || '0 9 * * *'} onChange={field.onChange} />
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {step === 3 && scheduleType === 'oneoff' && (
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="oneoff_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} min={format(new Date(), 'yyyy-MM-dd')} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="oneoff_time"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Time</FormLabel>
                  <FormControl>
                    <Input type="time" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        )}

        {step === 4 && (
          <>
            <FormField
              control={form.control}
              name="shift_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Shift (Optional)</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    value={field.value}
                    disabled={shifts.length === 0}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={shifts.length === 0 ? "Select a department first" : "None - Select if needed"} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {shifts.map(s => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name} ({s.start_time} - {s.end_time})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Link this schedule to a specific shift within the department
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="assignee_role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Assign To Role (Optional)</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Auto-assign by role" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="crew">Crew</SelectItem>
                      <SelectItem value="location_manager">Location Manager</SelectItem>
                      <SelectItem value="org_admin">Organization Admin</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Tasks will be assigned to users with this role
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="shift_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Legacy Shift Name (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Morning Shift" {...field} />
                  </FormControl>
                  <FormDescription>
                    For backward compatibility only - use Shift field above instead
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        )}

        <div className="flex justify-between">
          <div className="space-x-2">
            {step > 1 && (
              <Button type="button" variant="outline" onClick={() => setStep(step - 1)}>
                Back
              </Button>
            )}
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          </div>

          {step < 4 ? (
            <Button type="button" onClick={() => setStep(step + 1)}>
              Next
            </Button>
          ) : (
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : scheduleId ? 'Update' : 'Create'}
            </Button>
          )}
        </div>
      </form>
    </Form>
  );
}
