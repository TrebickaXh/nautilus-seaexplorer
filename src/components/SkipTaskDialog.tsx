import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Loader2, AlertTriangle } from 'lucide-react';

const skipSchema = z.object({
  reason: z.enum([
    'no_supplies',
    'equipment_broken',
    'area_locked',
    'safety_concern',
    'other'
  ], {
    required_error: 'Please select a reason',
  }),
  note: z.string().min(1, 'Please provide additional details').max(500, 'Note must be less than 500 characters'),
});

type SkipFormData = z.infer<typeof skipSchema>;

interface SkipTaskDialogProps {
  taskId: string | null;
  taskTemplate: any;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const SKIP_REASONS = {
  no_supplies: 'No Supplies Available',
  equipment_broken: 'Equipment Broken/Unavailable',
  area_locked: 'Area Locked/Inaccessible',
  safety_concern: 'Safety Concern',
  other: 'Other',
};

export function SkipTaskDialog({
  taskId,
  taskTemplate,
  open,
  onClose,
  onSuccess,
}: SkipTaskDialogProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const form = useForm<SkipFormData>({
    resolver: zodResolver(skipSchema),
    defaultValues: {
      reason: undefined,
      note: '',
    },
  });

  const onSubmit = async (data: SkipFormData) => {
    if (!taskId) return;

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Update task status to skipped
      const { error: updateError } = await supabase
        .from('task_instances')
        .update({
          status: 'skipped',
          completed_at: new Date().toISOString(),
        })
        .eq('id', taskId);

      if (updateError) throw updateError;

      // Create completion record with skip reason
      const { error: completionError } = await supabase
        .from('completions')
        .insert({
          task_instance_id: taskId,
          user_id: user.id,
          note: `[${SKIP_REASONS[data.reason]}] ${data.note}`,
          photo_url: null,
        });

      if (completionError) throw completionError;

      toast({
        title: 'Task Skipped',
        description: 'The task has been marked as skipped with your reason.',
      });

      form.reset();
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error skipping task:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to skip task',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      form.reset();
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            Skip Task
          </DialogTitle>
          <DialogDescription>
            {taskTemplate?.title && (
              <span className="font-medium">{taskTemplate.title}</span>
            )}
            {' '}
            Please provide a reason for skipping this task.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason for Skipping</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    disabled={loading}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a reason..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(SKIP_REASONS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
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
              name="note"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Additional Details</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Provide additional context or details..."
                      className="min-h-[100px]"
                      {...field}
                      disabled={loading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button type="submit" variant="destructive" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Skip Task
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
