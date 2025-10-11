import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { subDays } from 'date-fns';
import type { TaskInstance } from '@/lib/reportUtils';

export interface ReportFilters {
  dateRange: string;
  shiftId: string;
  departmentId: string;
}

/**
 * Fetch task instances with caching using React Query
 */
export function useReportData(filters: ReportFilters) {
  return useQuery({
    queryKey: ['report-data', filters],
    queryFn: async () => {
      const startDate = subDays(new Date(), parseInt(filters.dateRange));

      let query = supabase
        .from('task_instances')
        .select(`
          *,
          task_routines!routine_id(title, criticality),
          locations(name),
          departments(name),
          shifts(name),
          completions(created_at, user_id)
        `)
        .gte('due_at', startDate.toISOString())
        .in('status', ['done', 'skipped']);

      // Apply shift filter
      if (filters.shiftId !== 'all') {
        query = query.eq('shift_id', filters.shiftId);
      }

      // Apply department filter
      if (filters.departmentId !== 'all') {
        query = query.eq('department_id', filters.departmentId);
      }

      const { data, error } = await query;

      if (error) throw error;

      return (data || []) as TaskInstance[];
    },
    staleTime: 2 * 60 * 1000, // Consider data fresh for 2 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    refetchOnWindowFocus: false, // Don't refetch when user returns to window
  });
}

/**
 * Fetch shifts with caching
 */
export function useShifts() {
  return useQuery({
    queryKey: ['shifts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shifts')
        .select('id, name, location_id, department_id, locations(name)')
        .order('name');
      
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });
}

/**
 * Fetch departments with caching
 */
export function useDepartments() {
  return useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('departments')
        .select('id, name, location_id, locations(name)')
        .order('name');
      
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });
}
