import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';

interface ShiftFormProps {
  shiftId?: string;
  departmentId?: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export function ShiftForm({ shiftId, departmentId, onSuccess, onCancel }: ShiftFormProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    start_time: '09:00',
    end_time: '17:00',
    days_of_week: [] as number[],
  });

  const dayLabels = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  useEffect(() => {
    if (shiftId) {
      loadShift();
    }
  }, [shiftId]);

  const loadShift = async () => {
    const { data, error } = await supabase
      .from('shifts')
      .select('*')
      .eq('id', shiftId)
      .single();

    if (error) {
      toast.error('Failed to load shift');
      return;
    }

    if (data) {
      setFormData({
        name: data.name,
        start_time: data.start_time,
        end_time: data.end_time,
        days_of_week: data.days_of_week || [],
      });
    }
  };

  const handleDayToggle = (dayIndex: number) => {
    setFormData(prev => ({
      ...prev,
      days_of_week: prev.days_of_week.includes(dayIndex)
        ? prev.days_of_week.filter(d => d !== dayIndex)
        : [...prev.days_of_week, dayIndex].sort(),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!departmentId && !shiftId) {
        throw new Error('Department ID required');
      }

      if (formData.days_of_week.length === 0) {
        throw new Error('Please select at least one day');
      }

      if (shiftId) {
        // Update
        const { error } = await supabase
          .from('shifts')
          .update({
            name: formData.name,
            start_time: formData.start_time,
            end_time: formData.end_time,
            days_of_week: formData.days_of_week,
          })
          .eq('id', shiftId);

        if (error) throw error;
        toast.success('Shift updated');
      } else {
        // Create
        const { error } = await supabase
          .from('shifts')
          .insert({
            department_id: departmentId!,
            name: formData.name,
            start_time: formData.start_time,
            end_time: formData.end_time,
            days_of_week: formData.days_of_week,
          });

        if (error) throw error;
        toast.success('Shift created');
      }

      onSuccess();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="name">Shift Name</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="e.g., Morning, Evening, Night"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="start_time">Start Time</Label>
          <Input
            id="start_time"
            type="time"
            value={formData.start_time}
            onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
            required
          />
        </div>
        <div>
          <Label htmlFor="end_time">End Time</Label>
          <Input
            id="end_time"
            type="time"
            value={formData.end_time}
            onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
            required
          />
        </div>
      </div>

      <div>
        <Label>Days of Week</Label>
        <div className="grid grid-cols-2 gap-2 mt-2">
          {dayLabels.map((day, index) => (
            <div key={index} className="flex items-center space-x-2">
              <Checkbox
                id={`day-${index}`}
                checked={formData.days_of_week.includes(index)}
                onCheckedChange={() => handleDayToggle(index)}
              />
              <label
                htmlFor={`day-${index}`}
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                {day}
              </label>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? 'Saving...' : shiftId ? 'Update' : 'Create'}
        </Button>
      </div>
    </form>
  );
}
