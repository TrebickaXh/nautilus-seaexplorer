import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Clock, Users as UsersIcon } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getCurrentTimeInTimezone } from "@/hooks/useOrgTimezone";
import { useEffect, useState } from "react";

interface ShiftInProgressProps {
  orgId: string;
  timezone: string;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function parseTime(timeStr: string): { hours: number; minutes: number } {
  const [h, m] = timeStr.split(":").map(Number);
  return { hours: h, minutes: m };
}

function timeToMinutes(timeStr: string): number {
  const { hours, minutes } = parseTime(timeStr);
  return hours * 60 + minutes;
}

function formatTimeRemaining(minutes: number): string {
  if (minutes <= 0) return "Ending soon";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `Ends in ${m}m`;
  return `Ends in ${h}h ${m}m`;
}

export default function ShiftInProgressCard({ orgId, timezone }: ShiftInProgressProps) {
  const [nowMinutes, setNowMinutes] = useState(() => {
    const currentTime = getCurrentTimeInTimezone(timezone);
    return timeToMinutes(currentTime);
  });

  // Update current time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      const currentTime = getCurrentTimeInTimezone(timezone);
      setNowMinutes(timeToMinutes(currentTime));
    }, 60_000);
    return () => clearInterval(interval);
  }, [timezone]);

  const currentDow = new Date().toLocaleDateString("en-US", {
    timeZone: timezone,
    weekday: "short",
  });
  const dowMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  const currentDayNum = dowMap[currentDow] ?? new Date().getDay();

  // Fetch shifts for this org's locations
  const { data: shiftsData } = useQuery({
    queryKey: ["dashboard", orgId, "shifts-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shifts")
        .select("*, departments(name), locations(name, org_id)")
        .is("archived_at", null);
      if (error) throw error;
      // Filter to org
      return (data || []).filter(
        (s: any) => s.locations?.org_id === orgId
      );
    },
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000,
  });

  // Find active shift
  const activeShift = (shiftsData || []).find((s: any) => {
    if (!s.days_of_week?.includes(currentDayNum)) return false;
    const start = timeToMinutes(s.start_time);
    const end = timeToMinutes(s.end_time);
    // Handle overnight shifts
    if (end <= start) {
      return nowMinutes >= start || nowMinutes < end;
    }
    return nowMinutes >= start && nowMinutes < end;
  });

  // Find next shift if no active one
  const nextShift = !activeShift
    ? (shiftsData || [])
        .filter((s: any) => s.days_of_week?.includes(currentDayNum))
        .filter((s: any) => timeToMinutes(s.start_time) > nowMinutes)
        .sort((a: any, b: any) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time))[0]
    : null;

  // Fetch shift task progress + crew activity for active shift
  const { data: shiftProgress } = useQuery({
    queryKey: ["dashboard", orgId, "shift-progress", activeShift?.id],
    queryFn: async () => {
      if (!activeShift) return null;

      const today = new Date();
      const todayStr = today.toLocaleDateString("en-CA", { timeZone: timezone });
      const dayStart = new Date(`${todayStr}T00:00:00`);
      const dayEnd = new Date(`${todayStr}T23:59:59.999`);

      const [tasksResult, crewResult, completionsResult] = await Promise.all([
        supabase
          .from("task_instances")
          .select("id, status")
          .eq("org_id", orgId)
          .eq("shift_id", activeShift.id)
          .gte("due_at", dayStart.toISOString())
          .lte("due_at", dayEnd.toISOString())
          .limit(200),
        supabase
          .from("user_shifts")
          .select("user_id, profiles!user_id(display_name)")
          .eq("shift_id", activeShift.id),
        supabase
          .from("completions")
          .select("user_id")
          .eq("org_id", orgId)
          .gte("created_at", dayStart.toISOString())
          .lte("created_at", dayEnd.toISOString()),
      ]);

      const tasks = tasksResult.data || [];
      const crew = crewResult.data || [];
      const completions = completionsResult.data || [];

      const activeUserIds = new Set(completions.map((c: any) => c.user_id));

      return {
        totalTasks: tasks.length,
        doneTasks: tasks.filter((t: any) => t.status === "done").length,
        crew: crew.map((c: any) => ({
          userId: c.user_id,
          name: c.profiles?.display_name || "?",
          active: activeUserIds.has(c.user_id),
        })),
      };
    },
    enabled: !!activeShift,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });

  // Time remaining for active shift
  const timeRemaining = activeShift
    ? (() => {
        const endMin = timeToMinutes(activeShift.end_time);
        let remaining = endMin - nowMinutes;
        if (remaining < 0) remaining += 1440; // overnight
        return remaining;
      })()
    : 0;

  const nextShiftTime = nextShift
    ? nextShift.start_time.slice(0, 5)
    : null;

  const progress = shiftProgress;
  const progressPct =
    progress && progress.totalTasks > 0
      ? Math.round((progress.doneTasks / progress.totalTasks) * 100)
      : 0;

  return (
    <Card className="shadow-ocean h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium text-muted-foreground">
            Shift Status
          </CardTitle>
          <Clock className="w-4 h-4 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {activeShift ? (
          <>
            {/* Shift name */}
            <div>
              <p className="font-semibold text-lg">{activeShift.name}</p>
              <p className="text-sm text-muted-foreground">
                {activeShift.departments?.name || "—"} • {activeShift.locations?.name}
              </p>
            </div>

            {/* Progress */}
            <div>
              <div className="flex items-baseline justify-between mb-1.5">
                <span className="text-sm font-medium">
                  {progress?.doneTasks ?? 0} of {progress?.totalTasks ?? 0} tasks done
                </span>
                <span className="text-xs text-muted-foreground">{progressPct}%</span>
              </div>
              <Progress value={progressPct} className="h-2" />
            </div>

            {/* Time remaining */}
            <p className="text-sm text-muted-foreground">
              {formatTimeRemaining(timeRemaining)}
            </p>

            {/* Crew avatars */}
            {progress && progress.crew.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                  <UsersIcon className="w-3 h-3" /> Crew
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {progress.crew.slice(0, 6).map((member: any) => (
                    <Avatar
                      key={member.userId}
                      className={`w-8 h-8 text-xs ${
                        member.active
                          ? "ring-2 ring-success"
                          : "opacity-50"
                      }`}
                    >
                      <AvatarFallback
                        className={
                          member.active
                            ? "bg-success/15 text-success"
                            : "bg-muted text-muted-foreground"
                        }
                      >
                        {getInitials(member.name)}
                      </AvatarFallback>
                    </Avatar>
                  ))}
                  {progress.crew.length > 6 && (
                    <Avatar className="w-8 h-8 text-xs opacity-50">
                      <AvatarFallback className="bg-muted text-muted-foreground">
                        +{progress.crew.length - 6}
                      </AvatarFallback>
                    </Avatar>
                  )}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-6">
            <Clock className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-50" />
            <p className="font-medium text-muted-foreground">
              No active shift right now
            </p>
            {nextShiftTime ? (
              <p className="text-sm text-muted-foreground mt-1">
                Next shift starts at {nextShiftTime}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground mt-1">
                No more shifts scheduled today
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
