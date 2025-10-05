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
import { useUserShifts } from '@/hooks/useUserShifts';

interface KioskTaskListProps {
  userId?: string;
}

export function KioskTaskList({ userId }: KioskTaskListProps) {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('');
  const [departments, setDepartments] = useState<any[]>([]);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [completeTask, setCompleteTask] = useState<any>(null);
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const { toast } = useToast();
  const { shifts, departments: userDepartments, getCurrentShift, getShiftIds, getDepartmentIds, loading: shiftsLoading } = useUserShifts(userId || '');

  useEffect(() => {
    // Load tasks immediately if no userId (public kiosk mode)
    if (!userId) {
      loadTasks();
      loadDepartments();
    } else if (!shiftsLoading) {
      loadTasks();
      loadDepartments();
    }
  }, [shiftsLoading, userId]);

  useEffect(() => {
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
  }, []);

  const loadDepartments = async () => {
    try {
      const { data, error } = await supabase
        .from('departments')
        .select('id, name, location_id, locations(name)')
        .is('archived_at', null)
        .order('name');

      if (error) throw error;
      setDepartments(data || []);
    } catch (error) {
      console.error('Error loading departments:', error);
    }
  };

  const loadTasks = async () => {
    // Only wait for shifts if we have a userId
    if (userId && shiftsLoading) return;
    
    setLoading(true);
    try {
      const now = new Date();
      const endOfWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      let query = supabase
        .from('task_instances')
        .select(`
          *,
          task_routines!routine_id (
            id,
            title,
            description,
            steps,
            est_minutes,
            criticality,
            required_proof
          ),
          locations (id, name),
          departments (name),
          shifts (name)
        `)
        .eq('status', 'pending')
        .gte('due_at', now.toISOString())
        .lte('due_at', endOfWeek.toISOString())
        .order('urgency_score', { ascending: false });

      const { data, error } = await query;

      if (error) throw error;

      // If no userId, show all tasks
      let filteredTasks = data || [];
      
      if (userId) {
        // Filter by user's shifts and departments
        const userShiftIds = getShiftIds();
        const userDepartmentIds = getDepartmentIds();

        if (userShiftIds.length > 0) {
          // Show tasks assigned to user's shifts OR unassigned tasks in their departments
          filteredTasks = filteredTasks.filter(task => {
            // Tasks with matching shift_id
            if (task.shift_id && userShiftIds.includes(task.shift_id)) {
              return true;
            }
            // Tasks with no shift but in user's departments
            if (!task.shift_id && task.department_id && userDepartmentIds.includes(task.department_id)) {
              return true;
            }
            // Tasks with no shift and no department (legacy)
            if (!task.shift_id && !task.department_id) {
              return true;
            }
            return false;
          });
        } else if (userDepartmentIds.length > 0) {
          // User has departments but no shifts
          filteredTasks = filteredTasks.filter(task => {
            if (task.department_id && userDepartmentIds.includes(task.department_id)) {
              return true;
            }
            if (!task.department_id) {
              return true;
            }
            return false;
          });
        }
      }

      setTasks(filteredTasks);
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
    if (filter === 'by-department' && selectedDepartment) {
      return task.department_id === selectedDepartment;
    }
    return true;
  });

  if (loading || (userId && shiftsLoading)) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Clock className="h-12 w-12 animate-spin mx-auto text-muted-foreground" />
          <p className="mt-4 text-muted-foreground">Loading tasks...</p>
        </div>
      </div>
    );
  }

  const currentShift = getCurrentShift();

  return (
    <div className="space-y-6">
      {/* Current Shift Info */}
      {currentShift ? (
        <div className="flex items-center justify-between p-4 bg-primary/10 border border-primary/20 rounded-lg">
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-primary" />
            <div>
              <p className="font-medium">Current Shift: {currentShift.name}</p>
              <p className="text-sm text-muted-foreground">
                {currentShift.start_time} - {currentShift.end_time}
              </p>
            </div>
          </div>
          <Badge variant="default">Active</Badge>
        </div>
      ) : shifts.length > 0 ? (
        <div className="flex items-center gap-3 p-4 bg-muted/50 border rounded-lg">
          <AlertCircle className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="font-medium">Not in active shift</p>
            <p className="text-sm text-muted-foreground">
              Tasks shown are from your assigned shifts
            </p>
          </div>
        </div>
      ) : null}

      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="all">All Tasks</TabsTrigger>
          <TabsTrigger value="by-department">Tasks by Department</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-3 mt-6">
          {filteredTasks.length === 0 ? (
            <Card className="p-8">
              <div className="text-center">
                <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-4" />
                <h3 className="text-lg font-semibold">All Tasks Completed!</h3>
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
                            {task.task_routines?.title || 'Untitled Task'}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {task.locations?.name}
                          </p>
                          {(task.departments?.name || task.shifts?.name) && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {task.departments?.name}
                              {task.shifts?.name && ` • ${task.shifts.name}`}
                            </p>
                          )}
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

                      {task.task_routines?.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                          {task.task_routines.description}
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
                          ~{task.task_routines?.est_minutes || 15} min
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

        <TabsContent value="by-department" className="space-y-4 mt-6">
          <div className="grid gap-3">
            {departments.map((dept) => {
              const deptTasks = tasks.filter(t => t.department_id === dept.id);
              if (deptTasks.length === 0) return null;

              return (
                <Card key={dept.id} className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-semibold">{dept.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {dept.locations?.name}
                      </p>
                    </div>
                    <Badge variant="secondary">{deptTasks.length} tasks</Badge>
                  </div>
                  
                  <div className="space-y-2">
                    {deptTasks.map((task) => {
                      const urgencyScore = task.urgency_score || 0.5;
                      const timeUntilDue = task.due_at 
                        ? formatDistanceToNow(new Date(task.due_at), { addSuffix: true })
                        : 'No due date';

                      return (
                        <div
                          key={task.id}
                          className={`${getUrgencyColor(urgencyScore)} p-4 rounded-lg border-2 cursor-pointer transition-all`}
                          onClick={() => handleTaskClick(task)}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <h4 className="font-medium">
                                {task.task_routines?.title || 'Untitled Task'}
                              </h4>
                              {task.shifts?.name && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  {task.shifts.name}
                                </p>
                              )}
                            </div>
                            <Badge variant="outline" className="text-xs">
                              {(urgencyScore * 100).toFixed(0)}%
                            </Badge>
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <span className="text-sm flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Due {timeUntilDue}
                            </span>
                            <Button
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStartTask(task);
                              }}
                            >
                              Start
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              );
            })}
          </div>
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
        taskTemplate={completeTask?.task_routines}
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
