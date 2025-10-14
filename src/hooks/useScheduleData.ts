import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { addDays } from "date-fns";

export function useScheduleData(startDate: Date, daysCount: number, departmentFilter: string) {
  const endDate = addDays(startDate, daysCount);

  // Fetch shifts with assignments
  const {
    data: shifts = [],
    isLoading: shiftsLoading,
    error: shiftsError,
  } = useQuery({
    queryKey: ["schedule-shifts", startDate.toISOString(), daysCount, departmentFilter],
    queryFn: async () => {
      let query = supabase
        .from("shifts")
        .select(`
          *,
          department:departments(id, name),
          location:locations(id, name),
          assignments:schedule_assignments(
            id,
            employee_id,
            status,
            employee:profiles(id, display_name, position_id)
          ),
          open_shift:open_shift_pool(id, bonus_cents, post_reason),
          claims:shift_claims(id, status)
        `)
        .eq("is_template", false)
        .gte("start_at", startDate.toISOString())
        .lte("start_at", endDate.toISOString())
        .order("start_at", { ascending: true });

      if (departmentFilter !== "all") {
        query = query.eq("department_id", departmentFilter);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Transform data for easier consumption
      return data.map((shift: any) => {
        const assignment = shift.assignments?.[0];
        const isOpen = shift.open_shift && shift.open_shift.length > 0;
        const hasClaims = shift.claims && shift.claims.length > 0;

        return {
          id: shift.id,
          name: shift.name,
          start_at: shift.start_at,
          end_at: shift.end_at,
          department_id: shift.department_id,
          department_name: shift.department?.name,
          location_id: shift.location_id,
          location_name: shift.location?.name,
          employee_id: assignment?.employee_id,
          employee_name: assignment?.employee?.display_name,
          assignment_id: assignment?.id,
          position_id: assignment?.employee?.position_id,
          position_name: null, // Will be populated from positions
          status: shift.status,
          is_open: isOpen,
          has_claims: hasClaims,
          has_swaps: false, // Can be checked via separate query if needed
          bonus_cents: shift.open_shift?.[0]?.bonus_cents || 0,
          requires_skills: shift.required_skills || [],
        };
      });
    },
  });

  // Fetch employees
  const {
    data: employees = [],
    isLoading: employeesLoading,
  } = useQuery({
    queryKey: ["schedule-employees", departmentFilter],
    queryFn: async () => {
      const { data: userDepts } = await supabase
        .from("user_departments")
        .select("user_id, department_id, departments(id, name)");

      let query = supabase
        .from("profiles")
        .select(`
          id,
          display_name,
          position_id,
          department,
          skills
        `)
        .eq("active", true);

      const { data, error } = await query;
      if (error) throw error;

      // Merge department info
      return data.map((emp: any) => {
        const userDept = userDepts?.find((ud: any) => ud.user_id === emp.id);
        return {
          ...emp,
          department_id: userDept?.department_id,
          department_name: userDept?.departments?.name,
        };
      });
    },
  });

  // Fetch departments
  const {
    data: departments = [],
    isLoading: departmentsLoading,
  } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("departments")
        .select("id, name, location_id")
        .is("archived_at", null)
        .order("name");

      if (error) throw error;
      return data;
    },
  });

  // Fetch positions
  const { data: positions = [] } = useQuery({
    queryKey: ["positions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("positions")
        .select("id, name")
        .is("archived_at", null);

      if (error) throw error;
      return data;
    },
  });

  // Merge position names into shifts and employees
  const enrichedShifts = shifts.map((shift: any) => {
    const position = positions.find((p: any) => p.id === shift.position_id);
    return {
      ...shift,
      position_name: position?.name,
    };
  });

  const enrichedEmployees = employees.map((emp: any) => {
    const position = positions.find((p: any) => p.id === emp.position_id);
    return {
      ...emp,
      position_name: position?.name,
    };
  });

  return {
    shifts: enrichedShifts,
    employees: enrichedEmployees,
    departments,
    positions,
    loading: shiftsLoading || employeesLoading || departmentsLoading,
    error: shiftsError,
  };
}
