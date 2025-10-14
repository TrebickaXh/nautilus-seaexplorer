import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

interface ShiftFormProps {
  shiftId?: string;
  departmentId?: string;
  locationId?: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export function ShiftForm({ shiftId, departmentId, locationId, onSuccess, onCancel }: ShiftFormProps) {
  const [loading, setLoading] = useState(false);
  const [locations, setLocations] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    location_id: locationId || '',
    department_id: departmentId || '',
    start_time: '09:00',
    end_time: '17:00',
    days_of_week: [] as number[],
  });

  const dayLabels = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  useEffect(() => {
    loadLocations();
    if (shiftId) {
      loadShift();
    }
  }, [shiftId]);

  useEffect(() => {
    if (formData.location_id) {
      loadDepartments(formData.location_id);
    } else {
      setDepartments([]);
    }
  }, [formData.location_id]);

  const loadLocations = async () => {
    const { data, error } = await supabase
      .from('locations')
      .select('id, name')
      .is('archived_at', null)
      .order('name');

    if (error) {
      toast.error('Failed to load locations');
      return;
    }

    setLocations(data || []);
  };

  const loadDepartments = async (locationId: string) => {
    const { data, error } = await supabase
      .from('departments')
      .select('id, name')
      .eq('location_id', locationId)
      .is('archived_at', null)
      .order('name');

    if (error) {
      toast.error('Failed to load departments');
      return;
    }

    setDepartments(data || []);
  };

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
        location_id: data.location_id || '',
        department_id: data.department_id || '',
        start_time: data.start_time,
        end_time: data.end_time,
        days_of_week: data.days_of_week || [],
      });
    }
  };

  const handleDaysChange = (values: string[]) => {
    setFormData(prev => ({
      ...prev,
      days_of_week: values.map(Number).sort(),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!formData.location_id) {
        throw new Error('Please select a location');
      }

      if (!formData.department_id) {
        throw new Error('Please select a department');
      }

      if (formData.days_of_week.length === 0) {
        throw new Error('Please select at least one day');
      }

      const payload = {
        name: formData.name,
        location_id: formData.location_id,
        department_id: formData.department_id,
        start_time: formData.start_time,
        end_time: formData.end_time,
        days_of_week: formData.days_of_week,
      };

      if (shiftId) {
        // Update
        const { error } = await supabase
          .from('shifts')
          .update(payload)
          .eq('id', shiftId);

        if (error) throw error;
        toast.success('Shift updated');
      } else {
        // Create
        const { error } = await supabase
          .from('shifts')
          .insert(payload);

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
        <Label htmlFor="location">Location</Label>
        <Select
          value={formData.location_id}
          onValueChange={(value) => setFormData({ ...formData, location_id: value, department_id: '' })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a location" />
          </SelectTrigger>
          <SelectContent>
            {locations.map(location => (
              <SelectItem key={location.id} value={location.id}>
                {location.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="department">Department</Label>
        <Select
          value={formData.department_id}
          onValueChange={(value) => setFormData({ ...formData, department_id: value })}
          disabled={!formData.location_id}
        >
          <SelectTrigger>
            <SelectValue placeholder={formData.location_id ? "Select a department" : "Select a location first"} />
          </SelectTrigger>
          <SelectContent>
            {departments.map(dept => (
              <SelectItem key={dept.id} value={dept.id}>
                {dept.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

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
        <ToggleGroup
          type="multiple"
          value={formData.days_of_week.map(String)}
          onValueChange={handleDaysChange}
          className="flex flex-wrap gap-2 mt-2 justify-start"
        >
          {dayLabels.map((day, index) => (
            <ToggleGroupItem
              key={index}
              value={String(index)}
              className="flex-1 min-w-[100px]"
            >
              {day.substring(0, 3)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
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
