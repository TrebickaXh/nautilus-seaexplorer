import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, MapPin, ChevronLeft, ChevronRight } from "lucide-react";
import { format, addWeeks, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay } from "date-fns";
import { ShiftDetailsDrawer } from "@/components/schedules/ShiftDetailsDrawer";

export default function EmployeeScheduleView() {
  const [currentWeek, setCurrentWeek] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [selectedShift, setSelectedShift] = useState<any>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });
  const daysInWeek = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const { data: user } = useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) throw error;
      return user;
    },
  });

  const { data: profile } = useQuery({
    queryKey: ["user-profile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: shifts = [] } = useQuery({
    queryKey: ["my-shifts", user?.id, weekStart.toISOString()],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("schedule_assignments")
        .select(`
          *,
          shift:shifts(
            *,
            department:departments(id, name),
            location:locations(id, name)
          )
        `)
        .eq("employee_id", user.id)
        .gte("shift.start_at", weekStart.toISOString())
        .lte("shift.start_at", weekEnd.toISOString())
        .order("shift.start_at", { ascending: true });

      if (error) throw error;
      return data.map((assignment: any) => assignment.shift);
    },
    enabled: !!user?.id,
  });

  const totalHours = shifts.reduce((acc, shift) => {
    if (!shift) return acc;
    const start = new Date(shift.start_at);
    const end = new Date(shift.end_at);
    const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    return acc + hours;
  }, 0);

  const handleShiftClick = (shift: any) => {
    setSelectedShift(shift);
    setDrawerOpen(true);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">My Schedule</h1>
          <p className="text-muted-foreground">
            View your assigned shifts and total hours
          </p>
        </div>
        <Card className="p-4">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Total Hours This Week</p>
            <p className="text-3xl font-bold">{totalHours.toFixed(1)}</p>
          </div>
        </Card>
      </div>

      {/* User Info */}
      {profile && (
        <Card className="p-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-xl font-bold text-primary">
                {profile.display_name?.[0]?.toUpperCase() || "?"}
              </span>
            </div>
            <div>
              <p className="font-semibold">{profile.display_name}</p>
              <p className="text-sm text-muted-foreground">{profile.email}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Week Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => setCurrentWeek(addWeeks(currentWeek, -1))}
        >
          <ChevronLeft className="w-4 h-4 mr-2" />
          Previous Week
        </Button>
        <div className="text-center">
          <p className="font-semibold">
            {format(weekStart, "MMM d")} - {format(weekEnd, "MMM d, yyyy")}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => setCurrentWeek(addWeeks(currentWeek, 1))}
        >
          Next Week
          <ChevronRight className="w-4 h-4 ml-2" />
        </Button>
      </div>

      {/* Schedule Grid */}
      <div className="grid grid-cols-7 gap-4">
        {daysInWeek.map((day) => {
          const dayShifts = shifts.filter((shift) =>
            isSameDay(new Date(shift.start_at), day)
          );

          return (
            <Card key={day.toISOString()} className="p-4">
              <div className="text-center mb-4">
                <p className="font-semibold">{format(day, "EEE")}</p>
                <p className="text-sm text-muted-foreground">{format(day, "MMM d")}</p>
              </div>

              <div className="space-y-2">
                {dayShifts.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No shifts
                  </p>
                ) : (
                  dayShifts.map((shift) => (
                    <button
                      key={shift.id}
                      onClick={() => handleShiftClick(shift)}
                      className="w-full text-left"
                    >
                      <Card className="p-3 hover:bg-muted/50 transition-colors cursor-pointer">
                        <div className="space-y-2">
                          <Badge variant="outline" className="text-xs">
                            {shift.department?.name || "No Dept"}
                          </Badge>
                          <div className="flex items-center gap-2 text-sm">
                            <Clock className="w-3 h-3" />
                            <span>
                              {format(new Date(shift.start_at), "h:mm a")} -{" "}
                              {format(new Date(shift.end_at), "h:mm a")}
                            </span>
                          </div>
                          {shift.location && (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <MapPin className="w-3 h-3" />
                              <span>{shift.location.name}</span>
                            </div>
                          )}
                        </div>
                      </Card>
                    </button>
                  ))
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {selectedShift && (
        <ShiftDetailsDrawer
          shift={selectedShift}
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
        />
      )}
    </div>
  );
}
