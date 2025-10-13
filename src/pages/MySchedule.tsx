import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, MapPin, ChevronLeft, ChevronRight } from "lucide-react";
import { format, addDays, startOfWeek, isSameDay } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { ShiftDetailsDrawer } from "@/components/schedules/ShiftDetailsDrawer";

export default function MySchedule() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedShift, setSelectedShift] = useState<any>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });

  const { data: myShifts, isLoading } = useQuery({
    queryKey: ["my-schedule", weekStart.toISOString()],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const weekEnd = addDays(weekStart, 7);

      const { data, error } = await supabase
        .from("schedule_assignments")
        .select(`
          *,
          shift:shifts(
            *,
            department:departments(name),
            location:locations(name)
          )
        `)
        .eq("employee_id", user.id)
        .gte("shift.start_at", weekStart.toISOString())
        .lte("shift.start_at", weekEnd.toISOString())
        .order("shift.start_at", { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  const { data: profile } = useQuery({
    queryKey: ["my-profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("profiles")
        .select("*, position:positions(name)")
        .eq("id", user.id)
        .single();

      if (error) throw error;
      return data;
    },
  });

  const navigatePrevious = () => setCurrentDate(addDays(currentDate, -7));
  const navigateNext = () => setCurrentDate(addDays(currentDate, 7));
  const navigateToday = () => setCurrentDate(new Date());

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const totalHours = myShifts?.reduce((acc, assignment) => {
    const shift = assignment.shift;
    const start = new Date(shift.start_at);
    const end = new Date(shift.end_at);
    const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    return acc + hours;
  }, 0) || 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold">My Schedule</h1>
          </div>
          <div className="text-right">
            <div className="text-sm text-muted-foreground">{profile?.display_name}</div>
            {profile?.position && (
              <div className="text-xs text-muted-foreground">{profile.position.name}</div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center gap-4">
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
              {format(weekStart, "MMM d")} - {format(addDays(weekStart, 6), "MMM d, yyyy")}
            </span>
          </div>

          <div className="ml-auto">
            <Badge variant="secondary" className="text-sm">
              {totalHours.toFixed(1)} hours this week
            </Badge>
          </div>
        </div>
      </div>

      {/* Schedule Grid */}
      <div className="p-4">
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading your schedule...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
            {days.map((day) => {
              const isToday = isSameDay(day, new Date());
              const dayShifts = myShifts?.filter((assignment) =>
                isSameDay(new Date(assignment.shift.start_at), day)
              ) || [];

              return (
                <Card
                  key={day.toISOString()}
                  className={isToday ? "border-primary shadow-lg" : ""}
                >
                  <div className="p-3 border-b">
                    <div className={`font-semibold ${isToday ? "text-primary" : ""}`}>
                      {format(day, "EEE")}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {format(day, "MMM d")}
                    </div>
                  </div>

                  <div className="p-3 space-y-2">
                    {dayShifts.length > 0 ? (
                      dayShifts.map((assignment) => {
                        const shift = assignment.shift;
                        const startTime = format(new Date(shift.start_at), "HH:mm");
                        const endTime = format(new Date(shift.end_at), "HH:mm");
                        const duration = (
                          (new Date(shift.end_at).getTime() -
                            new Date(shift.start_at).getTime()) /
                          (1000 * 60 * 60)
                        ).toFixed(1);

                        return (
                          <div
                            key={assignment.id}
                            className="p-2 rounded bg-primary/10 border border-primary/20 cursor-pointer hover:bg-primary/20 transition-colors"
                            onClick={() => {
                              setSelectedShift({
                                ...shift,
                                assignment_id: assignment.id,
                              });
                              setDrawerOpen(true);
                            }}
                          >
                            <div className="flex items-center gap-1 text-xs mb-1">
                              <Clock className="w-3 h-3" />
                              <span className="font-medium">
                                {startTime} - {endTime}
                              </span>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {duration}h · {shift.department?.name}
                            </div>
                            {shift.location && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                                <MapPin className="w-3 h-3" />
                                {shift.location.name}
                              </div>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-center text-sm text-muted-foreground py-4">
                        No shifts
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <ShiftDetailsDrawer
        shift={selectedShift}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
    </div>
  );
}
