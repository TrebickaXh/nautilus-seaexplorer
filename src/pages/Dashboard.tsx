import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  RefreshCw,
  Zap,
  Database,
  MapPin
} from "lucide-react";

export default function Dashboard() {
  const navigate = useNavigate();
  const { primaryRole, loading: roleLoading, isAdmin } = useUserRole();
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [testingLoading, setTestingLoading] = useState<string | null>(null);
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

      // Get tasks for last 7 days (for on-time rate)
      const { data: recentTasks } = await supabase
        .from('task_instances')
        .select('*, task_routines(title), locations(name)')
        .gte('due_at', sevenDaysAgo.toISOString());

      // Get today's tasks
      const { data: todayTasks } = await supabase
        .from('task_instances')
        .select('status, completed_at, due_at')
        .gte('due_at', today.toISOString())
        .lt('due_at', tomorrow.toISOString());

      // Recent completions with details
      const { data: completionsData } = await supabase
        .from('completions')
        .select(`
          *,
          task_instances(*, task_routines(title), locations(name)),
          profiles(display_name)
        `)
        .order('created_at', { ascending: false })
        .limit(10);

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
      const { data: chronicData } = await supabase
        .from('task_instances')
        .select('template_id, task_routines(title, criticality), status, completed_at, due_at')
        .in('status', ['done', 'skipped'])
        .gte('due_at', sevenDaysAgo.toISOString());

      const templateOverdueMap = new Map<string, { title: string; criticality: number; late: number; total: number }>();
      chronicData?.forEach(task => {
        const templateId = task.template_id;
        const title = task.task_routines?.title || 'Unknown';
        const criticality = task.task_routines?.criticality || 3;
        
        if (!templateOverdueMap.has(templateId)) {
          templateOverdueMap.set(templateId, { title, criticality, late: 0, total: 0 });
        }
        
        const entry = templateOverdueMap.get(templateId)!;
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

      // Exceptions: skipped tasks
      const { data: skippedData } = await supabase
        .from('task_instances')
        .select('*, task_routines(title), locations(name), completions(note, created_at)')
        .eq('status', 'skipped')
        .gte('due_at', sevenDaysAgo.toISOString())
        .order('completed_at', { ascending: false })
        .limit(10);

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

  const handleMaterializeTasks = async () => {
    setTestingLoading('materialize');
    try {
      const { data, error } = await supabase.functions.invoke('materialize-tasks');
      if (error) throw error;
      
      toast({
        title: "Tasks Materialized",
        description: `Created ${data?.tasksCreated || 0} task instances from ${data?.schedulesProcessed || 0} schedules.`,
      });
      
      // Reload dashboard data to show new tasks
      loadDashboardData();
    } catch (error: any) {
      console.error('Materialize error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to materialize tasks",
        variant: "destructive",
      });
    } finally {
      setTestingLoading(null);
    }
  };

  const handleUpdateUrgency = async () => {
    setTestingLoading('urgency');
    try {
      const { data, error } = await supabase.functions.invoke('update-urgency');
      if (error) throw error;
      
      toast({
        title: "Urgency Updated",
        description: "All task urgency scores have been recalculated.",
      });
      
      // Reload dashboard data
      loadDashboardData();
    } catch (error: any) {
      console.error('Update urgency error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update urgency scores",
        variant: "destructive",
      });
    } finally {
      setTestingLoading(null);
    }
  };

  const handleCreateTestData = async () => {
    setTestingLoading('testdata');
    try {
      // Get current user's org_id
      if (!profile?.org_id) {
        throw new Error("No organization found");
      }

      // Create a test location
      const { data: location, error: locationError } = await supabase
        .from('locations')
        .insert({ name: 'Test Location', org_id: profile.org_id })
        .select()
        .single();

      if (locationError) throw locationError;

      // Create a department for the test location
      const { data: testDepartment, error: testDeptError } = await supabase
        .from('departments')
        .insert({ 
          name: 'Test Department', 
          location_id: location.id,
          description: 'Test department for location'
        })
        .select()
        .single();

      if (testDeptError) throw testDeptError;

      // Create test templates
      const templates = [
        {
          title: 'Clean Restrooms',
          description: 'Deep clean all restroom facilities',
          est_minutes: 15,
          criticality: 5,
          required_proof: 'photo' as const,
          org_id: profile.org_id,
          department_id: testDepartment.id,
        },
        {
          title: 'Check Fire Extinguishers',
          description: 'Verify all fire extinguishers are accessible and charged',
          est_minutes: 10,
          criticality: 4,
          required_proof: 'note' as const,
          org_id: profile.org_id,
          department_id: testDepartment.id,
        },
        {
          title: 'Restock Supplies',
          description: 'Check and restock all supply stations',
          est_minutes: 20,
          criticality: 2,
          required_proof: 'none' as const,
          org_id: profile.org_id,
          department_id: testDepartment.id,
        },
      ];

      const { data: createdTemplates, error: templateError } = await supabase
        .from('task_routines')
        .insert(templates)
        .select();

      if (templateError) throw templateError;

      // Create test schedules
      if (createdTemplates && createdTemplates.length > 0) {
        const schedules = [
          {
            template_id: createdTemplates[0].id,
            type: 'window' as const,
            days_of_week: [1, 2, 3, 4, 5], // Mon-Fri
            window_start: '08:00:00',
            window_end: '10:00:00',
            assignee_role: 'crew' as const,
            shift_name: 'Morning Shift',
          },
          {
            template_id: createdTemplates[1].id,
            type: 'window' as const,
            days_of_week: [1, 2, 3, 4, 5],
            window_start: '14:00:00',
            window_end: '16:00:00',
            assignee_role: 'crew' as const,
            shift_name: 'Afternoon Shift',
          },
        ];

        const { error: scheduleError } = await supabase
          .from('schedules')
          .insert(schedules);

        if (scheduleError) throw scheduleError;
      }

      toast({
        title: "Test Data Created",
        description: `Created 1 location, ${createdTemplates?.length || 0} templates, and 2 schedules.`,
      });

      // Now materialize tasks
      await handleMaterializeTasks();
    } catch (error: any) {
      console.error('Create test data error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create test data",
        variant: "destructive",
      });
    } finally {
      setTestingLoading(null);
    }
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
                )}
              </CardContent>
            </Card>

            <Card className="shadow-ocean">
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>Common tasks and shortcuts</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button className="w-full justify-start" variant="outline" onClick={() => navigate("/task-templates")}>
                  <FileText className="w-4 h-4 mr-2" />
                  Manage Templates
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

          {/* Testing Tools - Admin Only */}
          {isAdmin() && (
            <Card className="shadow-ocean border-warning/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-warning" />
                  Testing Tools
                </CardTitle>
                <CardDescription>Manual triggers for background jobs and test data creation</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button 
                  className="w-full justify-start" 
                  variant="outline"
                  onClick={handleCreateTestData}
                  disabled={testingLoading === 'testdata'}
                >
                  <Database className="w-4 h-4 mr-2" />
                  {testingLoading === 'testdata' ? 'Creating...' : 'Create Test Data'}
                </Button>
                <Button 
                  className="w-full justify-start" 
                  variant="outline"
                  onClick={handleMaterializeTasks}
                  disabled={testingLoading === 'materialize'}
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${testingLoading === 'materialize' ? 'animate-spin' : ''}`} />
                  {testingLoading === 'materialize' ? 'Materializing...' : 'Force Materialize Tasks'}
                </Button>
                <Button 
                  className="w-full justify-start" 
                  variant="outline"
                  onClick={handleUpdateUrgency}
                  disabled={testingLoading === 'urgency'}
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${testingLoading === 'urgency' ? 'animate-spin' : ''}`} />
                  {testingLoading === 'urgency' ? 'Updating...' : 'Force Update Urgency'}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
