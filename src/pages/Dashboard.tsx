import { DashboardSkeleton } from "@/components/PageSkeleton";
import SetupChecklist from "@/components/SetupChecklist";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useUserRole } from "@/hooks/useUserRole";
import { useOrgTimezone } from "@/hooks/useOrgTimezone";
import {
  useCurrentProfile,
  useDashboardStats,
  useRecentCompletions,
  useChronicOverdue,
  useExceptions,
  useDashboardRealtime,
  useUrgentTasks,
} from "@/hooks/useDashboardData";
import TodayHealthCard from "@/components/dashboard/TodayHealthCard";
import ShiftInProgressCard from "@/components/dashboard/ShiftInProgressCard";
import NeedsAttentionSection from "@/components/dashboard/NeedsAttentionSection";
import {
  ListTodo,
  Calendar,
  Users,
  AlertCircle,
  CheckCircle2,
  Clock,
  FileText,
  MapPin
} from "lucide-react";

export default function Dashboard() {
  const navigate = useNavigate();
  const { primaryRole, loading: roleLoading } = useUserRole();
  const { timezone } = useOrgTimezone();

  const { data: auth, isLoading: authLoading, error: authError } = useCurrentProfile();
  const orgId = auth?.profile?.org_id;

  const { data: stats } = useDashboardStats(orgId, timezone);
  const { data: recentCompletions } = useRecentCompletions(orgId);
  const { data: chronicOverdue } = useChronicOverdue(orgId);
  const { data: exceptions } = useExceptions(orgId);
  const { data: urgentTasks } = useUrgentTasks(orgId, timezone);

  useDashboardRealtime(orgId);

  if (authError) {
    navigate("/auth");
    return null;
  }

  if (roleLoading || authLoading) {
    return <DashboardSkeleton />;
  }

  const s = stats ?? {
    completionRate: 0, onTimeRate: 0, overdueTasks: 0,
    completedToday: 0, pendingTasks: 0, totalToday: 0,
    sparkline: [],
  };
  const completions = recentCompletions ?? [];
  const chronic = chronicOverdue ?? [];
  const exc = exceptions ?? [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <main className="container mx-auto px-4 py-8">
        <div className="grid gap-6">
          {orgId && <SetupChecklist orgId={orgId} />}

          {/* Hero Section */}
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

          {/* Main Content Area */}
          <div className="grid md:grid-cols-3 gap-6">
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
                      {completions.map((completion: any) => (
                        <div key={completion.id} className="flex items-start gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                          <CheckCircle2 className="w-5 h-5 text-success mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{completion.task_instances?.task_routines?.title}</p>
                            <p className="text-sm text-muted-foreground">
                              {completion.profiles?.display_name} • {completion.task_instances?.locations?.name}
                            </p>
                            {completion.note && (
                              <p className="text-sm text-muted-foreground italic mt-1">"{completion.note}"</p>
                            )}
                          </div>
                          {completion.photo_url && (
                            <div className="flex-shrink-0">
                              <img src={completion.photo_url} alt="Proof" className="w-12 h-12 object-cover rounded" />
                            </div>
                          )}
                          <span className="text-xs text-muted-foreground flex-shrink-0">
                            {new Date(completion.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-ocean">
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>Common tasks and shortcuts</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button className="w-full justify-start" variant="outline" onClick={() => navigate("/task-instances?filter=overdue")}>
                  <AlertCircle className="w-4 h-4 mr-2 text-destructive" />
                  View Overdue Tasks
                </Button>
                <Button className="w-full justify-start" variant="outline" onClick={() => navigate("/task-instances?filter=skipped")}>
                  <AlertCircle className="w-4 h-4 mr-2 text-warning" />
                  View Skipped Tasks
                </Button>
                <Button className="w-full justify-start" variant="outline" onClick={() => navigate("/task-routines")}>
                  <FileText className="w-4 h-4 mr-2" />
                  Manage Routines
                </Button>
                <Button className="w-full justify-start" variant="outline" onClick={() => navigate("/task-instances")}>
                  <ListTodo className="w-4 h-4 mr-2" />
                  View All Tasks
                </Button>
                <Button className="w-full justify-start" variant="outline" onClick={() => navigate("/shifts")}>
                  <Calendar className="w-4 h-4 mr-2" />
                  Manage Shifts
                </Button>
                {(primaryRole === 'org_admin' || primaryRole === 'location_manager') && (
                  <>
                    <Button className="w-full justify-start" variant="outline" onClick={() => navigate("/locations")}>
                      <MapPin className="w-4 h-4 mr-2" />
                      Locations & Areas
                    </Button>
                    <Button className="w-full justify-start" variant="outline" onClick={() => navigate("/users")}>
                      <Users className="w-4 h-4 mr-2" />
                      Team Members
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Chronic Overdue & Exceptions */}
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="shadow-ocean border-destructive/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-destructive" />
                  Chronic Overdue
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

            <Card className="shadow-ocean border-warning/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-warning" />
                  Recent Exceptions
                </CardTitle>
                <CardDescription>Skipped tasks requiring review</CardDescription>
              </CardHeader>
              <CardContent>
                {exc.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle2 className="w-10 h-10 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">No exceptions to review</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {exc.map((task: any) => (
                      <div key={task.id} className="flex items-start gap-3 p-3 border rounded-lg">
                        <AlertCircle className="w-5 h-5 text-warning mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{task.task_routines?.title}</p>
                          <p className="text-sm text-muted-foreground">{task.locations?.name}</p>
                          {task.completions && task.completions[0]?.note && (
                            <p className="text-sm text-muted-foreground italic mt-1">
                              "{task.completions[0].note}"
                            </p>
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
          </div>
        </div>
      </main>
    </div>
  );
}
