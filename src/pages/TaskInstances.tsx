import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TaskInstanceCard } from '@/components/TaskInstanceCard';
import { TaskInstanceDetails } from '@/components/TaskInstanceDetails';
import { SkipTaskDialog } from '@/components/SkipTaskDialog';
import { ArrowLeft, Plus } from 'lucide-react';
import { addDays, format } from 'date-fns';
import { toast } from 'sonner';

export default function TaskInstances() {
  const navigate = useNavigate();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [skipDialogOpen, setSkipDialogOpen] = useState(false);
  const [skipTaskId, setSkipTaskId] = useState<string | null>(null);

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
  }, [statusFilter]);

  const loadTasks = async () => {
    setLoading(true);
    
    const startDate = new Date();
    const endDate = addDays(startDate, 7);

    let query = supabase
      .from('task_instances')
      .select(`
        *,
        task_templates(id, title, description, est_minutes, criticality, required_proof, steps),
        locations(id, name),
        areas(id, name),
        completions(id, created_at, note, profiles(display_name))
      `)
      .gte('due_at', startDate.toISOString())
      .lte('due_at', endDate.toISOString())
      .order('urgency_score', { ascending: false });

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter as 'pending' | 'done' | 'skipped');
    }

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

  const handleSkip = (taskId: string) => {
    setSkipTaskId(taskId);
    setSkipDialogOpen(true);
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
          <Button onClick={() => toast.info('One-off task creation coming soon')}>
            <Plus className="h-4 w-4 mr-2" />
            Create One-off Task
          </Button>
        </div>

        <div className="mb-6 flex gap-4">
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

        <Card>
          <CardHeader>
            <CardTitle>Upcoming Tasks (Next 7 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            {tasks.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No task instances found. Create schedules to generate tasks automatically.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {tasks.map(task => (
                  <TaskInstanceCard
                    key={task.id}
                    task={task}
                    onViewDetails={() => handleViewDetails(task)}
                    onSkip={() => handleSkip(task.id)}
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
          taskId={skipTaskId}
          open={skipDialogOpen}
          onClose={() => setSkipDialogOpen(false)}
          onSuccess={loadTasks}
        />
      </div>
    </div>
  );
}
