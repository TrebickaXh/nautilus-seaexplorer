import { useState } from "react";
import { useUserRole } from "@/hooks/useUserRole";
import { CalendarGrid } from "@/components/schedules/CalendarGrid";
import { OpenShiftsPanel } from "@/components/schedules/OpenShiftsPanel";
import { ApprovalsPanel } from "@/components/schedules/ApprovalsPanel";
import { ShiftDialog } from "@/components/schedules/ShiftDialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { addDays, startOfWeek, format } from "date-fns";

export default function Schedules() {
  const { isAdmin, loading: roleLoading } = useUserRole();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<"week" | "day" | "2week" | "month">("week");
  const [selectedDepartment, setSelectedDepartment] = useState<string>("all");
  const [showOpenShifts, setShowOpenShifts] = useState(false);
  const [showApprovals, setShowApprovals] = useState(false);
  const [createShiftOpen, setCreateShiftOpen] = useState(false);

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });

  const navigatePrevious = () => {
    const daysToSubtract = viewMode === "week" ? 7 : viewMode === "2week" ? 14 : viewMode === "month" ? 30 : 1;
    setCurrentDate(addDays(currentDate, -daysToSubtract));
  };

  const navigateNext = () => {
    const daysToAdd = viewMode === "week" ? 7 : viewMode === "2week" ? 14 : viewMode === "month" ? 30 : 1;
    setCurrentDate(addDays(currentDate, daysToAdd));
  };

  const navigateToday = () => {
    setCurrentDate(new Date());
  };

  if (roleLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="border-b bg-background p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-6 h-6 text-primary" />
              <h1 className="text-2xl font-bold">Schedules</h1>
            </div>
            {isAdmin && (
              <Button onClick={() => setCreateShiftOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create Shift
              </Button>
            )}
          </div>

          {/* Controls */}
          <div className="flex items-center gap-4 flex-wrap">
            {/* Date Navigation */}
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={navigatePrevious}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={navigateToday}>
                Today
              </Button>
              <Button variant="outline" size="sm" onClick={navigateNext}>
                <ChevronRight className="w-4 h-4" />
              </Button>
              <span className="text-sm font-medium ml-2">
                {format(weekStart, "MMM d, yyyy")}
              </span>
            </div>

            {/* View Mode */}
            <Select value={viewMode} onValueChange={(v: any) => setViewMode(v)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Day</SelectItem>
                <SelectItem value="week">Week</SelectItem>
                <SelectItem value="2week">2 Weeks</SelectItem>
                <SelectItem value="month">Month</SelectItem>
              </SelectContent>
            </Select>

            {/* Department Filter */}
            <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All Departments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {/* Will be populated dynamically */}
              </SelectContent>
            </Select>

            {/* Quick Actions */}
            <div className="ml-auto flex gap-2">
              <Button
                variant={showOpenShifts ? "default" : "outline"}
                size="sm"
                onClick={() => setShowOpenShifts(!showOpenShifts)}
              >
                Open Shifts
              </Button>
              {isAdmin && (
                <Button
                  variant={showApprovals ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowApprovals(!showApprovals)}
                >
                  Approvals
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="flex-1 overflow-auto">
          <CalendarGrid
            startDate={weekStart}
            viewMode={viewMode}
            departmentFilter={selectedDepartment}
          />
        </div>
      </div>

      {/* Right Panels */}
      {showOpenShifts && (
        <div className="w-96 border-l bg-background overflow-auto">
          <OpenShiftsPanel onClose={() => setShowOpenShifts(false)} />
        </div>
      )}

      {showApprovals && isAdmin && (
        <div className="w-96 border-l bg-background overflow-auto">
          <ApprovalsPanel onClose={() => setShowApprovals(false)} />
        </div>
      )}

      <ShiftDialog
        open={createShiftOpen}
        onOpenChange={setCreateShiftOpen}
        defaultDate={currentDate}
      />
    </div>
  );
}
