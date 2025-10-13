import { supabase } from "@/integrations/supabase/client";
import { differenceInHours, parseISO, startOfWeek, endOfWeek } from "date-fns";

export interface RuleResult {
  eligible: boolean;
  warnings: string[];
  blocks: string[];
  metrics: {
    projectedWeeklyHours: number;
    projectedOvertimeHours: number;
  };
  conflicts?: {
    type: "overlap" | "rest_violation" | "overtime" | "availability";
    message: string;
  }[];
}

export interface ShiftChange {
  employeeId: string;
  shiftId: string;
  departmentId: string;
  positionId?: string;
  startAt: string;
  endAt: string;
  requiredSkills?: string[];
}

/**
 * Rules Engine: Evaluates whether an employee can be assigned to a shift
 */
export async function evaluateAssignment(change: ShiftChange): Promise<RuleResult> {
  const result: RuleResult = {
    eligible: true,
    warnings: [],
    blocks: [],
    conflicts: [],
    metrics: {
      projectedWeeklyHours: 0,
      projectedOvertimeHours: 0,
    },
  };

  try {
    // Fetch employee data
    const { data: employee, error: empError } = await supabase
      .from("profiles")
      .select("*, position:positions(*)")
      .eq("id", change.employeeId)
      .single();

    if (empError || !employee) {
      result.blocks.push("EMPLOYEE_NOT_FOUND");
      result.eligible = false;
      return result;
    }

    // Fetch labor rules for the org
    const { data: laborRules } = await supabase
      .from("labor_rules")
      .select("*")
      .eq("org_id", employee.org_id)
      .single();

    // Check 1: Skills/Certifications
    if (change.requiredSkills && change.requiredSkills.length > 0) {
      const employeeSkills = employee.skills || [];
      const missingSkills = change.requiredSkills.filter(
        (skill) => !employeeSkills.includes(skill)
      );
      if (missingSkills.length > 0) {
        result.blocks.push(`LACK_SKILL_${missingSkills.join("_")}`);
        result.eligible = false;
      }
    }

    // Check 2: Overlap with existing assignments
    const shiftStart = parseISO(change.startAt);
    const shiftEnd = parseISO(change.endAt);

    const { data: existingShifts } = await supabase
      .from("schedule_assignments")
      .select("shift:shifts(*)")
      .eq("employee_id", change.employeeId)
      .eq("status", "assigned");

    if (existingShifts) {
      for (const assignment of existingShifts) {
        const shift = assignment.shift as any;
        const existingStart = parseISO(shift.start_at);
        const existingEnd = parseISO(shift.end_at);

        // Check for overlap
        if (
          (shiftStart >= existingStart && shiftStart < existingEnd) ||
          (shiftEnd > existingStart && shiftEnd <= existingEnd) ||
          (shiftStart <= existingStart && shiftEnd >= existingEnd)
        ) {
          result.blocks.push("OVERLAP_EXISTING_SHIFT");
          result.eligible = false;
          result.conflicts?.push({
            type: "overlap",
            message: `Overlaps with shift at ${existingStart.toLocaleTimeString()}`,
          });
        }

        // Check 3: Minimum rest hours
        if (laborRules) {
          const hoursBetween = differenceInHours(shiftStart, existingEnd);
          if (hoursBetween >= 0 && hoursBetween < laborRules.min_rest_hours) {
            result.blocks.push(`REST_VIOLATION_${laborRules.min_rest_hours}H`);
            result.eligible = false;
            result.conflicts?.push({
              type: "rest_violation",
              message: `Less than ${laborRules.min_rest_hours} hours rest between shifts`,
            });
          }

          // Check rest before (if new shift ends before existing starts)
          const hoursBeforeNext = differenceInHours(existingStart, shiftEnd);
          if (hoursBeforeNext >= 0 && hoursBeforeNext < laborRules.min_rest_hours) {
            result.blocks.push(`REST_VIOLATION_${laborRules.min_rest_hours}H`);
            result.eligible = false;
            result.conflicts?.push({
              type: "rest_violation",
              message: `Less than ${laborRules.min_rest_hours} hours rest between shifts`,
            });
          }
        }
      }
    }

    // Check 4: Availability windows
    if (employee.availability_rules && typeof employee.availability_rules === "object") {
      const dayOfWeek = shiftStart.getDay();
      const dayNames = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
      const dayKey = dayNames[dayOfWeek];
      
      const availableWindows = (employee.availability_rules as any)[dayKey];
      if (!availableWindows || availableWindows.length === 0) {
        result.warnings.push("OUTSIDE_AVAILABILITY_WINDOW");
        result.conflicts?.push({
          type: "availability",
          message: "Outside employee's preferred availability",
        });
      }
    }

    // Check 5: Weekly hours and overtime forecast
    const weekStart = startOfWeek(shiftStart, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(shiftStart, { weekStartsOn: 1 });

    const { data: weeklyShifts } = await supabase
      .from("schedule_assignments")
      .select("shift:shifts(*)")
      .eq("employee_id", change.employeeId)
      .eq("status", "assigned");

    let totalWeeklyHours = 0;
    if (weeklyShifts) {
      for (const assignment of weeklyShifts) {
        const shift = assignment.shift as any;
        const start = parseISO(shift.start_at);
        if (start >= weekStart && start <= weekEnd) {
          const end = parseISO(shift.end_at);
          totalWeeklyHours += differenceInHours(end, start);
        }
      }
    }

    // Add the new shift hours
    const newShiftHours = differenceInHours(shiftEnd, shiftStart);
    totalWeeklyHours += newShiftHours;

    result.metrics.projectedWeeklyHours = totalWeeklyHours;

    if (laborRules) {
      const overtimeThreshold = laborRules.max_hours_week;
      if (totalWeeklyHours > overtimeThreshold) {
        result.metrics.projectedOvertimeHours = totalWeeklyHours - overtimeThreshold;
        result.warnings.push(`OVERTIME_FORECAST_${result.metrics.projectedOvertimeHours}H`);
        result.conflicts?.push({
          type: "overtime",
          message: `Will exceed ${overtimeThreshold}h limit (${totalWeeklyHours}h total)`,
        });
      }

      // Check daily max
      const dayStart = new Date(shiftStart);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(shiftStart);
      dayEnd.setHours(23, 59, 59, 999);

      const { data: dailyShifts } = await supabase
        .from("schedule_assignments")
        .select("shift:shifts(*)")
        .eq("employee_id", change.employeeId)
        .eq("status", "assigned");

      let dailyHours = newShiftHours;
      if (dailyShifts) {
        for (const assignment of dailyShifts) {
          const shift = assignment.shift as any;
          const start = parseISO(shift.start_at);
          if (start >= dayStart && start <= dayEnd) {
            const end = parseISO(shift.end_at);
            dailyHours += differenceInHours(end, start);
          }
        }
      }

      if (dailyHours > laborRules.max_hours_day) {
        result.warnings.push(`DAILY_MAX_EXCEEDED_${dailyHours - laborRules.max_hours_day}H`);
      }
    }

  } catch (error) {
    console.error("Rules engine error:", error);
    result.blocks.push("RULES_ENGINE_ERROR");
    result.eligible = false;
  }

  return result;
}
