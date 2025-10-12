import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TaskInstanceCard } from '@/components/TaskInstanceCard';
import { TaskInstanceListItem } from '@/components/TaskInstanceListItem';
import { TaskInstanceDetails } from '@/components/TaskInstanceDetails';
import { SkipTaskDialog } from '@/components/SkipTaskDialog';
import { CompleteTaskDialog } from '@/components/CompleteTaskDialog';
import { OneOffTaskDialog } from '@/components/OneOffTaskDialog';
import { ArrowLeft, Plus, RefreshCw, LayoutGrid, List } from 'lucide-react';
import { addDays, format } from 'date-fns';
import { toast } from 'sonner';

export default function TaskInstances() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState(() => {
    const filterParam = searchParams.get('filter');
    return filterParam === 'skipped' ? 'skipped' : 'all';
  });
  const [timeRangeFilter, setTimeRangeFilter] = useState(() => {
    const filterParam = searchParams.get('filter');
    return filterParam === 'overdue' ? 'overdue' : 'next_7_days';
  });
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [skipTask, setSkipTask] = useState<any>(null);
  const [skipDialogOpen, setSkipDialogOpen] = useState(false);
  const [completeTask, setCompleteTask] = useState<any>(null);
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [oneOffDialogOpen, setOneOffDialogOpen] = useState(false);
  const [refreshingUrgency, setRefreshingUrgency] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  useEffect(() => {
    if (!roleLoading && !isAdmin()) {
      navigate('/dashboard');
    }
  }, [roleLoading, isAdmin, navigate]);

  useEffect(() => {
    loadTasks();

    const channel = supabase
      .channel('task-instances-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_instances' }, () => {
        loadTasks();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [statusFilter, timeRangeFilter]);

  const loadTasks = async () => {
    setLoading(true);
    
    let query = supabase
      .from('task_instances')
      .select(`
        *,
        task_routines!routine_id(id, title, description, est_minutes, criticality, required_proof, steps),
        locations(id, name),
        departments(name),
        shifts(name),
        completions(id, created_at, note, profiles!user_id(display_name))
      `)
      .limit(500); // Add limit to prevent loading too much data

    // Apply time range filter
    const now = new Date();
    switch (timeRangeFilter) {
      case 'overdue':
        query = query.lt('due_at', now.toISOString()).eq('status', 'pending');
        break;
      case 'today':
        const startOfToday = new Date(now.setHours(0, 0, 0, 0));
        const endOfToday = new Date(now.setHours(23, 59, 59, 999));
        query = query.gte('due_at', startOfToday.toISOString()).lte('due_at', endOfToday.toISOString());
        break;
      case 'next_7_days':
        query = query.gte('due_at', new Date().toISOString()).lte('due_at', addDays(new Date(), 7).toISOString());
        break;
      case 'next_30_days':
        query = query.gte('due_at', new Date().toISOString()).lte('due_at', addDays(new Date(), 30).toISOString());
        break;
      case 'all':
        // No date filter, but still apply limit
        break;
    }

    // Apply status filter (unless overdue is selected, which forces pending)
    if (statusFilter !== 'all' && timeRangeFilter !== 'overdue') {
      query = query.eq('status', statusFilter as 'pending' | 'done' | 'skipped');
    }

    query = query.order('urgency_score', { ascending: false });

    const { data, error } = await query;

    if (error) {
      toast.error(error.message);
    } else {
      setTasks(data || []);
    }
    
    setLoading(false);
  };

  const handleViewDetails = (task: any) => {
    setSelectedTask(task);
    setDetailsOpen(true);
  };

  const handleSkip = (task: any) => {
    setSkipTask(task);
    setSkipDialogOpen(true);
  };

  const handleComplete = (task: any) => {
    setCompleteTask(task);
    setCompleteDialogOpen(true);
  };

  const handleDelete = async (taskId: string) => {
    if (!confirm('Delete this task instance?')) return;

    const { error } = await supabase
      .from('task_instances')
      .delete()
      .eq('id', taskId);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Task deleted');
      loadTasks();
    }
  };

  const handleRefreshUrgency = async () => {
    setRefreshingUrgency(true);
    try {
      const { error } = await supabase.functions.invoke('update-urgency');
      
      if (error) throw error;
      
      toast.success('Urgency scores updated!');
      await loadTasks(); // Reload tasks to show updated scores
    } catch (error: any) {
      toast.error(error.message || 'Failed to update urgency scores');
    } finally {
      setRefreshingUrgency(false);
    }
  };

  if (roleLoading || loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-3xl font-bold">Task Instances</h1>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={handleRefreshUrgency}
              disabled={refreshingUrgency}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshingUrgency ? 'animate-spin' : ''}`} />
              Refresh Urgency
            </Button>
            <Button onClick={() => setOneOffDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create One-off Task
            </Button>
          </div>
        </div>

        <div className="mb-6 flex gap-4 items-center justify-between">
          <div className="flex gap-4">
            <Select value={timeRangeFilter} onValueChange={setTimeRangeFilter}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="overdue">Overdue</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="next_7_days">Next 7 Days</SelectItem>
                <SelectItem value="next_30_days">Next 30 Days</SelectItem>
                <SelectItem value="all">All Tasks</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="done">Done</SelectItem>
                <SelectItem value="skipped">Skipped</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('grid')}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>
              {timeRangeFilter === 'overdue' && 'Overdue Tasks'}
              {timeRangeFilter === 'today' && 'Tasks Due Today'}
              {timeRangeFilter === 'next_7_days' && 'Upcoming Tasks (Next 7 Days)'}
              {timeRangeFilter === 'next_30_days' && 'Upcoming Tasks (Next 30 Days)'}
              {timeRangeFilter === 'all' && 'All Task Instances'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {tasks.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No task instances found. Create schedules to generate tasks automatically.
              </p>
            ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {tasks.map(task => (
                  <TaskInstanceCard
                    key={task.id}
                    task={task}
                    onViewDetails={() => handleViewDetails(task)}
                    onSkip={() => handleSkip(task)}
                    onComplete={() => handleComplete(task)}
                    onDelete={isAdmin() ? () => handleDelete(task.id) : undefined}
                    isAdmin={isAdmin()}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {tasks.map(task => (
                  <TaskInstanceListItem
                    key={task.id}
                    task={task}
                    onViewDetails={() => handleViewDetails(task)}
                    onSkip={() => handleSkip(task)}
                    onComplete={() => handleComplete(task)}
                    onDelete={isAdmin() ? () => handleDelete(task.id) : undefined}
                    isAdmin={isAdmin()}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <TaskInstanceDetails
          task={selectedTask}
          open={detailsOpen}
          onClose={() => setDetailsOpen(false)}
        />

        <SkipTaskDialog
          taskId={skipTask?.id}
          taskTemplate={skipTask?.task_routines}
          open={skipDialogOpen}
          onClose={() => {
            setSkipDialogOpen(false);
            setSkipTask(null);
          }}
          onSuccess={loadTasks}
        />

        <CompleteTaskDialog
          taskId={completeTask?.id}
          taskTemplate={completeTask?.task_routines}
          open={completeDialogOpen}
          onClose={() => {
            setCompleteDialogOpen(false);
            setCompleteTask(null);
          }}
          onSuccess={loadTasks}
        />

        <OneOffTaskDialog
          open={oneOffDialogOpen}
          onClose={() => setOneOffDialogOpen(false)}
          onSuccess={loadTasks}
        />
      </div>
    </div>
  );
}
