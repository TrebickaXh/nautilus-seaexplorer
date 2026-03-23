import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect, useRef, useCallback } from 'react';
import { getStartOfDayInTimezone, getEndOfDayInTimezone, getCurrentTimeInTimezone } from '@/hooks/useOrgTimezone';

const DASHBOARD_STALE_TIME = 60 * 1000; // 1 minute
const DEBOUNCE_MS = 1500;

// ── Profile + Auth ──────────────────────────────────────────────

export function useCurrentProfile() {
  return useQuery({
    queryKey: ['current-profile'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      return { user, profile };
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: false,
  });
}

// ── Dashboard Queries ───────────────────────────────────────────

export function useDashboardStats(orgId: string | undefined) {
  return useQuery({
    queryKey: ['dashboard', orgId, 'stats'],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const [recentResult, todayResult] = await Promise.all([
        supabase
          .from('task_instances')
          .select('status, completed_at, due_at')
          .eq('org_id', orgId!)
          .gte('due_at', sevenDaysAgo.toISOString())
          .in('status', ['done', 'skipped', 'pending'])
          .limit(1000),
        supabase
          .from('task_instances')
          .select('status, completed_at, due_at')
          .eq('org_id', orgId!)
          .gte('due_at', today.toISOString())
          .lt('due_at', tomorrow.toISOString())
          .limit(500),
      ]);

      const recent = recentResult.data || [];
      const todayTasks = todayResult.data || [];

      const allCompleted = recent.filter(t => t.status === 'done');
      const onTime = allCompleted.filter(t =>
        t.completed_at && new Date(t.completed_at) <= new Date(t.due_at)
      );
      const onTimeRate = allCompleted.length > 0
        ? Math.round((onTime.length / allCompleted.length) * 100)
        : 0;

      const todayCompleted = todayTasks.filter(t => t.status === 'done');
      const todayPending = todayTasks.filter(t => t.status === 'pending');
      const overdue = todayPending.filter(t => new Date(t.due_at) < new Date());

      return {
        onTimeRate,
        overdueTasks: overdue.length,
        completedToday: todayCompleted.length,
        pendingTasks: todayPending.length,
      };
    },
    enabled: !!orgId,
    staleTime: DASHBOARD_STALE_TIME,
    refetchOnWindowFocus: true,
  });
}

export function useRecentCompletions(orgId: string | undefined) {
  return useQuery({
    queryKey: ['dashboard', orgId, 'recent-completions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('completions')
        .select(`
          *,
          task_instances(*, task_routines!routine_id(title), locations(name)),
          profiles!user_id(display_name)
        `)
        .eq('org_id', orgId!)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      return data || [];
    },
    enabled: !!orgId,
    staleTime: DASHBOARD_STALE_TIME,
    refetchOnWindowFocus: true,
  });
}

export function useChronicOverdue(orgId: string | undefined) {
  return useQuery({
    queryKey: ['dashboard', orgId, 'chronic-overdue'],
    queryFn: async () => {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setHours(0, 0, 0, 0);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data, error } = await supabase
        .from('task_instances')
        .select('routine_id, task_routines!routine_id(title, criticality), status, completed_at, due_at')
        .eq('org_id', orgId!)
        .in('status', ['done', 'skipped'])
        .gte('due_at', sevenDaysAgo.toISOString())
        .limit(500);

      if (error) throw error;

      const templateMap = new Map<string, { title: string; criticality: number; late: number; total: number }>();
      (data || []).forEach(task => {
        const routineId = task.routine_id;
        if (!routineId) return;
        const title = (task.task_routines as any)?.title || 'Unknown';
        const criticality = (task.task_routines as any)?.criticality || 3;

        if (!templateMap.has(routineId)) {
          templateMap.set(routineId, { title, criticality, late: 0, total: 0 });
        }
        const entry = templateMap.get(routineId)!;
        entry.total++;
        if (task.status === 'done' && task.completed_at && new Date(task.completed_at) > new Date(task.due_at)) {
          entry.late++;
        } else if (task.status === 'skipped') {
          entry.late++;
        }
      });

      return Array.from(templateMap.entries())
        .map(([id, d]) => ({
          id,
          title: d.title,
          criticality: d.criticality,
          lateCount: d.late,
          totalCount: d.total,
          score: d.late * d.criticality,
        }))
        .filter(item => item.lateCount > 2)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);
    },
    enabled: !!orgId,
    staleTime: DASHBOARD_STALE_TIME,
    refetchOnWindowFocus: true,
  });
}

export function useExceptions(orgId: string | undefined) {
  return useQuery({
    queryKey: ['dashboard', orgId, 'exceptions'],
    queryFn: async () => {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setHours(0, 0, 0, 0);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data, error } = await supabase
        .from('task_instances')
        .select('*, task_routines!routine_id(title), locations(name), completions(note, created_at)')
        .eq('org_id', orgId!)
        .eq('status', 'skipped')
        .gte('due_at', sevenDaysAgo.toISOString())
        .order('completed_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      return data || [];
    },
    enabled: !!orgId,
    staleTime: DASHBOARD_STALE_TIME,
    refetchOnWindowFocus: true,
  });
}

// ── Debounced Realtime Invalidation ─────────────────────────────

export function useDashboardRealtime(orgId: string | undefined) {
  const queryClient = useQueryClient();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const debouncedInvalidate = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ['dashboard', orgId] });
    }, DEBOUNCE_MS);
  }, [queryClient, orgId]);

  useEffect(() => {
    if (!orgId) return;

    const taskChannel = supabase
      .channel('dashboard-tasks')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'task_instances',
        filter: `org_id=eq.${orgId}`,
      }, debouncedInvalidate)
      .subscribe();

    const completionChannel = supabase
      .channel('dashboard-completions')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'completions',
        filter: `org_id=eq.${orgId}`,
      }, debouncedInvalidate)
      .subscribe();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      supabase.removeChannel(taskChannel);
      supabase.removeChannel(completionChannel);
    };
  }, [orgId, debouncedInvalidate]);
}
