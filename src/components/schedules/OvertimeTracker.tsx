import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, TrendingUp } from "lucide-react";
import { startOfWeek, endOfWeek } from "date-fns";

interface OvertimeTrackerProps {
  weekStart: Date;
}

export function OvertimeTracker({ weekStart }: OvertimeTrackerProps) {
  const weekEnd = endOfWeek(weekStart);

  const { data: overtimeData = [], isLoading } = useQuery({
    queryKey: ["overtime-tracker", weekStart.toISOString()],
    queryFn: async () => {
      const { data: shifts, error } = await supabase
        .from("shifts")
        .select(`
          *,
          assignments:schedule_assignments!inner(
            employee:profiles(id, display_name)
          )
        `)
        .gte("start_at", weekStart.toISOString())
        .lte("start_at", weekEnd.toISOString());

      if (error) throw error;

      // Calculate hours per employee
      const employeeHours = new Map<string, { name: string; hours: number }>();

      shifts?.forEach((shift: any) => {
        const assignment = shift.assignments?.[0];
        if (assignment?.employee) {
          const hours =
            (new Date(shift.end_at).getTime() - new Date(shift.start_at).getTime()) /
            (1000 * 60 * 60);

          const existing = employeeHours.get(assignment.employee.id) || {
            name: assignment.employee.display_name,
            hours: 0,
          };
          employeeHours.set(assignment.employee.id, {
            ...existing,
            hours: existing.hours + hours,
          });
        }
      });

      return Array.from(employeeHours.values())
        .map((emp) => ({
          ...emp,
          isOvertime: emp.hours > 40,
          percentage: (emp.hours / 40) * 100,
        }))
        .sort((a, b) => b.hours - a.hours);
    },
  });

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading overtime data...</div>;
  }

  const overtimeEmployees = overtimeData.filter((emp) => emp.isOvertime);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          Overtime Tracking
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {overtimeEmployees.length > 0 && (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 rounded-lg border border-destructive/20">
            <AlertTriangle className="w-4 h-4 text-destructive" />
            <span className="text-sm font-medium">
              {overtimeEmployees.length} {overtimeEmployees.length === 1 ? "employee" : "employees"} scheduled for overtime
            </span>
          </div>
        )}

        <div className="space-y-3">
          {overtimeData.map((emp, idx) => (
            <div key={idx} className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{emp.name}</span>
                  {emp.isOvertime && (
                    <Badge variant="destructive" className="text-xs">
                      Overtime
                    </Badge>
                  )}
                </div>
                <span className={emp.isOvertime ? "text-destructive font-semibold" : ""}>
                  {emp.hours.toFixed(1)}h / 40h
                </span>
              </div>
              <Progress
                value={Math.min(emp.percentage, 100)}
                className="h-2"
              />
            </div>
          ))}
        </div>

        {overtimeData.length === 0 && (
          <div className="text-center py-6 text-muted-foreground text-sm">
            No scheduled shifts for this week
          </div>
        )}
      </CardContent>
    </Card>
  );
}
