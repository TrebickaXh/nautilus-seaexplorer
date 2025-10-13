import { useState } from "react";
import { useUserRole } from "@/hooks/useUserRole";
import { CalendarGrid } from "@/components/schedules/CalendarGrid";
import { OpenShiftsPanel } from "@/components/schedules/OpenShiftsPanel";
import { ApprovalsPanel } from "@/components/schedules/ApprovalsPanel";
import { TimeOffPanel } from "@/components/schedules/TimeOffPanel";
import { SwapRequestsPanel } from "@/components/schedules/SwapRequestsPanel";
import { ClaimsPanel } from "@/components/schedules/ClaimsPanel";
import { ScheduleStats } from "@/components/schedules/ScheduleStats";
import { ShiftDialog } from "@/components/schedules/ShiftDialog";
import { BulkShiftDialog } from "@/components/schedules/BulkShiftDialog";
import { CopyWeekDialog } from "@/components/schedules/CopyWeekDialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, ChevronLeft, ChevronRight, Plus, CalendarClock } from "lucide-react";
import { addDays, startOfWeek, format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useScheduleData } from "@/hooks/useScheduleData";

export default function Schedules() {
  const { isAdmin, loading: roleLoading } = useUserRole();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<"week" | "day" | "2week" | "month">("week");
  const [selectedDepartment, setSelectedDepartment] = useState<string>("all");
  const [showOpenShifts, setShowOpenShifts] = useState(false);
  const [showApprovals, setShowApprovals] = useState(false);
  const [showTimeOff, setShowTimeOff] = useState(false);
  const [showSwapRequests, setShowSwapRequests] = useState(false);
  const [showClaims, setShowClaims] = useState(false);
  const [createShiftOpen, setCreateShiftOpen] = useState(false);
  const [bulkShiftOpen, setBulkShiftOpen] = useState(false);
  const [copyWeekOpen, setCopyWeekOpen] = useState(false);

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const daysCount = viewMode === "day" ? 1 : viewMode === "week" ? 7 : viewMode === "2week" ? 14 : 30;
  const { shifts, employees } = useScheduleData(weekStart, daysCount, selectedDepartment);

  const { data: departments = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("departments")
        .select("id, name, location_id, locations(id, name)")
        .is("archived_at", null);
      if (error) throw error;
      return data;
    },
  });

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

  const isAdminRole = isAdmin();

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
            {isAdminRole && (
              <div className="flex gap-2">
                <Button onClick={() => setCreateShiftOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Shift
                </Button>
                <Button onClick={() => setBulkShiftOpen(true)} variant="outline">
                  <CalendarClock className="w-4 h-4 mr-2" />
                  Bulk Create
                </Button>
                <Button onClick={() => setCopyWeekOpen(true)} variant="outline">
                  <Calendar className="w-4 h-4 mr-2" />
                  Copy Week
                </Button>
              </div>
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
                {departments.map((dept: any) => (
                  <SelectItem key={dept.id} value={dept.id}>
                    {dept.name}
                  </SelectItem>
                ))}
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
              <Button
                variant={showSwapRequests ? "default" : "outline"}
                size="sm"
                onClick={() => setShowSwapRequests(!showSwapRequests)}
              >
                Swaps
              </Button>
              {isAdminRole && (
                <>
                  <Button
                    variant={showClaims ? "default" : "outline"}
                    size="sm"
                    onClick={() => setShowClaims(!showClaims)}
                  >
                    Claims
                  </Button>
                  <Button
                    variant={showApprovals ? "default" : "outline"}
                    size="sm"
                    onClick={() => setShowApprovals(!showApprovals)}
                  >
                    Approvals
                  </Button>
                  <Button
                    variant={showTimeOff ? "default" : "outline"}
                    size="sm"
                    onClick={() => setShowTimeOff(!showTimeOff)}
                  >
                    Time Off
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Stats */}
        <ScheduleStats shifts={shifts} employees={employees} />

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

      {showApprovals && isAdminRole && (
        <div className="w-96 border-l bg-background overflow-auto">
          <ApprovalsPanel onClose={() => setShowApprovals(false)} />
        </div>
      )}

      {showTimeOff && isAdminRole && (
        <div className="w-96 border-l bg-background overflow-auto">
          <TimeOffPanel onClose={() => setShowTimeOff(false)} />
        </div>
      )}

      {showSwapRequests && (
        <div className="w-96 border-l bg-background overflow-auto">
          <SwapRequestsPanel onClose={() => setShowSwapRequests(false)} />
        </div>
      )}

      {showClaims && isAdminRole && (
        <div className="w-96 border-l bg-background overflow-auto">
          <ClaimsPanel onClose={() => setShowClaims(false)} />
        </div>
      )}

      <ShiftDialog
        open={createShiftOpen}
        onOpenChange={setCreateShiftOpen}
        defaultDate={currentDate}
      />

      <BulkShiftDialog
        open={bulkShiftOpen}
        onOpenChange={setBulkShiftOpen}
        startDate={weekStart}
      />

      <CopyWeekDialog
        open={copyWeekOpen}
        onOpenChange={setCopyWeekOpen}
        sourceWeekStart={weekStart}
      />
    </div>
  );
}
