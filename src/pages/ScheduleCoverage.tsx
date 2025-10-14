import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, TrendingUp, Users, AlertTriangle, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { AutoAssignDialog } from "@/components/schedules/AutoAssignDialog";
import { format, addWeeks, startOfWeek, endOfWeek } from "date-fns";

export default function ScheduleCoverage() {
  const [currentWeek, setCurrentWeek] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [selectedDepartment, setSelectedDepartment] = useState<string>("all");
  const [autoAssignDialogOpen, setAutoAssignDialogOpen] = useState(false);
  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null);

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });

  const { data: departments = [] } = useQuery({
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

  const { data: coverageData, isLoading } = useQuery({
    queryKey: ["schedule-coverage", weekStart.toISOString(), selectedDepartment],
    queryFn: async () => {
      let query = supabase
        .from("shifts")
        .select(`
          *,
          department:departments(id, name),
          location:locations(id, name),
          assignment:schedule_assignments(id, employee_id, employee:profiles(display_name)),
          open:open_shift_pool(id),
          claims:shift_claims(id, status)
        `)
        .gte("start_at", weekStart.toISOString())
        .lte("start_at", weekEnd.toISOString())
        .is("archived_at", null);

      if (selectedDepartment !== "all") {
        query = query.eq("department_id", selectedDepartment);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const calculateCoverageStats = () => {
    if (!coverageData) return null;

    const stats = {
      total: coverageData.length,
      assigned: 0,
      open: 0,
      claimed: 0,
      understaffed: 0,
      totalHours: 0,
      assignedHours: 0,
    };

    coverageData.forEach((shift: any) => {
      const duration = (new Date(shift.end_at).getTime() - new Date(shift.start_at).getTime()) / (1000 * 60 * 60);
      stats.totalHours += duration;

      if (shift.assignment && shift.assignment.length > 0) {
        stats.assigned++;
        stats.assignedHours += duration;
      } else if (shift.open && shift.open.length > 0) {
        stats.open++;
      }

      if (shift.claims && shift.claims.filter((c: any) => c.status === "waiting").length > 0) {
        stats.claimed++;
      }
    });

    stats.understaffed = stats.total - stats.assigned;

    return stats;
  };

  const getCoverageByDepartment = () => {
    if (!coverageData) return [];

    const deptMap = new Map();

    coverageData.forEach((shift: any) => {
      const deptId = shift.department?.id || "none";
      const deptName = shift.department?.name || "No Department";

      if (!deptMap.has(deptId)) {
        deptMap.set(deptId, {
          id: deptId,
          name: deptName,
          total: 0,
          assigned: 0,
          open: 0,
        });
      }

      const dept = deptMap.get(deptId);
      dept.total++;

      if (shift.assignment && shift.assignment.length > 0) {
        dept.assigned++;
      } else if (shift.open && shift.open.length > 0) {
        dept.open++;
      }
    });

    return Array.from(deptMap.values()).sort((a, b) => b.total - a.total);
  };

  const stats = calculateCoverageStats();
  const deptCoverage = getCoverageByDepartment();

  const coveragePercentage = stats ? ((stats.assigned / stats.total) * 100).toFixed(1) : 0;

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <TrendingUp className="w-8 h-8 text-primary" />
            Schedule Coverage
          </h1>
          <p className="text-muted-foreground mt-1">
            Monitor shift coverage and staffing levels
          </p>
        </div>
      </div>

      {/* Week Navigation & Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentWeek(addWeeks(currentWeek, -1))}
        >
          <ChevronLeft className="w-4 h-4 mr-2" />
          Previous Week
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentWeek(new Date())}
        >
          <Calendar className="w-4 h-4 mr-2" />
          This Week
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentWeek(addWeeks(currentWeek, 1))}
        >
          Next Week
          <ChevronRight className="w-4 h-4 ml-2" />
        </Button>
        <span className="text-sm font-medium">
          {format(weekStart, "MMM d")} - {format(weekEnd, "MMM d, yyyy")}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              // Find first open shift to use for auto-assign
              const openShift = coverageData?.find((shift: any) => 
                !shift.assignment || shift.assignment.length === 0
              );
              if (openShift) {
                setSelectedShiftId(openShift.id);
                setAutoAssignDialogOpen(true);
              }
            }}
            disabled={!coverageData || coverageData.every((shift: any) => shift.assignment && shift.assignment.length > 0)}
          >
            <Sparkles className="w-4 h-4 mr-2" />
            AI Auto-Assign
          </Button>
          <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All Departments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {departments.map((dept) => (
                <SelectItem key={dept.id} value={dept.id}>
                  {dept.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading coverage data...</div>
      ) : (
        <>
          {/* Overview Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Shifts</p>
                  <p className="text-3xl font-bold mt-1">{stats?.total || 0}</p>
                </div>
                <Calendar className="w-10 h-10 text-primary opacity-20" />
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Assigned</p>
                  <p className="text-3xl font-bold mt-1 text-green-600">{stats?.assigned || 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {coveragePercentage}% coverage
                  </p>
                </div>
                <Users className="w-10 h-10 text-green-600 opacity-20" />
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Open Shifts</p>
                  <p className="text-3xl font-bold mt-1 text-orange-600">{stats?.open || 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">Needs coverage</p>
                </div>
                <AlertTriangle className="w-10 h-10 text-orange-600 opacity-20" />
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Hours</p>
                  <p className="text-3xl font-bold mt-1">{stats?.totalHours.toFixed(1) || 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {stats?.assignedHours.toFixed(1) || 0} hrs assigned
                  </p>
                </div>
                <TrendingUp className="w-10 h-10 text-primary opacity-20" />
              </div>
            </Card>
          </div>

          {/* Coverage by Department */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Coverage by Department</h2>
            <div className="space-y-4">
              {deptCoverage.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No shifts scheduled for this period
                </p>
              ) : (
                deptCoverage.map((dept) => {
                  const deptPercentage = ((dept.assigned / dept.total) * 100).toFixed(0);
                  const status =
                    dept.assigned === dept.total
                      ? "success"
                      : dept.open > 0
                      ? "warning"
                      : "error";

                  return (
                    <div key={dept.id} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-medium">{dept.name}</span>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge
                              variant={
                                status === "success"
                                  ? "default"
                                  : status === "warning"
                                  ? "secondary"
                                  : "destructive"
                              }
                              className="text-xs"
                            >
                              {dept.assigned}/{dept.total} assigned
                            </Badge>
                            {dept.open > 0 && (
                              <Badge variant="outline" className="text-xs">
                                {dept.open} open
                              </Badge>
                            )}
                          </div>
                        </div>
                        <span className="text-2xl font-bold">{deptPercentage}%</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                        <div
                          className={`h-full transition-all ${
                            status === "success"
                              ? "bg-green-600"
                              : status === "warning"
                              ? "bg-orange-500"
                              : "bg-destructive"
                          }`}
                          style={{ width: `${deptPercentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </Card>

          {/* Alerts */}
          {stats && stats.understaffed > 0 && (
            <Card className="p-6 border-destructive bg-destructive/5">
              <div className="flex items-start gap-4">
                <AlertTriangle className="w-6 h-6 text-destructive mt-1" />
                <div>
                  <h3 className="font-semibold text-lg">Coverage Alert</h3>
                  <p className="text-muted-foreground mt-1">
                    There are <span className="font-bold text-destructive">{stats.understaffed}</span>{" "}
                    unassigned shifts this week requiring immediate attention.
                  </p>
                  <Button className="mt-3" size="sm">
                    View Open Shifts
                  </Button>
                </div>
              </div>
            </Card>
          )}
        </>
      )}

      {selectedShiftId && (
        <AutoAssignDialog
          open={autoAssignDialogOpen}
          onOpenChange={setAutoAssignDialogOpen}
          shiftId={selectedShiftId}
        />
      )}
    </div>
  );
}
