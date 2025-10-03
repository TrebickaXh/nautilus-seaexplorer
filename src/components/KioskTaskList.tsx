import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { CompleteTaskDialog } from './CompleteTaskDialog';
import { TaskInstanceDetails } from './TaskInstanceDetails';
import { useToast } from '@/hooks/use-toast';

interface KioskTaskListProps {
  userId: string;
}

export function KioskTaskList({ userId }: KioskTaskListProps) {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [completeTask, setCompleteTask] = useState<any>(null);
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadTasks();
    
    // Set up real-time listener
    const channel = supabase
      .channel('kiosk-tasks')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'task_instances' },
        () => loadTasks()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const loadTasks = async () => {
    try {
      const { data, error } = await supabase
        .from('task_instances')
        .select(`
          *,
          task_templates (
            id,
            title,
            description,
            steps,
            est_minutes,
            criticality,
            required_proof
          ),
          locations (id, name),
          areas (id, name)
        `)
        .eq('status', 'pending')
        .gte('due_at', new Date().toISOString())
        .lte('due_at', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString())
        .order('urgency_score', { ascending: false });

      if (error) throw error;
      setTasks(data || []);
    } catch (error) {
      console.error('Error loading tasks:', error);
      toast({
        title: 'Error',
        description: 'Failed to load tasks',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getUrgencyColor = (score: number) => {
    if (score >= 0.8) return 'bg-destructive/20 border-destructive hover:bg-destructive/30';
    if (score >= 0.6) return 'bg-warning/20 border-warning hover:bg-warning/30';
    return 'bg-muted border-border hover:bg-muted/80';
  };

  const getUrgencyHeight = (score: number) => {
    if (score >= 0.8) return 'min-h-32';
    if (score >= 0.6) return 'min-h-28';
    return 'min-h-24';
  };

  const handleTaskClick = (task: any) => {
    setSelectedTask(task);
    setDetailsOpen(true);
  };

  const handleStartTask = (task: any) => {
    setCompleteTask(task);
    setCompleteDialogOpen(true);
  };

  const filteredTasks = tasks.filter(task => {
    if (filter === 'all') return true;
    if (filter === 'mine') return task.assigned_role; // Would need to check actual assignment
    // Add area filter logic here
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Clock className="h-12 w-12 animate-spin mx-auto text-muted-foreground" />
          <p className="mt-4 text-muted-foreground">Loading tasks...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="all">All Tasks</TabsTrigger>
          <TabsTrigger value="mine">My Tasks</TabsTrigger>
          <TabsTrigger value="area">By Area</TabsTrigger>
        </TabsList>

        <TabsContent value={filter} className="space-y-3 mt-6">
          {filteredTasks.length === 0 ? (
            <Card className="p-8">
              <div className="text-center">
                <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-4" />
                <h3 className="text-lg font-semibold">All Caught Up!</h3>
                <p className="text-muted-foreground mt-2">
                  No pending tasks at the moment.
                </p>
              </div>
            </Card>
          ) : (
            filteredTasks.map((task) => {
              const urgencyScore = task.urgency_score || 0.5;
              const timeUntilDue = task.due_at 
                ? formatDistanceToNow(new Date(task.due_at), { addSuffix: true })
                : 'No due date';

              return (
                <Card
                  key={task.id}
                  className={`${getUrgencyColor(urgencyScore)} ${getUrgencyHeight(urgencyScore)} border-2 transition-all cursor-pointer`}
                  onClick={() => handleTaskClick(task)}
                >
                  <div className="p-6 h-full flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="text-xl font-bold mb-1">
                            {task.task_templates?.title || 'Untitled Task'}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {task.locations?.name}
                            {task.areas?.name && ` • ${task.areas.name}`}
                          </p>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {urgencyScore >= 0.8 && (
                            <AlertCircle className="h-6 w-6 text-destructive" />
                          )}
                          <Badge variant="outline" className="text-sm">
                            {(urgencyScore * 100).toFixed(0)}%
                          </Badge>
                        </div>
                      </div>

                      {task.task_templates?.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                          {task.task_templates.description}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between mt-4 pt-4 border-t">
                      <div className="flex items-center gap-4 text-sm">
                        <span className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          Due {timeUntilDue}
                        </span>
                        <span>
                          ~{task.task_templates?.est_minutes || 15} min
                        </span>
                      </div>
                      
                      <Button
                        size="lg"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartTask(task);
                        }}
                      >
                        Start Task
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </TabsContent>
      </Tabs>

      {/* Task Details Modal */}
      <TaskInstanceDetails
        task={selectedTask}
        open={detailsOpen}
        onClose={() => {
          setDetailsOpen(false);
          setSelectedTask(null);
        }}
      />

      {/* Complete Task Dialog */}
      <CompleteTaskDialog
        taskId={completeTask?.id}
        taskTemplate={completeTask?.task_templates}
        open={completeDialogOpen}
        onClose={() => {
          setCompleteDialogOpen(false);
          setCompleteTask(null);
        }}
        onSuccess={() => {
          loadTasks();
          setCompleteDialogOpen(false);
          setCompleteTask(null);
        }}
      />
    </div>
  );
}
