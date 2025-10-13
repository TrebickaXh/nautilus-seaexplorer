import { useMemo } from "react";

interface Shift {
  id: string;
  start_at: string;
  end_at: string;
  employee_id?: string;
  employee_name?: string;
}

interface Conflict {
  type: "overlap" | "rest_violation" | "overtime" | "availability";
  message: string;
  shiftIds: string[];
}

export function useConflictDetection(shifts: Shift[], employeeAvailability?: any) {
  const conflicts = useMemo(() => {
    const detectedConflicts: Record<string, Conflict[]> = {};

    // Group shifts by employee
    const shiftsByEmployee = shifts.reduce((acc, shift) => {
      if (!shift.employee_id) return acc;
      if (!acc[shift.employee_id]) acc[shift.employee_id] = [];
      acc[shift.employee_id].push(shift);
      return acc;
    }, {} as Record<string, Shift[]>);

    // Check each employee's shifts
    Object.entries(shiftsByEmployee).forEach(([employeeId, empShifts]) => {
      if (!detectedConflicts[employeeId]) detectedConflicts[employeeId] = [];

      // Sort shifts by start time
      const sortedShifts = [...empShifts].sort(
        (a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime()
      );

      // Check for overlaps and rest violations
      for (let i = 0; i < sortedShifts.length - 1; i++) {
        const current = sortedShifts[i];
        const next = sortedShifts[i + 1];

        const currentEnd = new Date(current.end_at);
        const nextStart = new Date(next.start_at);
        const hoursBetween = (nextStart.getTime() - currentEnd.getTime()) / (1000 * 60 * 60);

        // Check for overlaps
        if (currentEnd > nextStart) {
          detectedConflicts[employeeId].push({
            type: "overlap",
            message: `Shift overlap detected for ${current.employee_name || "employee"}`,
            shiftIds: [current.id, next.id],
          });
        }
        // Check for minimum rest period (8 hours)
        else if (hoursBetween < 8) {
          detectedConflicts[employeeId].push({
            type: "rest_violation",
            message: `Less than 8 hours rest between shifts for ${
              current.employee_name || "employee"
            }`,
            shiftIds: [current.id, next.id],
          });
        }
      }

      // Check for weekly overtime (>40 hours)
      const weeklyHours = empShifts.reduce((total, shift) => {
        const hours =
          (new Date(shift.end_at).getTime() - new Date(shift.start_at).getTime()) /
          (1000 * 60 * 60);
        return total + hours;
      }, 0);

      if (weeklyHours > 40) {
        detectedConflicts[employeeId].push({
          type: "overtime",
          message: `Employee scheduled for ${weeklyHours.toFixed(1)} hours (exceeds 40 hours)`,
          shiftIds: empShifts.map((s) => s.id),
        });
      }

      // Check availability if provided
      if (employeeAvailability?.[employeeId]) {
        const availability = employeeAvailability[employeeId];
        const dayKeys = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

        empShifts.forEach((shift) => {
          const shiftDate = new Date(shift.start_at);
          const dayKey = dayKeys[shiftDate.getDay()];
          const shiftStart = shiftDate.toTimeString().slice(0, 5);
          const shiftEnd = new Date(shift.end_at).toTimeString().slice(0, 5);

          const dayAvailability = availability[dayKey] || [];
          const isAvailable = dayAvailability.some((slot: string[]) => {
            return shiftStart >= slot[0] && shiftEnd <= slot[1];
          });

          if (!isAvailable && dayAvailability.length > 0) {
            detectedConflicts[employeeId].push({
              type: "availability",
              message: `Shift outside employee availability on ${shiftDate.toLocaleDateString()}`,
              shiftIds: [shift.id],
            });
          }
        });
      }
    });

    return detectedConflicts;
  }, [shifts, employeeAvailability]);

  return conflicts;
}
