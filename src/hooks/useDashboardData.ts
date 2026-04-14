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

export function useUrgentTasks(orgId: string | undefined, timezone: string = 'UTC') {
  return useQuery({
    queryKey: ['dashboard', orgId, 'urgent-tasks', timezone],
    queryFn: async () => {
      const now = new Date();
      const todayStart = getStartOfDayInTimezone(now, timezone);
      const todayEnd = getEndOfDayInTimezone(now, timezone);

      const { data, error } = await supabase
        .from('task_instances')
        .select(`
          id, due_at, urgency_score, window_end, status,
          department_id, area_id, shift_id,
          denormalized_data,
          task_routines!routine_id(title, required_proof),
          departments(name),
          areas(name),
          locations(name)
        `)
        .eq('org_id', orgId!)
        .eq('status', 'pending')
        .gte('due_at', todayStart.toISOString())
        .lte('due_at', todayEnd.toISOString())
        .order('urgency_score', { ascending: false })
        .limit(5);

      if (error) throw error;
      return data || [];
    },
    enabled: !!orgId,
    staleTime: 30_000, // 30s — urgent tasks need fresher data
    refetchOnWindowFocus: true,
  });
}


// ── Location filter for org_admin ───────────────────────────────

export function useDashboardStatsFiltered(orgId: string | undefined, timezone: string = 'UTC', locationId?: string) {
  return useQuery({
    queryKey: ['dashboard', orgId, 'stats-filtered', timezone, locationId || 'all'],
    queryFn: async () => {
      const now = new Date();
      const todayStart = getStartOfDayInTimezone(now, timezone);
      const todayEnd = getEndOfDayInTimezone(now, timezone);
      const sevenDaysAgo = getStartOfDayInTimezone(new Date(now.getTime() - 7 * 86400000), timezone);

      let recentQ = supabase.from('task_instances').select('status, completed_at, due_at')
        .eq('org_id', orgId!).gte('due_at', sevenDaysAgo.toISOString()).lte('due_at', todayEnd.toISOString())
        .in('status', ['done', 'skipped', 'pending']).limit(1000);
      let todayQ = supabase.from('task_instances').select('status, completed_at, due_at')
        .eq('org_id', orgId!).gte('due_at', todayStart.toISOString()).lte('due_at', todayEnd.toISOString()).limit(500);

      if (locationId) { recentQ = recentQ.eq('location_id', locationId); todayQ = todayQ.eq('location_id', locationId); }

      const [recentResult, todayResult] = await Promise.all([recentQ, todayQ]);
      const recent = recentResult.data || [];
      const todayTasks = todayResult.data || [];
      const todayTotal = todayTasks.length;
      const todayCompleted = todayTasks.filter(t => t.status === 'done');
      const todayPending = todayTasks.filter(t => t.status === 'pending');
      const overdue = todayPending.filter(t => new Date(t.due_at) < now);
      const completionRate = todayTotal > 0 ? Math.round((todayCompleted.length / todayTotal) * 100) : 0;
      const allCompleted = recent.filter(t => t.status === 'done');
      const onTime = allCompleted.filter(t => t.completed_at && new Date(t.completed_at) <= new Date(t.due_at));
      const onTimeRate = allCompleted.length > 0 ? Math.round((onTime.length / allCompleted.length) * 100) : 0;

      const sparkline: { day: string; rate: number }[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 86400000);
        const ds = getStartOfDayInTimezone(d, timezone);
        const de = getEndOfDayInTimezone(d, timezone);
        const dayTasks = recent.filter(t => { const due = new Date(t.due_at); return due >= ds && due <= de; });
        const dayDone = dayTasks.filter(t => t.status === 'done').length;
        sparkline.push({ day: d.toLocaleDateString('en-US', { timeZone: timezone, weekday: 'short' }), rate: dayTasks.length > 0 ? Math.round((dayDone / dayTasks.length) * 100) : 0 });
      }

      return { completionRate, onTimeRate, overdueTasks: overdue.length, completedToday: todayCompleted.length, pendingTasks: todayPending.length, totalToday: todayTotal, sparkline };
    },
    enabled: !!orgId,
    staleTime: DASHBOARD_STALE_TIME,
    refetchOnWindowFocus: true,
  });
}

// ── Crew-specific hooks ─────────────────────────────────────────

export function useCrewTodayTasks(orgId: string | undefined, userId: string | undefined, timezone: string = 'UTC') {
  return useQuery({
    queryKey: ['dashboard', orgId, 'crew-tasks', userId, timezone],
    queryFn: async () => {
      const now = new Date();
      const todayStart = getStartOfDayInTimezone(now, timezone);
      const todayEnd = getEndOfDayInTimezone(now, timezone);

      const [shiftsResult, deptsResult] = await Promise.all([
        supabase.from('user_shifts').select('shift_id').eq('user_id', userId!),
        supabase.from('user_departments').select('department_id').eq('user_id', userId!),
      ]);
      const shiftIds = (shiftsResult.data || []).map(s => s.shift_id);
      const deptIds = (deptsResult.data || []).map(d => d.department_id);

      if (shiftIds.length === 0 && deptIds.length === 0) return [];

      let query = supabase.from('task_instances')
        .select(`id, due_at, status, urgency_score, window_end, completed_at, denormalized_data, task_routines!routine_id(title, required_proof), departments(name), areas(name)`)
        .eq('org_id', orgId!)
        .gte('due_at', todayStart.toISOString())
        .lte('due_at', todayEnd.toISOString())
        .order('due_at', { ascending: true })
        .limit(50);

      if (shiftIds.length > 0) { query = query.in('shift_id', shiftIds); }
      else { query = query.in('department_id', deptIds); }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!orgId && !!userId,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}

export function useCrewStreak(orgId: string | undefined, userId: string | undefined, timezone: string = 'UTC') {
  return useQuery({
    queryKey: ['dashboard', orgId, 'crew-streak', userId],
    queryFn: async () => {
      let streak = 0;
      const now = new Date();
      const { data: userShifts } = await supabase.from('user_shifts').select('shift_id').eq('user_id', userId!);
      const shiftIds = (userShifts || []).map(s => s.shift_id);
      if (shiftIds.length === 0) return 0;

      for (let i = 1; i <= 30; i++) {
        const d = new Date(now.getTime() - i * 86400000);
        const dayStart = getStartOfDayInTimezone(d, timezone);
        const dayEnd = getEndOfDayInTimezone(d, timezone);
        const { data: tasks } = await supabase.from('task_instances').select('status')
          .eq('org_id', orgId!).in('shift_id', shiftIds)
          .gte('due_at', dayStart.toISOString()).lte('due_at', dayEnd.toISOString()).limit(100);
        if (!tasks || tasks.length === 0) continue;
        if (tasks.every(t => t.status === 'done')) { streak++; } else { break; }
      }
      return streak;
    },
    enabled: !!orgId && !!userId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useYesterdayHandoff(orgId: string | undefined, timezone: string = 'UTC', locationId?: string) {
  return useQuery({
    queryKey: ['dashboard', orgId, 'yesterday-handoff', locationId],
    queryFn: async () => {
      const yesterday = new Date(Date.now() - 86400000);
      const dayStart = getStartOfDayInTimezone(yesterday, timezone);
      const dayEnd = getEndOfDayInTimezone(yesterday, timezone);

      let query = supabase.from('task_instances')
        .select(`id, status, completed_at, due_at, shift_id, task_routines!routine_id(title), shifts(name), completions(user_id, note, profiles!user_id(display_name))`)
        .eq('org_id', orgId!)
        .gte('due_at', dayStart.toISOString()).lte('due_at', dayEnd.toISOString()).limit(200);

      if (locationId) { query = query.eq('location_id', locationId); }

      const { data, error } = await query;
      if (error) throw error;
      const tasks = data || [];
      const total = tasks.length;
      const done = tasks.filter(t => t.status === 'done').length;
      const skipped = tasks.filter(t => t.status === 'skipped');
      const completionRate = total > 0 ? Math.round((done / total) * 100) : 0;

      const userSet = new Set<string>();
      const userNames: string[] = [];
      tasks.forEach((t: any) => {
        t.completions?.forEach((c: any) => {
          if (c.profiles?.display_name && !userSet.has(c.user_id)) {
            userSet.add(c.user_id);
            userNames.push(c.profiles.display_name);
          }
        });
      });

      const lastShift = tasks.find(t => t.shifts)?.shifts as any;
      return {
        total, done,
        skippedTasks: skipped.map((t: any) => ({ title: t.task_routines?.title || 'Untitled', note: t.completions?.[0]?.note || null })),
        completionRate,
        crewNames: userNames.slice(0, 5),
        shiftName: lastShift?.name || null,
      };
    },
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000,
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
