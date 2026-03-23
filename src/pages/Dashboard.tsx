import { DashboardSkeleton } from "@/components/PageSkeleton";
import SetupChecklist from "@/components/SetupChecklist";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useUserRole } from "@/hooks/useUserRole";
import {
  useCurrentProfile,
  useDashboardStats,
  useRecentCompletions,
  useChronicOverdue,
  useExceptions,
  useDashboardRealtime,
} from "@/hooks/useDashboardData";
import {
  ListTodo,
  Calendar,
  Users,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Clock,
  FileText,
  MapPin
} from "lucide-react";

export default function Dashboard() {
  const navigate = useNavigate();
  const { primaryRole, loading: roleLoading } = useUserRole();

  // Profile fetch via React Query — no waterfall
  const { data: auth, isLoading: authLoading, error: authError } = useCurrentProfile();
  const orgId = auth?.profile?.org_id;

  // All dashboard queries fire in parallel as soon as orgId is available
  const { data: stats } = useDashboardStats(orgId);
  const { data: recentCompletions } = useRecentCompletions(orgId);
  const { data: chronicOverdue } = useChronicOverdue(orgId);
  const { data: exceptions } = useExceptions(orgId);

  // Debounced, org-scoped realtime invalidation
  useDashboardRealtime(orgId);

  // Redirect if not authenticated
  if (authError) {
    navigate("/auth");
    return null;
  }

  if (roleLoading || authLoading) {
    return <DashboardSkeleton />;
  }

  const s = stats ?? { onTimeRate: 0, overdueTasks: 0, completedToday: 0, pendingTasks: 0 };
  const completions = recentCompletions ?? [];
  const chronic = chronicOverdue ?? [];
  const exc = exceptions ?? [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <main className="container mx-auto px-4 py-8">
        <div className="grid gap-6">
          {orgId && <SetupChecklist orgId={orgId} />}

          {/* Stats Overview */}
          <div className="grid md:grid-cols-4 gap-4">
            <Card className="shadow-md hover:shadow-ocean transition-smooth">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">On-Time Rate</CardTitle>
                <TrendingUp className="w-4 h-4 text-success" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-success">{s.onTimeRate}%</div>
                <p className="text-xs text-muted-foreground mt-1">Last 7 days</p>
              </CardContent>
            </Card>

            <Card className="shadow-md hover:shadow-ocean transition-smooth">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Overdue Tasks</CardTitle>
                <AlertCircle className="w-4 h-4 text-destructive" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-destructive">{s.overdueTasks}</div>
                <p className="text-xs text-muted-foreground mt-1">Requires attention</p>
              </CardContent>
            </Card>

            <Card className="shadow-md hover:shadow-ocean transition-smooth">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Completed Today</CardTitle>
                <CheckCircle2 className="w-4 h-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{s.completedToday}</div>
                <p className="text-xs text-muted-foreground mt-1">Great progress!</p>
              </CardContent>
            </Card>

            <Card className="shadow-md hover:shadow-ocean transition-smooth">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Pending Tasks</CardTitle>
                <Clock className="w-4 h-4 text-warning" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-warning">{s.pendingTasks}</div>
                <p className="text-xs text-muted-foreground mt-1">Next 24 hours</p>
              </CardContent>
            </Card>
          </div>

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
