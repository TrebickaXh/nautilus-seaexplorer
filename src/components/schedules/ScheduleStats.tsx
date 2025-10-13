import { Card } from "@/components/ui/card";
import { Users, Calendar, Clock, AlertTriangle } from "lucide-react";

interface ScheduleStatsProps {
  shifts: any[];
  employees: any[];
}

export function ScheduleStats({ shifts, employees }: ScheduleStatsProps) {
  const totalShifts = shifts.length;
  const assignedShifts = shifts.filter((s) => s.employee_id).length;
  const openShifts = shifts.filter((s) => s.is_open).length;
  const shiftsWithConflicts = shifts.filter((s) => s.has_claims || s.has_swaps).length;
  
  const totalHours = shifts.reduce((acc, shift) => {
    const start = new Date(shift.start_at);
    const end = new Date(shift.end_at);
    const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    return acc + hours;
  }, 0);

  const coverageRate = totalShifts > 0 ? ((assignedShifts / totalShifts) * 100).toFixed(1) : "0";

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 border-b bg-muted/30">
      <Card className="p-3">
        <div className="flex items-center gap-2 mb-1">
          <Calendar className="w-4 h-4 text-primary" />
          <span className="text-xs text-muted-foreground">Total Shifts</span>
        </div>
        <div className="text-2xl font-bold">{totalShifts}</div>
        <div className="text-xs text-muted-foreground">{coverageRate}% covered</div>
      </Card>

      <Card className="p-3">
        <div className="flex items-center gap-2 mb-1">
          <Users className="w-4 h-4 text-primary" />
          <span className="text-xs text-muted-foreground">Employees</span>
        </div>
        <div className="text-2xl font-bold">{employees.length}</div>
        <div className="text-xs text-muted-foreground">Active workers</div>
      </Card>

      <Card className="p-3">
        <div className="flex items-center gap-2 mb-1">
          <Clock className="w-4 h-4 text-primary" />
          <span className="text-xs text-muted-foreground">Total Hours</span>
        </div>
        <div className="text-2xl font-bold">{totalHours.toFixed(0)}</div>
        <div className="text-xs text-muted-foreground">Scheduled hrs</div>
      </Card>

      <Card className="p-3">
        <div className="flex items-center gap-2 mb-1">
          <AlertTriangle className="w-4 h-4 text-warning" />
          <span className="text-xs text-muted-foreground">Needs Attention</span>
        </div>
        <div className="text-2xl font-bold">{openShifts + shiftsWithConflicts}</div>
        <div className="text-xs text-muted-foreground">
          {openShifts} open, {shiftsWithConflicts} pending
        </div>
      </Card>
    </div>
  );
}
