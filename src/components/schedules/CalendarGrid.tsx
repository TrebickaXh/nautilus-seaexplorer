import { useMemo } from "react";
import { useScheduleData } from "@/hooks/useScheduleData";
import { ShiftChip } from "./ShiftChip";
import { ConflictIndicator } from "./ConflictIndicator";
import { useConflictDetection } from "@/hooks/useConflictDetection";
import { format, addDays } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

interface CalendarGridProps {
  startDate: Date;
  viewMode: "week" | "day" | "2week" | "month";
  departmentFilter: string;
}

export function CalendarGrid({ startDate, viewMode, departmentFilter }: CalendarGridProps) {
  const daysToShow = viewMode === "day" ? 1 : viewMode === "week" ? 7 : viewMode === "2week" ? 14 : 30;
  const { shifts, employees, departments, loading } = useScheduleData(startDate, daysToShow, departmentFilter);
  
  // Memoize expensive computations
  const days = useMemo(
    () => Array.from({ length: daysToShow }, (_, i) => addDays(startDate, i)),
    [startDate, daysToShow]
  );

  const employeeAvailability = useMemo(
    () => employees.reduce((acc: any, emp: any) => {
      if (emp.availability_rules) {
        acc[emp.id] = emp.availability_rules;
      }
      return acc;
    }, {}),
    [employees]
  );

  const employeesByDept = useMemo(
    () => employees.reduce((acc, emp) => {
      const deptId = emp.department_id || "unassigned";
      if (!acc[deptId]) acc[deptId] = [];
      acc[deptId].push(emp);
      return acc;
    }, {} as Record<string, typeof employees>),
    [employees]
  );
  
  // Detect conflicts
  const conflicts = useConflictDetection(shifts, employeeAvailability);

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="min-w-max">
      {/* Header with dates */}
      <div className="sticky top-0 bg-background border-b z-10">
        <div className="flex">
          <div className="w-48 p-3 font-semibold border-r">Employee</div>
          {days.map((day) => (
            <div
              key={day.toISOString()}
              className="flex-1 min-w-[150px] p-3 text-center border-r"
            >
              <div className="font-semibold">{format(day, "EEE")}</div>
              <div className="text-sm text-muted-foreground">{format(day, "MMM d")}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Grid by Department */}
      {departments.map((dept) => {
        const deptEmployees = employeesByDept[dept.id] || [];
        
        return (
          <div key={dept.id} className="border-b">
            {/* Department Header */}
            <div className="bg-muted/50 p-2 font-semibold border-b sticky top-16 z-10">
              {dept.name}
            </div>

            {/* Open Shifts Row for this department */}
            <div className="flex border-b bg-primary/5">
              <div className="w-48 p-3 font-medium border-r text-sm">
                Open Shifts
              </div>
              {days.map((day) => {
                const dayShifts = shifts.filter(
                  (s) =>
                    s.department_id === dept.id &&
                    s.is_open &&
                    format(new Date(s.start_at), "yyyy-MM-dd") === format(day, "yyyy-MM-dd")
                );

                return (
                  <div key={day.toISOString()} className="flex-1 min-w-[150px] p-2 border-r">
                    <div className="space-y-1">
                      {dayShifts.map((shift) => (
                        <ShiftChip key={shift.id} shift={shift} isOpen />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Employee Rows */}
            {deptEmployees.map((employee) => (
              <div key={employee.id} className="flex border-b hover:bg-muted/30">
                <div className="w-48 p-3 border-r">
                  <div className="font-medium text-sm">{employee.display_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {employee.position_name || "No position"}
                  </div>
                </div>
                {days.map((day) => {
                  const dayShifts = shifts.filter(
                    (s) =>
                      s.employee_id === employee.id &&
                      format(new Date(s.start_at), "yyyy-MM-dd") === format(day, "yyyy-MM-dd")
                  );

                  return (
                    <div key={day.toISOString()} className="flex-1 min-w-[150px] p-2 border-r">
                      <div className="space-y-1">
                        {dayShifts.map((shift) => (
                          <div key={shift.id} className="space-y-1">
                            <ShiftChip shift={shift} />
                            {conflicts[employee.id]?.some(c => c.shiftIds.includes(shift.id)) && (
                              <ConflictIndicator 
                                conflicts={conflicts[employee.id].filter(c => c.shiftIds.includes(shift.id))} 
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        );
      })}

      {departments.length === 0 && (
        <div className="p-8 text-center text-muted-foreground">
          No departments found. Create departments and positions to start scheduling.
        </div>
      )}
    </div>
  );
}
