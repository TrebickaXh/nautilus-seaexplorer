import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Clock } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

interface Department {
  id: string;
  name: string;
}

interface Shift {
  id: string;
  department_id: string;
  name: string;
  start_time: string;
  end_time: string;
  days_of_week: number[];
}

interface UserShiftAssignmentProps {
  userId: string;
  userName: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export function UserShiftAssignment({ 
  userId, 
  userName, 
  onSuccess, 
  onCancel 
}: UserShiftAssignmentProps) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [shifts, setShifts] = useState<Record<string, Shift[]>>({});
  const [selectedShifts, setSelectedShifts] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, [userId]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Get user's departments
      const { data: userDepts } = await supabase
        .from('user_departments')
        .select('department_id, departments(id, name)')
        .eq('user_id', userId);

      if (!userDepts || userDepts.length === 0) {
        toast.error('User must be assigned to at least one department first');
        onCancel();
        return;
      }

      const depts = userDepts
        .map(ud => ud.departments)
        .filter(Boolean) as any[];
      
      setDepartments(depts);

      // Load shifts for each department
      const shiftsMap: Record<string, Shift[]> = {};
      for (const dept of depts) {
        const { data: shiftData } = await supabase
          .from('shifts')
          .select('*')
          .eq('department_id', dept.id)
          .is('archived_at', null)
          .order('start_time');

        if (shiftData) {
          shiftsMap[dept.id] = shiftData;
        }
      }
      setShifts(shiftsMap);

      // Load user's current shift assignments
      const { data: userShifts } = await supabase
        .from('user_shifts')
        .select('shift_id')
        .eq('user_id', userId);

      if (userShifts) {
        setSelectedShifts(userShifts.map(us => us.shift_id));
      }
    } catch (error: any) {
      console.error('Error loading data:', error);
      toast.error('Failed to load shifts');
    } finally {
      setLoading(false);
    }
  };

  const handleShiftToggle = (shiftId: string) => {
    setSelectedShifts(prev => {
      if (prev.includes(shiftId)) {
        return prev.filter(id => id !== shiftId);
      } else {
        return [...prev, shiftId];
      }
    });
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const h = parseInt(hours);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${displayH}:${minutes} ${ampm}`;
  };

  const getDaysDisplay = (days: number[]) => {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days.map(d => dayNames[d]).join(', ');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Delete existing shift assignments
      await supabase
        .from('user_shifts')
        .delete()
        .eq('user_id', userId);

      // Insert new assignments (if any selected)
      if (selectedShifts.length > 0) {
        const assignments = selectedShifts.map(shiftId => ({
          user_id: userId,
          shift_id: shiftId,
        }));

        const { error } = await supabase
          .from('user_shifts')
          .insert(assignments);

        if (error) throw error;
      }

      toast.success('Shift assignments updated');
      onSuccess();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span>Assigning shifts for: <strong>{userName}</strong></span>
        </div>

        {departments.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No departments assigned. Please assign departments first.
          </p>
        ) : (
          <Accordion type="multiple" defaultValue={departments.map(d => d.id)} className="space-y-2">
            {departments.map(dept => (
              <AccordionItem key={dept.id} value={dept.id} className="border rounded-lg px-4">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{dept.name}</span>
                    <Badge variant="secondary">
                      {shifts[dept.id]?.filter(s => selectedShifts.includes(s.id)).length || 0} / {shifts[dept.id]?.length || 0}
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-3 pt-4">
                  {shifts[dept.id]?.length > 0 ? (
                    shifts[dept.id].map(shift => (
                      <div key={shift.id} className="flex items-start space-x-3 p-3 rounded-lg border bg-background">
                        <Checkbox
                          id={`shift-${shift.id}`}
                          checked={selectedShifts.includes(shift.id)}
                          onCheckedChange={() => handleShiftToggle(shift.id)}
                        />
                        <div className="flex-1">
                          <label
                            htmlFor={`shift-${shift.id}`}
                            className="text-sm font-medium leading-none cursor-pointer"
                          >
                            {shift.name}
                          </label>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatTime(shift.start_time)} - {formatTime(shift.end_time)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {getDaysDisplay(shift.days_of_week)}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground py-2">
                      No shifts available in this department.
                    </p>
                  )}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? 'Saving...' : 'Save Assignments'}
        </Button>
      </div>
    </form>
  );
}
