import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useUserRole } from "@/hooks/useUserRole";
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
  FileText
} from "lucide-react";

export default function Dashboard() {
  const navigate = useNavigate();
  const { primaryRole, loading: roleLoading } = useUserRole();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
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

  if (roleLoading || loading || !user || !profile) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl gradient-ocean flex items-center justify-center">
              <LayoutDashboard className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Project Nautilus</h1>
              <p className="text-sm text-muted-foreground">Welcome back, {profile.display_name}</p>
            </div>
          </div>

          <nav className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate("/task-templates")}>
              <FileText className="w-4 h-4 mr-2" />
              Templates
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate("/tasks")}>
              <ListTodo className="w-4 h-4 mr-2" />
              Tasks
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate("/schedules")}>
              <Calendar className="w-4 h-4 mr-2" />
              Schedules
            </Button>
            {(primaryRole === 'org_admin' || primaryRole === 'location_manager') && (
              <Button variant="ghost" size="sm" onClick={() => navigate("/team")}>
                <Users className="w-4 h-4 mr-2" />
                Team
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => navigate("/settings")}>
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </Button>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="w-4 h-4" />
            </Button>
          </nav>
        </div>
      </header>

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
                <Button className="w-full justify-start" variant="outline" onClick={() => navigate("/tasks")}>
                  <ListTodo className="w-4 h-4 mr-2" />
                  View All Tasks
                </Button>
                <Button className="w-full justify-start" variant="outline" onClick={() => navigate("/schedules")}>
                  <Calendar className="w-4 h-4 mr-2" />
                  Manage Schedules
                </Button>
                {(primaryRole === 'org_admin' || primaryRole === 'location_manager') && (
                  <Button className="w-full justify-start" variant="outline" onClick={() => navigate("/team")}>
                    <Users className="w-4 h-4 mr-2" />
                    Team Members
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
