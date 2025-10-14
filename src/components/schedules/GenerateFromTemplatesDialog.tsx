import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CalendarIcon, Loader2 } from 'lucide-react';
import { format, addDays, startOfWeek, endOfWeek } from 'date-fns';
import { useQuery } from '@tanstack/react-query';

interface GenerateFromTemplatesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function GenerateFromTemplatesDialog({
  open,
  onOpenChange,
  onSuccess,
}: GenerateFromTemplatesDialogProps) {
  const [startDate, setStartDate] = useState<Date>(startOfWeek(new Date()));
  const [endDate, setEndDate] = useState<Date>(endOfWeek(addDays(new Date(), 14)));
  const [departmentId, setDepartmentId] = useState<string>('');
  const [autoAssign, setAutoAssign] = useState(true);
  const [loading, setLoading] = useState(false);

  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('departments')
        .select('id, name, locations(name)')
        .is('archived_at', null)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: templates } = useQuery({
    queryKey: ['shift-templates', departmentId],
    queryFn: async () => {
      let query = supabase
        .from('shifts')
        .select('id, name, days_of_week, start_time, end_time')
        .eq('is_template', true)
        .is('archived_at', null);

      if (departmentId) {
        query = query.eq('department_id', departmentId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const handleGenerate = async () => {
    if (!startDate || !endDate) {
      toast.error('Please select both start and end dates');
      return;
    }

    if (endDate < startDate) {
      toast.error('End date must be after start date');
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('materialize-shifts-from-templates', {
        body: {
          start_date: startDate.toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0],
          department_id: departmentId || null,
          auto_assign: autoAssign,
        },
      });

      if (error) throw error;

      toast.success(
        `Generated ${data.shifts_created} shifts with ${data.assignments_created} assignments`
      );
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error generating shifts:', error);
      toast.error(error.message || 'Failed to generate shifts from templates');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Generate Shifts from Templates</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, 'PPP') : 'Select date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={startDate} onSelect={(date) => date && setStartDate(date)} />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>End Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, 'PPP') : 'Select date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={endDate} onSelect={(date) => date && setEndDate(date)} />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Department (Optional)</Label>
            <Select value={departmentId} onValueChange={setDepartmentId}>
              <SelectTrigger>
                <SelectValue placeholder="All departments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All departments</SelectItem>
                {departments?.map((dept) => (
                  <SelectItem key={dept.id} value={dept.id}>
                    {dept.name} - {dept.locations?.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label>Auto-assign eligible employees</Label>
              <p className="text-sm text-muted-foreground">
                Automatically assign employees who are assigned to the shift templates
              </p>
            </div>
            <Switch checked={autoAssign} onCheckedChange={setAutoAssign} />
          </div>

          {templates && templates.length > 0 && (
            <div className="rounded-lg border p-4 space-y-2">
              <Label>Preview ({templates.length} templates)</Label>
              <div className="text-sm text-muted-foreground space-y-1">
                {templates.slice(0, 5).map((template) => (
                  <div key={template.id}>
                    • {template.name} ({template.start_time} - {template.end_time})
                  </div>
                ))}
                {templates.length > 5 && (
                  <div className="text-xs text-muted-foreground italic">
                    ... and {templates.length - 5} more
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleGenerate} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Generate Shifts
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
