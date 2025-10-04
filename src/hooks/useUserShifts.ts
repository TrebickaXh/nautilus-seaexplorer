import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Shift {
  id: string;
  name: string;
  department_id: string;
  start_time: string;
  end_time: string;
  days_of_week: number[];
}

interface Department {
  id: string;
  name: string;
}

export const useUserShifts = (userId?: string) => {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userId) {
      fetchUserShifts();
    }
  }, [userId]);

  const fetchUserShifts = async () => {
    try {
      setLoading(true);

      // Get user's shift assignments with shift details
      const { data: userShifts, error: shiftsError } = await supabase
        .from('user_shifts')
        .select(`
          shift_id,
          shifts (
            id,
            name,
            department_id,
            start_time,
            end_time,
            days_of_week
          )
        `)
        .eq('user_id', userId);

      if (shiftsError) throw shiftsError;

      const shiftsData = userShifts
        ?.map(us => us.shifts)
        .filter(Boolean) as any[];

      setShifts(shiftsData || []);

      // Get user's departments
      const { data: userDepts, error: deptsError } = await supabase
        .from('user_departments')
        .select(`
          department_id,
          departments (
            id,
            name
          )
        `)
        .eq('user_id', userId);

      if (deptsError) throw deptsError;

      const deptsData = userDepts
        ?.map(ud => ud.departments)
        .filter(Boolean) as any[];

      setDepartments(deptsData || []);
    } catch (error) {
      console.error('Error fetching user shifts:', error);
    } finally {
      setLoading(false);
    }
  };

  const isShiftActive = (shift: Shift): boolean => {
    const now = new Date();
    const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const currentTime = now.toTimeString().slice(0, 5); // "HH:MM"

    // Check if today is a working day for this shift
    if (!shift.days_of_week.includes(currentDay)) {
      return false;
    }

    // Check if current time is within shift hours
    return currentTime >= shift.start_time && currentTime <= shift.end_time;
  };

  const getCurrentShift = (): Shift | null => {
    return shifts.find(shift => isShiftActive(shift)) || null;
  };

  const getShiftIds = (): string[] => {
    return shifts.map(s => s.id);
  };

  const getDepartmentIds = (): string[] => {
    return departments.map(d => d.id);
  };

  return {
    shifts,
    departments,
    loading,
    isShiftActive,
    getCurrentShift,
    getShiftIds,
    getDepartmentIds,
    refetch: fetchUserShifts,
  };
};
