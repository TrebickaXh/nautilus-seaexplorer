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

      const { data: tasks } = await supabase
        .from('task_instances')
        .select('status, completed_at, due_at')
        .gte('created_at', today.toISOString())
        .lt('created_at', tomorrow.toISOString());

      const completed = tasks?.filter(t => t.status === 'done') || [];
      const pending = tasks?.filter(t => t.status === 'pending') || [];
      const overdue = pending.filter(t => new Date(t.due_at) < new Date());
      const onTime = completed.filter(t => 
        new Date(t.completed_at!) <= new Date(t.due_at)
      );

      const onTimeRate = completed.length > 0 
        ? Math.round((onTime.length / completed.length) * 100)
        : 0;

      setStats({
        onTimeRate,
        overdueTasks: overdue.length,
        completedToday: completed.length,
        pendingTasks: pending.length,
      });

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

      // Create test templates
      const templates = [
        {
          title: 'Clean Restrooms',
          description: 'Deep clean all restroom facilities',
          est_minutes: 15,
          criticality: 5,
          required_proof: 'photo' as const,
          org_id: profile.org_id,
        },
        {
          title: 'Check Fire Extinguishers',
          description: 'Verify all fire extinguishers are accessible and charged',
          est_minutes: 10,
          criticality: 4,
          required_proof: 'note' as const,
          org_id: profile.org_id,
        },
        {
          title: 'Restock Supplies',
          description: 'Check and restock all supply stations',
          est_minutes: 20,
          criticality: 2,
          required_proof: 'none' as const,
          org_id: profile.org_id,
        },
      ];

      const { data: createdTemplates, error: templateError } = await supabase
        .from('task_templates')
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
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Latest task completions and updates</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 text-muted-foreground">
                  <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No recent activity yet</p>
                  <p className="text-sm">Activity will appear here once tasks are completed</p>
                </div>
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
