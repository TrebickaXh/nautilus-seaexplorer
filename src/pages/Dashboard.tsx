import { useState, useEffect } from "react";
import { DashboardSkeleton } from "@/components/PageSkeleton";
import SetupChecklist from "@/components/SetupChecklist";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useUserRole } from "@/hooks/useUserRole";
import { useOrgTimezone } from "@/hooks/useOrgTimezone";
import { useLocations } from "@/hooks/useReportData";
import {
  useCurrentProfile,
  useDashboardStatsFiltered,
  useRecentCompletions,
  useChronicOverdue,
  useExceptions,
  useDashboardRealtime,
  useUrgentTasks,
  useCrewTodayTasks,
  useCrewStreak,
  useYesterdayHandoff,
} from "@/hooks/useDashboardData";
import TodayHealthCard from "@/components/dashboard/TodayHealthCard";
import ShiftInProgressCard from "@/components/dashboard/ShiftInProgressCard";
import NeedsAttentionSection from "@/components/dashboard/NeedsAttentionSection";
import CrewDashboard from "@/components/dashboard/CrewDashboard";
import YesterdayHandoffCard from "@/components/dashboard/YesterdayHandoffCard";
import LocationFilter from "@/components/dashboard/LocationFilter";
import MorningBriefing from "@/components/dashboard/MorningBriefing";
import {
  ListTodo,
  Calendar,
  Users,
  AlertCircle,
  CheckCircle2,
  Clock,
  FileText,
  MapPin,
  Rocket,
} from "lucide-react";

// ── Shared sections ─────────────────────────────────────────────

function RecentCompletionsCard({ completions }: { completions: any[] }) {
  return (
    <Card className="md:col-span-2 shadow-ocean">
      <CardHeader>
        <CardTitle>Recent Completions</CardTitle>
        <CardDescription>Latest task completions with proof</CardDescription>
      </CardHeader>
      <CardContent>
        {completions.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No completions yet</p>
            <p className="text-sm">Completed tasks will appear here</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-3">
              {completions.map((c: any) => (
                <div key={c.id} className="flex items-start gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                  <CheckCircle2 className="w-5 h-5 text-success mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{c.task_instances?.task_routines?.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {c.profiles?.display_name} • {c.task_instances?.locations?.name}
                    </p>
                    {c.note && <p className="text-sm text-muted-foreground italic mt-1">"{c.note}"</p>}
                  </div>
                  {c.photo_url && (
                    <img src={c.photo_url} alt="Proof" className="w-12 h-12 object-cover rounded flex-shrink-0" />
                  )}
                  <span className="text-xs text-muted-foreground flex-shrink-0">
                    {new Date(c.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

function QuickActionsCard({ primaryRole }: { primaryRole: string | null }) {
  const navigate = useNavigate();
  return (
    <Card className="shadow-ocean">
      <CardHeader>
        <CardTitle>Quick Actions</CardTitle>
        <CardDescription>Common tasks and shortcuts</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <Button className="w-full justify-start" variant="outline" onClick={() => navigate("/task-instances?filter=overdue")}>
          <AlertCircle className="w-4 h-4 mr-2 text-destructive" /> View Overdue Tasks
        </Button>
        <Button className="w-full justify-start" variant="outline" onClick={() => navigate("/task-instances?filter=skipped")}>
          <AlertCircle className="w-4 h-4 mr-2 text-warning" /> View Skipped Tasks
        </Button>
        <Button className="w-full justify-start" variant="outline" onClick={() => navigate("/task-routines")}>
          <FileText className="w-4 h-4 mr-2" /> Manage Routines
        </Button>
        <Button className="w-full justify-start" variant="outline" onClick={() => navigate("/task-instances")}>
          <ListTodo className="w-4 h-4 mr-2" /> View All Tasks
        </Button>
        <Button className="w-full justify-start" variant="outline" onClick={() => navigate("/shifts")}>
          <Calendar className="w-4 h-4 mr-2" /> Manage Shifts
        </Button>
        {(primaryRole === "org_admin" || primaryRole === "location_manager") && (
          <>
            <Button className="w-full justify-start" variant="outline" onClick={() => navigate("/locations")}>
              <MapPin className="w-4 h-4 mr-2" /> Locations & Areas
            </Button>
            <Button className="w-full justify-start" variant="outline" onClick={() => navigate("/users")}>
              <Users className="w-4 h-4 mr-2" /> Team Members
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function ChronicOverdueCard({ chronic }: { chronic: any[] }) {
  return (
    <Card className="shadow-ocean border-destructive/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-destructive" /> Chronic Overdue
        </CardTitle>
        <CardDescription>Tasks frequently completed late (last 7 days)</CardDescription>
      </CardHeader>
      <CardContent>
        {chronic.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <CheckCircle2 className="w-10 h-10 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No chronic issues detected</p>
          </div>
        ) : (
          <div className="space-y-3">
            {chronic.map((item: any) => (
              <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{item.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {item.lateCount} of {item.totalCount} late • Priority {item.criticality}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-destructive">{Math.round((item.lateCount / item.totalCount) * 100)}%</div>
                  <div className="text-xs text-muted-foreground">late rate</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ExceptionsCard({ exceptions }: { exceptions: any[] }) {
  return (
    <Card className="shadow-ocean border-warning/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-warning" /> Recent Exceptions
        </CardTitle>
        <CardDescription>Skipped tasks requiring review</CardDescription>
      </CardHeader>
      <CardContent>
        {exceptions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <CheckCircle2 className="w-10 h-10 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No exceptions to review</p>
          </div>
        ) : (
          <div className="space-y-3">
            {exceptions.map((task: any) => (
              <div key={task.id} className="flex items-start gap-3 p-3 border rounded-lg">
                <AlertCircle className="w-5 h-5 text-warning mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{task.task_routines?.title}</p>
                  <p className="text-sm text-muted-foreground">{task.locations?.name}</p>
                  {task.completions?.[0]?.note && (
                    <p className="text-sm text-muted-foreground italic mt-1">"{task.completions[0].note}"</p>
                  )}
                </div>
                <span className="text-xs text-muted-foreground flex-shrink-0">
                  {task.completed_at && new Date(task.completed_at).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main Dashboard ──────────────────────────────────────────────

export default function Dashboard() {
  const navigate = useNavigate();
  const { primaryRole, loading: roleLoading } = useUserRole();
  const { timezone } = useOrgTimezone();
  const [locationFilter, setLocationFilter] = useState("all");

  const { data: auth, isLoading: authLoading, error: authError } = useCurrentProfile();
  const orgId = auth?.profile?.org_id;
  const userId = auth?.user?.id;
  const hasPinSet = !!auth?.profile?.pin_hash;

  // Locations for org_admin filter
  const { data: locations } = useLocations();

  // Determine effective location filter
  const effectiveLocationId = locationFilter !== "all" ? locationFilter : undefined;

  // Admin/Manager data
  const { data: stats } = useDashboardStatsFiltered(
    primaryRole !== "crew" ? orgId : undefined,
    timezone,
    effectiveLocationId
  );
  const { data: recentCompletions } = useRecentCompletions(primaryRole !== "crew" ? orgId : undefined);
  const { data: chronicOverdue } = useChronicOverdue(primaryRole === "org_admin" ? orgId : undefined);
  const { data: exceptions } = useExceptions(primaryRole !== "crew" ? orgId : undefined);
  const { data: urgentTasks } = useUrgentTasks(primaryRole !== "crew" ? orgId : undefined, timezone);

  // Yesterday handoff — used by manager view AND morning briefing
  const { data: handoff } = useYesterdayHandoff(
    primaryRole !== "crew" ? orgId : undefined,
    timezone,
    effectiveLocationId
  );

  // Crew-specific data
  const { data: crewTasks } = useCrewTodayTasks(primaryRole === "crew" ? orgId : undefined, userId, timezone);
  const { data: crewStreak } = useCrewStreak(primaryRole === "crew" ? orgId : undefined, userId, timezone);

  useDashboardRealtime(orgId);

  useEffect(() => {
    if (authError) navigate("/auth");
  }, [authError, navigate]);

  if (authError || roleLoading || authLoading) {
    return <DashboardSkeleton />;
  }

  // ── CREW VIEW ──
  if (primaryRole === "crew") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
        <main className="container mx-auto px-4 py-8">
          <CrewDashboard
            tasks={crewTasks ?? []}
            streak={crewStreak ?? 0}
            hasPinSet={hasPinSet}
            orgId={orgId!}
            timezone={timezone}
          />
        </main>
      </div>
    );
  }

  // ── ADMIN / MANAGER VIEW ──
  const s = stats ?? {
    completionRate: 0, onTimeRate: 0, overdueTasks: 0,
    completedToday: 0, pendingTasks: 0, totalToday: 0, sparkline: [],
  };

  const isEmptyOrg = s.totalToday === 0 && (recentCompletions ?? []).length === 0;

  // Briefing data assembled from hooks
  const briefingData = {
    yesterdayRate: handoff?.completionRate ?? 0,
    skippedTasks: handoff?.skippedTasks ?? [],
    chronicLate: (chronicOverdue ?? []).map((c: any) => ({ title: c.title, lateCount: c.lateCount })),
    pendingCount: s.pendingTasks,
    activeShifts: 0,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <main className="container mx-auto px-4 py-8">
        <div className="grid gap-6">
          {/* Location Filter — org_admin only */}
          {primaryRole === "org_admin" && locations && (
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-semibold">Dashboard</h1>
              <LocationFilter
                locations={locations}
                value={locationFilter}
                onChange={setLocationFilter}
              />
            </div>
          )}

          {/* Morning Briefing — admin/manager only */}
          {!isEmptyOrg && <MorningBriefing briefingData={briefingData} />}

          {orgId && <SetupChecklist orgId={orgId} />}

          {/* Hero Section */}
          {isEmptyOrg ? (
            /* Empty state for brand-new orgs */
            <div className="grid md:grid-cols-3 gap-6">
              <div className="md:col-span-2">
                <Card className="shadow-ocean">
                  <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                    <Rocket className="w-12 h-12 text-primary mb-4" />
                    <h2 className="text-xl font-semibold mb-2">No activity yet</h2>
                    <p className="text-muted-foreground mb-6 max-w-sm">
                      Complete your first task on the kiosk to see your stats here
                    </p>
                    <Button onClick={() => navigate("/kiosk")}>
                      Open Kiosk →
                    </Button>
                  </CardContent>
                </Card>
              </div>
              <div>
                {orgId && <ShiftInProgressCard orgId={orgId} timezone={timezone} />}
              </div>
            </div>
          ) : (
            <>
              <div className="grid md:grid-cols-3 gap-6">
                <div className="md:col-span-2">
                  <TodayHealthCard
                    completionRate={s.completionRate}
                    completedToday={s.completedToday}
                    pendingTasks={s.pendingTasks}
                    overdueTasks={s.overdueTasks}
                    sparkline={s.sparkline}
                  />
                </div>
                <div>
                  {orgId && <ShiftInProgressCard orgId={orgId} timezone={timezone} />}
                </div>
              </div>

              {/* Needs Attention */}
              {orgId && <NeedsAttentionSection tasks={urgentTasks ?? []} orgId={orgId} />}
            </>
          )}

          {/* Main Content — hide if empty org */}
          {!isEmptyOrg && (
            <div className="grid md:grid-cols-3 gap-6">
              <RecentCompletionsCard completions={recentCompletions ?? []} />
              <QuickActionsCard primaryRole={primaryRole} />
            </div>
          )}

          {/* Bottom Row — role-specific */}
          {primaryRole === "org_admin" && !isEmptyOrg && (
            <div className="grid md:grid-cols-2 gap-6">
              <ChronicOverdueCard chronic={chronicOverdue ?? []} />
              <ExceptionsCard exceptions={exceptions ?? []} />
            </div>
          )}

          {primaryRole === "location_manager" && !isEmptyOrg && (
            <div className="grid md:grid-cols-2 gap-6">
              <YesterdayHandoffCard data={handoff} />
              <ExceptionsCard exceptions={exceptions ?? []} />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
