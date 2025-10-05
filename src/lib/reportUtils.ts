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
  completions?: Array<{ created_at: string; user_id: string }>;
}

export interface OnTimeMetric {
  name: string;
  rate: number;
  total: number;
  onTime: number;
}

export interface MtcMetric {
  name: string;
  avgMinutes: number;
  count: number;
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
 * Calculate mean time to complete grouped by specified dimension
 */
export function calculateMtcMetrics(
  tasks: TaskInstance[],
  groupBy: GroupByType
): MtcMetric[] {
  const mtcMap = new Map<string, { times: number[]; name: string }>();

  tasks.forEach(task => {
    if (task.status === 'done' && task.completed_at && task.completions?.[0]?.created_at) {
      const { key, name } = getGroupKeyAndName(task, groupBy);

      if (!mtcMap.has(key)) {
        mtcMap.set(key, { times: [], name });
      }

      const dueTime = new Date(task.due_at).getTime();
      const completeTime = new Date(task.completions[0].created_at).getTime();
      const minutes = (completeTime - dueTime) / (1000 * 60);

      mtcMap.get(key)!.times.push(minutes);
    }
  });

  return Array.from(mtcMap.entries())
    .map(([_, data]) => ({
      name: data.name,
      avgMinutes:
        data.times.length > 0
          ? Math.round(data.times.reduce((a, b) => a + b, 0) / data.times.length)
          : 0,
      count: data.times.length,
    }))
    .filter(item => item.count > 0)
    .sort((a, b) => a.avgMinutes - b.avgMinutes);
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
