import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Wifi, WifiOff, ArrowLeft, CheckCircle2, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface Shift {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  days_of_week: number[];
  department_id: string;
  location_id: string;
  departments?: { name: string };
  locations?: { name: string };
}

interface TaskInstance {
  id: string;
  due_at: string;
  urgency_score: number;
  denormalized_data: any;
  areas?: { name: string };
  task_routines?: { title: string; description: string };
}

interface TeamMember {
  id: string;
  display_name: string;
  pin_hash: string | null;
}

export default function Kiosk() {
  const navigate = useNavigate();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [currentShift, setCurrentShift] = useState<Shift | null>(null);
  const [tasks, setTasks] = useState<TaskInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<TaskInstance | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [selectedMember, setSelectedMember] = useState<string | null>(null);
  const [pin, setPin] = useState('');

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    loadCurrentShift();
  }, []);

  useEffect(() => {
    if (currentShift) {
      loadTasks();
      loadTeamMembers();
    }
  }, [currentShift]);

  const loadCurrentShift = async () => {
    setLoading(true);
    try {
      const now = new Date();
      const currentDay = now.getDay();
      const currentTime = now.toTimeString().slice(0, 5);

      const { data: shifts, error } = await supabase
        .from('shifts')
        .select('*, departments(name), locations(name)')
        .contains('days_of_week', [currentDay])
        .is('archived_at', null);

      if (error) throw error;

      const activeShift = shifts?.find((shift: Shift) => {
        const isTimeInRange = currentTime >= shift.start_time && currentTime <= shift.end_time;
        return isTimeInRange;
      });

      setCurrentShift(activeShift || null);
    } catch (error: any) {
      toast.error('Failed to load current shift');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const loadTasks = async () => {
    if (!currentShift) return;

    try {
      const { data, error } = await supabase
        .from('task_instances')
        .select(`
          *,
          areas(name),
          task_routines(title, description)
        `)
        .eq('shift_id', currentShift.id)
        .eq('status', 'pending')
        .gte('due_at', new Date().toISOString())
        .lte('due_at', new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString())
        .order('urgency_score', { ascending: false });

      if (error) throw error;
      setTasks(data || []);
    } catch (error: any) {
      toast.error('Failed to load tasks');
      console.error(error);
    }
  };

  const loadTeamMembers = async () => {
    if (!currentShift) return;

    try {
      const { data, error } = await supabase
        .from('user_shifts')
        .select(`
          user_id,
          profiles(id, display_name, pin_hash)
        `)
        .eq('shift_id', currentShift.id);

      if (error) throw error;

      const members = (data || [])
        .map((us: any) => us.profiles)
        .filter(Boolean);

      setTeamMembers(members);
    } catch (error: any) {
      console.error('Failed to load team members:', error);
    }
  };

  const handleTaskClick = (task: TaskInstance) => {
    setSelectedTask(task);
    setSelectedMember(null);
    setPin('');
  };

  const handleMemberSelect = (memberId: string) => {
    setSelectedMember(memberId);
  };

  const handleComplete = async () => {
    if (!selectedTask || !selectedMember || !pin) {
      toast.error('Please select a team member and enter PIN');
      return;
    }

    try {
      const { data: verified, error: pinError } = await supabase.functions.invoke('verify-pin', {
        body: { userId: selectedMember, pin }
      });

      if (pinError || !verified?.valid) {
        toast.error('Invalid PIN');
        return;
      }

      const { error: completionError } = await supabase
        .from('completions')
        .insert({
          task_instance_id: selectedTask.id,
          user_id: selectedMember,
          outcome: 'completed',
          note: null,
          photo_url: null
        });

      if (completionError) throw completionError;

      const { error: updateError } = await supabase
        .from('task_instances')
        .update({ 
          status: 'done',
          completed_at: new Date().toISOString()
        })
        .eq('id', selectedTask.id);

      if (updateError) throw updateError;

      toast.success('Task completed!');
      setSelectedTask(null);
      setSelectedMember(null);
      setPin('');
      loadTasks();
    } catch (error: any) {
      toast.error(error.message || 'Failed to complete task');
    }
  };

  const getUrgencyColor = (score: number) => {
    if (score >= 0.8) return 'bg-destructive';
    if (score >= 0.6) return 'bg-orange-500';
    if (score >= 0.4) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!currentShift) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="p-8 max-w-md text-center">
          <Clock className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-2xl font-bold mb-2">No Active Shift</h2>
          <p className="text-muted-foreground mb-4">
            There are no shifts scheduled for this time period.
          </p>
          <Button onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Task Kiosk</h1>
            <p className="text-sm text-muted-foreground">
              {currentShift.name} • {currentShift.departments?.name}
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              {isOnline ? (
                <Wifi className="h-5 w-5 text-green-500" />
              ) : (
                <WifiOff className="h-5 w-5 text-destructive" />
              )}
              <span className="text-sm text-muted-foreground">
                {isOnline ? 'Online' : 'Offline'}
              </span>
            </div>
            
            <Button variant="outline" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold mb-2">Pending Tasks</h2>
          <p className="text-muted-foreground">
            {tasks.length} task{tasks.length !== 1 ? 's' : ''} for this shift
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {tasks.map((task) => (
            <Card 
              key={task.id}
              className="p-4 cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => handleTaskClick(task)}
            >
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-semibold">{task.task_routines?.title || 'Task'}</h3>
                <Badge className={getUrgencyColor(task.urgency_score)}>
                  {Math.round(task.urgency_score * 100)}%
                </Badge>
              </div>
              
              <p className="text-sm text-muted-foreground mb-2">
                {task.areas?.name}
              </p>
              
              <p className="text-sm text-muted-foreground">
                Due: {format(new Date(task.due_at), 'h:mm a')}
              </p>
            </Card>
          ))}
        </div>

        {tasks.length === 0 && (
          <Card className="p-12 text-center">
            <CheckCircle2 className="w-16 h-16 mx-auto mb-4 text-green-500" />
            <h3 className="text-xl font-bold mb-2">All Caught Up!</h3>
            <p className="text-muted-foreground">
              No pending tasks for this shift.
            </p>
          </Card>
        )}
      </main>

      <Dialog open={!!selectedTask} onOpenChange={() => setSelectedTask(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Complete Task</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">{selectedTask?.task_routines?.title}</h4>
              <p className="text-sm text-muted-foreground">
                {selectedTask?.task_routines?.description}
              </p>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">
                Who completed this task?
              </label>
              <div className="grid grid-cols-2 gap-2">
                {teamMembers.map((member) => (
                  <Button
                    key={member.id}
                    variant={selectedMember === member.id ? 'default' : 'outline'}
                    onClick={() => handleMemberSelect(member.id)}
                  >
                    {member.display_name}
                  </Button>
                ))}
              </div>
            </div>

            {selectedMember && (
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Enter PIN to verify
                </label>
                <Input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="Enter PIN"
                  className="text-center text-2xl tracking-widest"
                />
              </div>
            )}

            <div className="flex gap-2 pt-4">
              <Button 
                variant="outline" 
                onClick={() => setSelectedTask(null)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleComplete}
                disabled={!selectedMember || pin.length < 4}
                className="flex-1"
              >
                Complete
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
