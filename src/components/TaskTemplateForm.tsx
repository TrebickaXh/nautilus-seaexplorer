import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Plus, X, Calendar } from 'lucide-react';
import { z } from 'zod';
import { CronBuilder } from './CronBuilder';

const templateSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200, "Title must be less than 200 characters"),
  description: z.string().max(1000, "Description must be less than 1000 characters").optional(),
  est_minutes: z.number().min(1, "Estimated time must be at least 1 minute").max(480, "Estimated time must be less than 8 hours"),
  steps: z.array(z.string().max(500, "Step must be less than 500 characters")).max(20, "Maximum 20 steps allowed"),
  location_id: z.string().min(1, "Location is required"),
  department_id: z.string().min(1, "Department is required"),
  shift_id: z.string().min(1, "Shift is required"),
  area_ids: z.array(z.string()).min(1, "At least one area is required"),
});

interface TaskTemplateFormProps {
  template?: any;
  onSuccess: () => void;
  onCancel: () => void;
}

export const TaskTemplateForm = ({ template, onSuccess, onCancel }: TaskTemplateFormProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [locations, setLocations] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [areas, setAreas] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    title: template?.title || '',
    description: template?.description || '',
    est_minutes: template?.est_minutes || 15,
    criticality: template?.criticality || 3,
    required_proof: template?.required_proof || 'none',
    steps: template?.steps || [],
    location_id: template?.location_id || '',
    department_id: template?.department_id || '',
    shift_id: template?.shift_id || '',
    area_ids: template?.area_ids || [],
    recurrence_v2: template?.recurrence_v2 || {
      type: 'daily',
      time_of_day: '09:00',
      days_of_week: [],
    },
  });
  const [newStep, setNewStep] = useState('');
  const [upcomingSlots, setUpcomingSlots] = useState<string[]>([]);

  useEffect(() => {
    loadLocations();
  }, []);

  useEffect(() => {
    if (formData.location_id) {
      loadDepartments(formData.location_id);
      loadAreas(formData.location_id);
    } else {
      setDepartments([]);
      setAreas([]);
    }
  }, [formData.location_id]);

  useEffect(() => {
    if (formData.department_id && formData.location_id) {
      loadShifts(formData.location_id, formData.department_id);
    } else {
      setShifts([]);
    }
  }, [formData.department_id, formData.location_id]);

  useEffect(() => {
    // Generate preview of upcoming task slots
    if (formData.recurrence_v2) {
      const slots = generatePreviewSlots(formData.recurrence_v2, 5);
      setUpcomingSlots(slots);
    }
  }, [formData.recurrence_v2]);

  const loadLocations = async () => {
    const { data } = await supabase
      .from('locations')
      .select('id, name')
      .is('archived_at', null)
      .order('name');
    if (data) setLocations(data);
  };

  const loadDepartments = async (locationId: string) => {
    const { data } = await supabase
      .from('departments')
      .select('id, name, location_id')
      .eq('location_id', locationId)
      .is('archived_at', null)
      .order('name');
    if (data) setDepartments(data);
  };

  const loadShifts = async (locationId: string, departmentId: string) => {
    const { data } = await supabase
      .from('shifts')
      .select('id, name, start_time, end_time, department_id')
      .eq('location_id', locationId)
      .or(`department_id.eq.${departmentId},department_id.is.null`)
      .is('archived_at', null)
      .order('name');
    if (data) setShifts(data);
  };

  const loadAreas = async (locationId: string) => {
    const { data } = await supabase
      .from('areas')
      .select('id, name, location_id')
      .eq('location_id', locationId)
      .is('archived_at', null)
      .order('name');
    if (data) setAreas(data);
  };

  const generatePreviewSlots = (recurrence: any, count: number): string[] => {
    const slots: string[] = [];
    const now = new Date();
    const timeOfDay = recurrence.time_of_day || '09:00';
    const [hours, minutes] = timeOfDay.split(':').map(Number);

    switch (recurrence.type) {
      case 'daily':
        for (let i = 0; i < count; i++) {
          const date = new Date(now);
          date.setDate(date.getDate() + i);
          date.setHours(hours, minutes, 0, 0);
          slots.push(date.toLocaleString());
        }
        break;
      case 'weekly':
        const daysOfWeek = recurrence.days_of_week || [];
        let daysChecked = 0;
        let dayOffset = 0;
        while (slots.length < count && daysChecked < 30) {
          const date = new Date(now);
          date.setDate(date.getDate() + dayOffset);
          if (daysOfWeek.includes(date.getDay())) {
            date.setHours(hours, minutes, 0, 0);
            slots.push(date.toLocaleString());
          }
          dayOffset++;
          daysChecked++;
        }
        break;
      case 'monthly':
        const dayOfMonth = recurrence.day_of_month || 1;
        for (let i = 0; i < count; i++) {
          const date = new Date(now);
          date.setMonth(date.getMonth() + i);
          date.setDate(dayOfMonth);
          date.setHours(hours, minutes, 0, 0);
          slots.push(date.toLocaleString());
        }
        break;
      case 'custom_weeks':
        const interval = recurrence.interval_weeks || 2;
        const customDays = recurrence.days_of_week || [];
        let weeksChecked = 0;
        let customDayOffset = 0;
        while (slots.length < count && weeksChecked < 20) {
          const date = new Date(now);
          date.setDate(date.getDate() + customDayOffset);
          const weekNum = Math.floor(customDayOffset / 7);
          if (weekNum % interval === 0 && customDays.includes(date.getDay())) {
            date.setHours(hours, minutes, 0, 0);
            slots.push(date.toLocaleString());
          }
          customDayOffset++;
          if (customDayOffset % 7 === 0) weeksChecked++;
        }
        break;
    }
    return slots;
  };

  const handleAddStep = () => {
    const trimmed = newStep.trim();
    if (!trimmed) return;
    
    if (trimmed.length > 500) {
      toast({
        title: 'Error',
        description: 'Step must be less than 500 characters',
        variant: 'destructive',
      });
      return;
    }
    
    if (formData.steps.length >= 20) {
      toast({
        title: 'Error',
        description: 'Maximum 20 steps allowed',
        variant: 'destructive',
      });
      return;
    }
    
    setFormData({ ...formData, steps: [...formData.steps, trimmed] });
    setNewStep('');
  };

  const handleRemoveStep = (index: number) => {
    setFormData({
      ...formData,
      steps: formData.steps.filter((_: any, i: number) => i !== index),
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate input
      const result = templateSchema.safeParse(formData);
      if (!result.success) {
        const firstError = result.error.errors[0];
        toast({
          title: 'Validation Error',
          description: firstError.message,
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profile } = await supabase
        .from('profiles')
        .select('org_id')
        .eq('id', user.id)
        .single();

      if (!profile?.org_id) throw new Error('No organization found');

      const payload = {
        title: formData.title.trim(),
        description: formData.description?.trim(),
        org_id: profile.org_id,
        location_id: formData.location_id,
        department_id: formData.department_id,
        shift_id: formData.shift_id,
        area_ids: formData.area_ids,
        steps: formData.steps,
        est_minutes: formData.est_minutes,
        criticality: formData.criticality,
        required_proof: formData.required_proof,
        recurrence_v2: formData.recurrence_v2,
        active: true,
      };

      if (template?.id) {
        const { error } = await supabase
          .from('task_routines')
          .update(payload)
          .eq('id', template.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('task_routines')
          .insert(payload);
        if (error) throw error;
      }

      toast({
        title: 'Success',
        description: `Routine ${template ? 'updated' : 'created'} successfully`,
      });
      onSuccess();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="title">Title *</Label>
        <Input
          id="title"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="location_id">Location *</Label>
          <Select
            value={formData.location_id}
            onValueChange={(value) => setFormData({ ...formData, location_id: value, department_id: '', shift_id: '', area_ids: [] })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select location" />
            </SelectTrigger>
            <SelectContent>
              {locations.map(loc => (
                <SelectItem key={loc.id} value={loc.id}>
                  {loc.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="department_id">Department *</Label>
          <Select
            value={formData.department_id}
            onValueChange={(value) => setFormData({ ...formData, department_id: value, shift_id: '' })}
            disabled={!formData.location_id}
          >
            <SelectTrigger>
              <SelectValue placeholder={formData.location_id ? "Select department" : "Select location first"} />
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
      </div>

      <div>
        <Label htmlFor="shift_id">Shift *</Label>
        <Select
          value={formData.shift_id}
          onValueChange={(value) => setFormData({ ...formData, shift_id: value })}
          disabled={!formData.department_id}
        >
          <SelectTrigger>
            <SelectValue placeholder={formData.department_id ? "Select shift" : "Select department first"} />
          </SelectTrigger>
          <SelectContent>
            {shifts.map(shift => (
              <SelectItem key={shift.id} value={shift.id}>
                {shift.name} ({shift.start_time} - {shift.end_time})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Areas * (Select at least one)</Label>
        <div className="border rounded-md p-4 space-y-2 max-h-40 overflow-y-auto">
          {areas.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {formData.location_id ? 'No areas available' : 'Select a location first'}
            </p>
          )}
          {areas.map((area) => (
            <div key={area.id} className="flex items-center space-x-2">
              <Checkbox
                id={`area-${area.id}`}
                checked={formData.area_ids.includes(area.id)}
                onCheckedChange={(checked) => {
                  if (checked) {
                    setFormData({ ...formData, area_ids: [...formData.area_ids, area.id] });
                  } else {
                    setFormData({ ...formData, area_ids: formData.area_ids.filter(id => id !== area.id) });
                  }
                }}
              />
              <Label htmlFor={`area-${area.id}`} className="cursor-pointer font-normal">
                {area.name}
              </Label>
            </div>
          ))}
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Selected: {formData.area_ids.length} area(s) - One task instance will be created per area
        </p>
      </div>

      <div>
        <Label>Recurrence *</Label>
        <div className="space-y-3 border rounded-md p-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="recurrence_type">Type</Label>
              <Select
                value={formData.recurrence_v2.type}
                onValueChange={(value) => setFormData({ 
                  ...formData, 
                  recurrence_v2: { ...formData.recurrence_v2, type: value } 
                })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="custom_weeks">Every N Weeks</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="time_of_day">Time of Day</Label>
              <Input
                id="time_of_day"
                type="time"
                value={formData.recurrence_v2.time_of_day || '09:00'}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  recurrence_v2: { ...formData.recurrence_v2, time_of_day: e.target.value } 
                })}
              />
            </div>
          </div>

          {formData.recurrence_v2.type === 'weekly' && (
            <div>
              <Label>Days of Week</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, idx) => (
                  <Button
                    key={idx}
                    type="button"
                    size="sm"
                    variant={formData.recurrence_v2.days_of_week?.includes(idx) ? 'default' : 'outline'}
                    onClick={() => {
                      const days = formData.recurrence_v2.days_of_week || [];
                      const newDays = days.includes(idx) 
                        ? days.filter(d => d !== idx)
                        : [...days, idx].sort();
                      setFormData({
                        ...formData,
                        recurrence_v2: { ...formData.recurrence_v2, days_of_week: newDays }
                      });
                    }}
                  >
                    {day}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {formData.recurrence_v2.type === 'custom_weeks' && (
            <>
              <div>
                <Label htmlFor="interval_weeks">Every N Weeks</Label>
                <Input
                  id="interval_weeks"
                  type="number"
                  min={1}
                  value={formData.recurrence_v2.interval_weeks || 2}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    recurrence_v2: { ...formData.recurrence_v2, interval_weeks: parseInt(e.target.value) } 
                  })}
                />
              </div>
              <div>
                <Label>Days of Week</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, idx) => (
                    <Button
                      key={idx}
                      type="button"
                      size="sm"
                      variant={formData.recurrence_v2.days_of_week?.includes(idx) ? 'default' : 'outline'}
                      onClick={() => {
                        const days = formData.recurrence_v2.days_of_week || [];
                        const newDays = days.includes(idx) 
                          ? days.filter(d => d !== idx)
                          : [...days, idx].sort();
                        setFormData({
                          ...formData,
                          recurrence_v2: { ...formData.recurrence_v2, days_of_week: newDays }
                        });
                      }}
                    >
                      {day}
                    </Button>
                  ))}
                </div>
              </div>
            </>
          )}

          {formData.recurrence_v2.type === 'monthly' && (
            <div>
              <Label htmlFor="day_of_month">Day of Month</Label>
              <Input
                id="day_of_month"
                type="number"
                min={1}
                max={31}
                value={formData.recurrence_v2.day_of_month || 1}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  recurrence_v2: { ...formData.recurrence_v2, day_of_month: parseInt(e.target.value) } 
                })}
              />
            </div>
          )}

          {upcomingSlots.length > 0 && (
            <div className="mt-3 p-3 bg-muted/50 rounded-md">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="h-4 w-4" />
                <Label className="text-sm font-medium">Next 5 Occurrences (per area):</Label>
              </div>
              <ul className="text-xs space-y-1 text-muted-foreground">
                {upcomingSlots.map((slot, idx) => (
                  <li key={idx}>• {slot}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          rows={3}
        />
      </div>

      <div>
        <Label>Steps</Label>
        <div className="space-y-2">
          {formData.steps.map((step: string, index: number) => (
            <div key={index} className="flex items-center gap-2">
              <Input value={step} disabled />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleRemoveStep(index)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <Input
              value={newStep}
              onChange={(e) => setNewStep(e.target.value)}
              placeholder="Add a step..."
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddStep();
                }
              }}
            />
            <Button type="button" variant="outline" size="sm" onClick={handleAddStep}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div>
        <Label htmlFor="est_minutes">Estimated Minutes</Label>
        <Input
          id="est_minutes"
          type="number"
          min={1}
          value={formData.est_minutes}
          onChange={(e) => setFormData({ ...formData, est_minutes: parseInt(e.target.value) })}
          required
        />
      </div>

      <div>
        <Label>Criticality: {formData.criticality}/5</Label>
        <Slider
          value={[formData.criticality]}
          onValueChange={(value) => setFormData({ ...formData, criticality: value[0] })}
          min={1}
          max={5}
          step={1}
          className="mt-2"
        />
      </div>

      <div>
        <Label htmlFor="required_proof">Required Proof</Label>
        <Select
          value={formData.required_proof}
          onValueChange={(value) => setFormData({ ...formData, required_proof: value })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            <SelectItem value="photo">Photo</SelectItem>
            <SelectItem value="note">Note</SelectItem>
            <SelectItem value="dual">Dual Sign-off</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? 'Saving...' : template ? 'Update' : 'Create'}
        </Button>
      </div>
    </form>
  );
};
