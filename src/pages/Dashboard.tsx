import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useUserRole } from "@/hooks/useUserRole";
import { useToast } from "@/hooks/use-toast";
import { 
  LayoutDashboard, 
  ListTodo, 
  Calendar, 
  Users, 
  Settings,
  LogOut,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Clock,
  FileText,
  MapPin
} from "lucide-react";

export default function Dashboard() {
  const navigate = useNavigate();
  const { primaryRole, loading: roleLoading, isAdmin } = useUserRole();
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    onTimeRate: 0,
    overdueTasks: 0,
    completedToday: 0,
    pendingTasks: 0
  });
  const [chronicOverdue, setChronicOverdue] = useState<any[]>([]);
  const [exceptions, setExceptions] = useState<any[]>([]);
  const [recentCompletions, setRecentCompletions] = useState<any[]>([]);

  useEffect(() => {
    checkUser();
  }, []);

  useEffect(() => {
    if (user && profile) {
      loadDashboardData();
    }
  }, [user, profile]);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
      return;
    }
    setUser(user);
    
    // Load profile
    const { data: profileData } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();
    
    setProfile(profileData);
  };

  const loadDashboardData = async () => {
    try {
      if (!profile?.org_id) return;

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      // Execute all queries in parallel for better performance
      const [
        recentTasksResult,
        todayTasksResult,
        completionsResult,
        chronicDataResult,
        skippedDataResult
      ] = await Promise.all([
        // Get tasks for last 7 days (for on-time rate)
        supabase
          .from('task_instances')
          .select('*, task_routines!routine_id(title), locations(name)')
          .gte('due_at', sevenDaysAgo.toISOString())
          .limit(1000),

        // Get today's tasks
        supabase
          .from('task_instances')
          .select('status, completed_at, due_at')
          .gte('due_at', today.toISOString())
          .lt('due_at', tomorrow.toISOString())
          .limit(500),

        // Recent completions with details
        supabase
          .from('completions')
          .select(`
            *,
            task_instances(*, task_routines!routine_id(title), locations(name)),
            profiles!user_id(display_name)
          `)
          .order('created_at', { ascending: false })
          .limit(10),

        // Chronic overdue data
        supabase
          .from('task_instances')
          .select('routine_id, task_routines!routine_id(title, criticality), status, completed_at, due_at')
          .in('status', ['done', 'skipped'])
          .gte('due_at', sevenDaysAgo.toISOString())
          .limit(500),

        // Exceptions: skipped tasks
        supabase
          .from('task_instances')
          .select('*, task_routines!routine_id(title), locations(name), completions(note, created_at)')
          .eq('status', 'skipped')
          .gte('due_at', sevenDaysAgo.toISOString())
          .order('completed_at', { ascending: false })
          .limit(10)
      ]);

      const recentTasks = recentTasksResult.data;
      const todayTasks = todayTasksResult.data;
      const completionsData = completionsResult.data;
      const chronicData = chronicDataResult.data;
      const skippedData = skippedDataResult.data;

      setRecentCompletions(completionsData || []);

      // Calculate metrics
      const allCompleted = recentTasks?.filter(t => t.status === 'done') || [];
      const onTime = allCompleted.filter(t => 
        t.completed_at && new Date(t.completed_at) <= new Date(t.due_at)
      );
      const onTimeRate = allCompleted.length > 0 
        ? Math.round((onTime.length / allCompleted.length) * 100)
        : 0;

      const todayCompleted = todayTasks?.filter(t => t.status === 'done') || [];
      const todayPending = todayTasks?.filter(t => t.status === 'pending') || [];
      const overdue = todayPending.filter(t => new Date(t.due_at) < new Date());

      setStats({
        onTimeRate,
        overdueTasks: overdue.length,
        completedToday: todayCompleted.length,
        pendingTasks: todayPending.length,
      });

      // Chronic overdue: tasks that are frequently late
      const templateOverdueMap = new Map<string, { title: string; criticality: number; late: number; total: number }>();
      chronicData?.forEach(task => {
        const routineId = task.routine_id;
        const title = task.task_routines?.title || 'Unknown';
        const criticality = task.task_routines?.criticality || 3;
        
        if (!templateOverdueMap.has(routineId)) {
          templateOverdueMap.set(routineId, { title, criticality, late: 0, total: 0 });
        }
        
        const entry = templateOverdueMap.get(routineId)!;
        entry.total++;
        
        if (task.status === 'done' && task.completed_at && new Date(task.completed_at) > new Date(task.due_at)) {
          entry.late++;
        } else if (task.status === 'skipped') {
          entry.late++;
        }
      });

      const chronicList = Array.from(templateOverdueMap.entries())
        .map(([id, data]) => ({
          id,
          title: data.title,
          criticality: data.criticality,
          lateCount: data.late,
          totalCount: data.total,
          score: data.late * data.criticality
        }))
        .filter(item => item.lateCount > 2) // At least 3 late instances
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);

      setChronicOverdue(chronicList);
      setExceptions(skippedData || []);

      const channel = supabase
        .channel('task-updates')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'task_instances'
        }, () => {
          loadDashboardData();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  if (roleLoading || loading || !user || !profile) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <main className="container mx-auto px-4 py-8">
        <div className="grid gap-6">
          {/* Stats Overview */}
          <div className="grid md:grid-cols-4 gap-4">
            <Card className="shadow-md hover:shadow-ocean transition-smooth">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  On-Time Rate
                </CardTitle>
                <TrendingUp className="w-4 h-4 text-success" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-success">{stats.onTimeRate}%</div>
                <p className="text-xs text-muted-foreground mt-1">Last 7 days</p>
              </CardContent>
            </Card>

            <Card className="shadow-md hover:shadow-ocean transition-smooth">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Overdue Tasks
                </CardTitle>
                <AlertCircle className="w-4 h-4 text-destructive" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-destructive">{stats.overdueTasks}</div>
                <p className="text-xs text-muted-foreground mt-1">Requires attention</p>
              </CardContent>
            </Card>

            <Card className="shadow-md hover:shadow-ocean transition-smooth">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Completed Today
                </CardTitle>
                <CheckCircle2 className="w-4 h-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats.completedToday}</div>
                <p className="text-xs text-muted-foreground mt-1">Great progress!</p>
              </CardContent>
            </Card>

            <Card className="shadow-md hover:shadow-ocean transition-smooth">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Pending Tasks
                </CardTitle>
                <Clock className="w-4 h-4 text-warning" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-warning">{stats.pendingTasks}</div>
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
                {recentCompletions.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No completions yet</p>
                    <p className="text-sm">Completed tasks will appear here</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[400px] pr-4">
                    <div className="space-y-3">
                      {recentCompletions.map((completion) => (
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
                <Button className="w-full justify-start" variant="outline" onClick={() => navigate("/task-routines")}>
                  <FileText className="w-4 h-4 mr-2" />
                  Manage Routines
                </Button>
                <Button className="w-full justify-start" variant="outline" onClick={() => navigate("/task-instances")}>
                  <ListTodo className="w-4 h-4 mr-2" />
                  View All Tasks
                </Button>
                <Button className="w-full justify-start" variant="outline" onClick={() => navigate("/schedules")}>
                  <Calendar className="w-4 h-4 mr-2" />
                  Manage Schedules
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
                {chronicOverdue.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle2 className="w-10 h-10 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">No chronic issues detected</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {chronicOverdue.map((item) => (
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
                {exceptions.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle2 className="w-10 h-10 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">No exceptions to review</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {exceptions.map((task) => (
                      <div key={task.id} className="flex items-start gap-3 p-3 border rounded-lg">
                        <AlertCircle className="w-5 h-5 text-warning mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{task.task_templates?.title}</p>
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
