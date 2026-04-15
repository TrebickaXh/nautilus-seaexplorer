import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getCurrentTimeInTimezone, getDayOfWeekInTimezone } from '@/hooks/useOrgTimezone';

interface Shift {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  days_of_week: number[];
  department_id: string | null;
}

interface KioskDebugPanelProps {
  orgTimezone: string;
  allShifts: Shift[];
  activeShiftIds: string[];
}

export function KioskDebugPanel({ orgTimezone, allShifts, activeShiftIds }: KioskDebugPanelProps) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const currentTime = getCurrentTimeInTimezone(orgTimezone);
  const currentDay = getDayOfWeekInTimezone(now, orgTimezone);
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const getInactiveReason = (shift: Shift): string => {
    if (!shift.days_of_week.includes(currentDay)) {
      return `wrong day (today=${dayNames[currentDay]}, shift runs on ${shift.days_of_week.map(d => dayNames[d]).join(', ')})`;
    }
    const start = shift.start_time.slice(0, 5);
    const end = shift.end_time.slice(0, 5);
    if (end <= start) {
      if (!(currentTime >= start || currentTime < end)) {
        return `outside time window (now=${currentTime}, window=${start}–${end} overnight)`;
      }
    } else {
      if (!(currentTime >= start && currentTime < end)) {
        return `outside time window (now=${currentTime}, window=${start}–${end})`;
      }
    }
    return 'unknown';
  };

  return (
    <Card className="p-4 border-yellow-500 border-2 bg-yellow-50 dark:bg-yellow-950/20 mb-6">
      <h3 className="font-bold text-sm mb-3 text-yellow-800 dark:text-yellow-200">🐛 Debug Panel</h3>
      <div className="space-y-2 text-sm font-mono">
        <div><strong>Org Timezone:</strong> {orgTimezone}</div>
        <div><strong>Current Time (org TZ):</strong> {currentTime}</div>
        <div><strong>Day of Week:</strong> {currentDay} ({dayNames[currentDay]})</div>
        <hr className="my-2 border-yellow-300" />
        <div><strong>All Shifts ({allShifts.length}):</strong></div>
        <div className="space-y-1 ml-2">
          {allShifts.map(shift => {
            const isActive = activeShiftIds.includes(shift.id);
            return (
              <div key={shift.id} className="flex flex-wrap items-center gap-2">
                <Badge variant={isActive ? 'default' : 'secondary'} className="text-xs">
                  {isActive ? '✅ Active' : '❌ Inactive'}
                </Badge>
                <span>{shift.name}</span>
                <span className="text-muted-foreground">
                  {shift.start_time.slice(0, 5)}–{shift.end_time.slice(0, 5)}
                </span>
                <span className="text-muted-foreground">
                  days=[{shift.days_of_week.join(',')}]
                </span>
                {!isActive && (
                  <span className="text-red-600 dark:text-red-400 text-xs">
                    ({getInactiveReason(shift)})
                  </span>
                )}
              </div>
            );
          })}
        </div>
        <hr className="my-2 border-yellow-300" />
        <div><strong>Active shift query:</strong></div>
        <pre className="text-xs bg-yellow-100 dark:bg-yellow-900/30 p-2 rounded overflow-x-auto">
{`SELECT * FROM shifts
WHERE days_of_week @> ARRAY[${currentDay}]
  AND archived_at IS NULL
-- Then client-side filter:
-- currentTime (${currentTime}) >= start_time
-- AND currentTime < end_time
-- (with overnight wrap logic)`}
        </pre>
      </div>
    </Card>
  );
}
