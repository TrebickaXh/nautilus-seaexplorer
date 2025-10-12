// Report data processing utilities

export interface TaskInstance {
  id: string;
  routine_id: string;
  location_id: string;
  department_id?: string;
  shift_id?: string;
  status: string;
  assigned_role?: string;
  due_at: string;
  completed_at?: string;
  task_routines?: { title: string; criticality: number };
  locations?: { name: string };
  departments?: { name: string };
  shifts?: { name: string };
  completions?: Array<{ created_at: string; user_id: string; profiles?: { display_name: string } }>;
}

export interface OnTimeMetric {
  name: string;
  rate: number;
  total: number;
  onTime: number;
}

export interface CompletionMetric {
  name: string;
  completed: number;
  overdue: number;
  total: number;
}

export interface TeamMemberMetric {
  name: string;
  completed: number;
  userId: string;
}

export interface CoverageMetric {
  hour: number;
  count: number;
}

export type GroupByType = 'template' | 'location' | 'role' | 'department' | 'shift';

/**
 * Calculate on-time completion rate grouped by specified dimension
 */
export function calculateOnTimeMetrics(
  tasks: TaskInstance[],
  groupBy: GroupByType
): OnTimeMetric[] {
  const groupedOnTime = new Map<string, { total: number; onTime: number; name: string }>();

  tasks.forEach(task => {
    const { key, name } = getGroupKeyAndName(task, groupBy);

    if (!groupedOnTime.has(key)) {
      groupedOnTime.set(key, { total: 0, onTime: 0, name });
    }

    const group = groupedOnTime.get(key)!;
    group.total++;

    if (
      task.status === 'done' &&
      task.completed_at &&
      new Date(task.completed_at) <= new Date(task.due_at)
    ) {
      group.onTime++;
    }
  });

  return Array.from(groupedOnTime.entries())
    .map(([_, data]) => ({
      name: data.name,
      rate: data.total > 0 ? Math.round((data.onTime / data.total) * 100) : 0,
      total: data.total,
      onTime: data.onTime,
    }))
    .sort((a, b) => b.rate - a.rate);
}

/**
 * Calculate completed and overdue tasks by group
 */
export function calculateCompletionMetrics(
  tasks: TaskInstance[],
  groupBy: GroupByType
): CompletionMetric[] {
  const metricsMap = new Map<string, { completed: number; overdue: number; total: number; name: string }>();

  tasks.forEach(task => {
    const { key, name } = getGroupKeyAndName(task, groupBy);

    if (!metricsMap.has(key)) {
      metricsMap.set(key, { completed: 0, overdue: 0, total: 0, name });
    }

    const metrics = metricsMap.get(key)!;
    metrics.total++;

    if (task.status === 'done') {
      metrics.completed++;
    }

    // Check if task is overdue (past due_at and not completed)
    if (task.status === 'pending' && new Date(task.due_at) < new Date()) {
      metrics.overdue++;
    }
  });

  return Array.from(metricsMap.entries())
    .map(([_, data]) => ({
      name: data.name,
      completed: data.completed,
      overdue: data.overdue,
      total: data.total,
    }))
    .sort((a, b) => b.completed - a.completed);
}

/**
 * Calculate tasks completed by team member
 */
export function calculateTeamMemberMetrics(
  tasks: TaskInstance[]
): TeamMemberMetric[] {
  const memberMap = new Map<string, { completed: number; name: string }>();

  tasks.forEach(task => {
    if (task.status === 'done' && task.completions && task.completions.length > 0) {
      const completion = task.completions[0];
      const userId = completion.user_id;
      const userName = completion.profiles?.display_name || 'Unknown User';
      
      if (!memberMap.has(userId)) {
        memberMap.set(userId, { completed: 0, name: userName });
      }
      
      memberMap.get(userId)!.completed++;
    }
  });

  return Array.from(memberMap.entries())
    .map(([userId, data]) => ({
      userId,
      name: data.name,
      completed: data.completed,
    }))
    .sort((a, b) => b.completed - a.completed);
}

/**
 * Calculate coverage by hour of day
 */
export function calculateCoverageMetrics(tasks: TaskInstance[]): CoverageMetric[] {
  const hourCoverage = Array.from({ length: 24 }, (_, i) => ({
    hour: i,
    count: 0,
  }));

  tasks.forEach(task => {
    if (task.completed_at) {
      const hour = new Date(task.completed_at).getHours();
      hourCoverage[hour].count++;
    }
  });

  return hourCoverage;
}

/**
 * Get grouping key and display name for a task based on groupBy dimension
 */
function getGroupKeyAndName(
  task: TaskInstance,
  groupBy: GroupByType
): { key: string; name: string } {
  switch (groupBy) {
    case 'template':
      return {
        key: task.routine_id,
        name: task.task_routines?.title || 'Unknown',
      };
    case 'location':
      return {
        key: task.location_id,
        name: task.locations?.name || 'Unknown',
      };
    case 'department':
      return {
        key: task.department_id || 'none',
        name: task.departments?.name || 'No Department',
      };
    case 'shift':
      return {
        key: task.shift_id || 'none',
        name: task.shifts?.name || 'No Shift',
      };
    case 'role':
      return {
        key: task.assigned_role || 'unassigned',
        name: task.assigned_role || 'Unassigned',
      };
    default:
      return { key: 'unknown', name: 'Unknown' };
  }
}

/**
 * Export metrics to CSV format
 */
export function exportMetricsToCSV(
  metrics: OnTimeMetric[],
  filename: string
): void {
  const csvData = metrics.map(item => ({
    Name: item.name,
    'On-Time Rate': `${item.rate}%`,
    'Total Tasks': item.total,
    'On-Time Tasks': item.onTime,
  }));

  const headers = Object.keys(csvData[0]);
  const csvContent = [
    headers.join(','),
    ...csvData.map(row => headers.map(h => row[h as keyof typeof row]).join(',')),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  window.URL.revokeObjectURL(url);
}
