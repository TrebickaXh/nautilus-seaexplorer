import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Wifi, WifiOff, ArrowLeft, CheckCircle2, Clock, CalendarIcon, Filter } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

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
  areas?: { name: string; id: string };
  departments?: { name: string; id: string };
  task_routines?: { title: string; description: string };
}

interface Department {
  id: string;
  name: string;
}

interface Area {
  id: string;
  name: string;
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
  const [allShifts, setAllShifts] = useState<Shift[]>([]);
  const [selectedShiftId, setSelectedShiftId] = useState<string>('current');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('all');
  const [areas, setAreas] = useState<Area[]>([]);
  const [selectedAreaId, setSelectedAreaId] = useState<string>('all');
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
    loadAllShifts();
    loadDepartments();
    loadAreas();
  }, []);

  useEffect(() => {
    if (currentShift) {
      loadTeamMembers();
    }
  }, [currentShift]);

  useEffect(() => {
    loadTasks();
  }, [selectedShiftId, selectedDate, selectedDepartmentId, selectedAreaId]);

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

  const loadAllShifts = async () => {
    try {
      const { data, error } = await supabase
        .from('shifts')
        .select('*, departments(name), locations(name)')
        .is('archived_at', null)
        .order('name');

      if (error) throw error;
      setAllShifts(data || []);
    } catch (error: any) {
      console.error('Failed to load shifts:', error);
    }
  };

  const loadDepartments = async () => {
    try {
      const { data, error } = await supabase
        .from('departments')
        .select('id, name')
        .is('archived_at', null)
        .order('name');

      if (error) throw error;
      setDepartments(data || []);
    } catch (error: any) {
      console.error('Failed to load departments:', error);
    }
  };

  const loadAreas = async () => {
    try {
      const { data, error } = await supabase
        .from('areas')
        .select('id, name')
        .is('archived_at', null)
        .order('name');

      if (error) throw error;
      setAreas(data || []);
    } catch (error: any) {
      console.error('Failed to load areas:', error);
    }
  };

  const loadTasks = async () => {
    try {
      // Determine which shift to filter by
      const shiftId = selectedShiftId === 'current' ? currentShift?.id : selectedShiftId;
      
      // Build date range for selected date
      const startOfDay = new Date(selectedDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(selectedDate);
      endOfDay.setHours(23, 59, 59, 999);

      let query = supabase
        .from('task_instances')
        .select(`
          *,
          areas(id, name),
          departments(id, name),
          task_routines(title, description)
        `)
        .eq('status', 'pending')
        .gte('due_at', startOfDay.toISOString())
        .lte('due_at', endOfDay.toISOString());

      // Apply shift filter
      if (shiftId && shiftId !== 'all') {
        query = query.eq('shift_id', shiftId);
      }

      // Apply department filter
      if (selectedDepartmentId !== 'all') {
        query = query.eq('department_id', selectedDepartmentId);
      }

      // Apply area filter
      if (selectedAreaId !== 'all') {
        query = query.eq('area_id', selectedAreaId);
      }

      query = query.order('urgency_score', { ascending: false });

      const { data, error } = await query;

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
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-xl font-bold">Task Kiosk</h1>
              <p className="text-sm text-muted-foreground">
                {currentShift ? `${currentShift.name} • ${currentShift.departments?.name}` : 'No active shift'}
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

          {/* Filter Controls */}
          <div className="flex flex-wrap items-center gap-3">
            <Filter className="h-5 w-5 text-muted-foreground" />
            
            {/* Date Picker */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-[200px] justify-start text-left font-normal",
                    !selectedDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 z-50 bg-background" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => date && setSelectedDate(date)}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>

            {/* Shift Filter */}
            <Select value={selectedShiftId} onValueChange={setSelectedShiftId}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select shift" />
              </SelectTrigger>
              <SelectContent className="z-50 bg-background">
                <SelectItem value="current">Current Shift</SelectItem>
                <SelectItem value="all">All Shifts</SelectItem>
                {allShifts.map((shift) => (
                  <SelectItem key={shift.id} value={shift.id}>
                    {shift.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Department Filter */}
            <Select value={selectedDepartmentId} onValueChange={setSelectedDepartmentId}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select department" />
              </SelectTrigger>
              <SelectContent className="z-50 bg-background">
                <SelectItem value="all">All Departments</SelectItem>
                {departments.map((dept) => (
                  <SelectItem key={dept.id} value={dept.id}>
                    {dept.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Area Filter */}
            <Select value={selectedAreaId} onValueChange={setSelectedAreaId}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select area" />
              </SelectTrigger>
              <SelectContent className="z-50 bg-background">
                <SelectItem value="all">All Areas</SelectItem>
                {areas.map((area) => (
                  <SelectItem key={area.id} value={area.id}>
                    {area.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
