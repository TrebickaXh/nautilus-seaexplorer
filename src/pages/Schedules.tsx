import { useState } from "react";
import { useUserRole } from "@/hooks/useUserRole";
import { CalendarGrid } from "@/components/schedules/CalendarGrid";
import { OpenShiftsPanel } from "@/components/schedules/OpenShiftsPanel";
import { ApprovalsPanel } from "@/components/schedules/ApprovalsPanel";
import { TimeOffPanel } from "@/components/schedules/TimeOffPanel";
import { SwapRequestsPanel } from "@/components/schedules/SwapRequestsPanel";
import { ClaimsPanel } from "@/components/schedules/ClaimsPanel";
import { ScheduleStats } from "@/components/schedules/ScheduleStats";
import { ShiftTemplatesDialog } from "@/components/schedules/ShiftTemplatesDialog";
import { ShiftDialog } from "@/components/schedules/ShiftDialog";
import { BulkShiftDialog } from "@/components/schedules/BulkShiftDialog";
import { BulkAssignmentWizard } from "@/components/schedules/BulkAssignmentWizard";
import { GenerateFromTemplatesDialog } from "@/components/schedules/GenerateFromTemplatesDialog";
import { CopyWeekDialog } from "@/components/schedules/CopyWeekDialog";
import { ScheduleFilters } from "@/components/schedules/ScheduleFilters";
import { ExportScheduleDialog } from "@/components/schedules/ExportScheduleDialog";
import { RequestTimeOffDialog } from "@/components/schedules/RequestTimeOffDialog";
import { PublishScheduleDialog } from "@/components/schedules/PublishScheduleDialog";
import { ScheduleTemplates } from "@/components/schedules/ScheduleTemplates";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, ChevronLeft, ChevronRight, Plus, CalendarClock, Download, CalendarOff, Send, Users, Settings, Save } from "lucide-react";
import { addDays, startOfWeek, endOfWeek, format } from "date-fns";
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
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false);
  const [generateTemplatesOpen, setGenerateTemplatesOpen] = useState(false);
  const [copyWeekOpen, setCopyWeekOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [timeOffOpen, setTimeOffOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState<string>("all");
  const [showUnassigned, setShowUnassigned] = useState(false);
  const [showConflicts, setShowConflicts] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [shiftTemplatesOpen, setShiftTemplatesOpen] = useState(false);
  const [scheduleTemplatesOpen, setScheduleTemplatesOpen] = useState(false);

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const daysCount = viewMode === "day" ? 1 : viewMode === "week" ? 7 : viewMode === "2week" ? 14 : 30;
  const { shifts, employees, positions } = useScheduleData(weekStart, daysCount, selectedDepartment);

  // Apply filters
  const filteredShifts = shifts.filter((shift: any) => {
    if (showUnassigned && shift.employee_id) return false;
    if (showConflicts && !shift.has_claims && !shift.has_swaps) return false;
    if (selectedPosition !== "all" && shift.position_id !== selectedPosition) return false;
    if (searchQuery && shift.employee_name && !shift.employee_name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const filteredEmployees = employees.filter((emp: any) => {
    if (selectedPosition !== "all" && emp.position_id !== selectedPosition) return false;
    if (searchQuery && !emp.display_name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

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
            <div className="flex gap-2">
              {!isAdminRole && (
                <Button onClick={() => setTimeOffOpen(true)} variant="outline">
                  <CalendarOff className="w-4 h-4 mr-2" />
                  Request Time Off
                </Button>
              )}
              {isAdminRole && (
                <>
                  <Button onClick={() => setShiftTemplatesOpen(true)} variant="outline">
                    <Settings className="w-4 h-4 mr-2" />
                    Manage Shifts
                  </Button>
                  <Button onClick={() => setCreateShiftOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Shift
                  </Button>
                  <Button onClick={() => setBulkShiftOpen(true)} variant="outline">
                    <CalendarClock className="w-4 h-4 mr-2" />
                    Bulk Create
                  </Button>
                  <Button onClick={() => setGenerateTemplatesOpen(true)} variant="outline">
                    <Calendar className="w-4 h-4 mr-2" />
                    Generate from Templates
                  </Button>
                  <Button onClick={() => setScheduleTemplatesOpen(true)} variant="outline">
                    <Save className="w-4 h-4 mr-2" />
                    Schedule Templates
                  </Button>
                  <Button onClick={() => setBulkAssignOpen(true)} variant="outline">
                    <Users className="w-4 h-4 mr-2" />
                    Bulk Assign
                  </Button>
                  <Button onClick={() => setCopyWeekOpen(true)} variant="outline">
                    <Calendar className="w-4 h-4 mr-2" />
                    Copy Week
                  </Button>
                  <Button onClick={() => setPublishOpen(true)} variant="default">
                    <Send className="w-4 h-4 mr-2" />
                    Publish
                  </Button>
                </>
              )}
              <Button onClick={() => setExportOpen(true)} variant="outline">
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </div>
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

            {/* Filters */}
            <ScheduleFilters
              departments={departments}
              positions={positions}
              selectedDepartment={selectedDepartment}
              onDepartmentChange={setSelectedDepartment}
              selectedPosition={selectedPosition}
              onPositionChange={setSelectedPosition}
              showUnassigned={showUnassigned}
              onShowUnassignedChange={setShowUnassigned}
              showConflicts={showConflicts}
              onShowConflictsChange={setShowConflicts}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
            />

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
        <div className="p-4">
          <ScheduleStats shifts={filteredShifts} employees={filteredEmployees} />
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

      <ExportScheduleDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        shifts={filteredShifts}
        employees={filteredEmployees}
        weekStart={weekStart}
      />

      <RequestTimeOffDialog
        open={timeOffOpen}
        onOpenChange={setTimeOffOpen}
      />

      <PublishScheduleDialog
        open={publishOpen}
        onOpenChange={setPublishOpen}
        weekStart={weekStart}
        weekEnd={weekEnd}
        shifts={filteredShifts}
      />

      <BulkAssignmentWizard
        open={bulkAssignOpen}
        onOpenChange={setBulkAssignOpen}
        shifts={filteredShifts}
        employees={filteredEmployees}
      />

      <GenerateFromTemplatesDialog
        open={generateTemplatesOpen}
        onOpenChange={setGenerateTemplatesOpen}
        onSuccess={() => window.location.reload()}
      />

      <ShiftTemplatesDialog
        open={shiftTemplatesOpen}
        onOpenChange={setShiftTemplatesOpen}
      />

      <ScheduleTemplates
        open={scheduleTemplatesOpen}
        onOpenChange={setScheduleTemplatesOpen}
        currentWeekStart={weekStart}
        currentWeekEnd={weekEnd}
        currentShifts={filteredShifts}
      />
    </div>
  );
}
