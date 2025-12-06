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
import { Wifi, WifiOff, ArrowLeft, CheckCircle2, Clock, CalendarIcon, Filter, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useOrgTimezone, getStartOfDayInTimezone, getEndOfDayInTimezone, getCurrentTimeInTimezone, getDayOfWeekInTimezone } from '@/hooks/useOrgTimezone';

interface Shift {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  days_of_week: number[];
  department_id: string | null;
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
  location_id: string;
}

interface Area {
  id: string;
  name: string;
  location_id: string;
}

interface TeamMember {
  id: string;
  display_name: string;
  pin_hash: string | null;
  is_admin?: boolean;
}

export default function Kiosk() {
  const navigate = useNavigate();
  const { timezone: orgTimezone, loading: tzLoading } = useOrgTimezone();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [activeShifts, setActiveShifts] = useState<Shift[]>([]);
  const [allShifts, setAllShifts] = useState<Shift[]>([]);
  const [selectedShiftId, setSelectedShiftId] = useState<string>('active');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('all');
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

  // Load initial data when org timezone is available
  useEffect(() => {
    if (!tzLoading) {
      Promise.all([
        loadActiveShifts(),
        loadAllShifts(),
        loadDepartments()
      ]);
    }
  }, [tzLoading, orgTimezone]);

  useEffect(() => {
    if (activeShifts.length > 0) {
      loadTeamMembers();
    }
  }, [activeShifts]);

  useEffect(() => {
    loadTasks();
  }, [selectedShiftId, selectedDate, selectedDepartmentId]);

  // Reset shift when department changes
  useEffect(() => {
    if (selectedDepartmentId !== 'all') {
      setSelectedShiftId('active');
    }
  }, [selectedDepartmentId]);

  // Get filtered shifts based on selected department
  const getFilteredShifts = () => {
    if (selectedDepartmentId === 'all') return allShifts;
    
    // Filter shifts that belong to the selected department OR have no department (general shifts)
    return allShifts.filter(shift => 
      shift.department_id === selectedDepartmentId || shift.department_id === null
    );
  };

  const loadActiveShifts = async () => {
    setLoading(true);
    try {
      const now = new Date();
      // Use org timezone for day of week and current time
      const currentDay = getDayOfWeekInTimezone(now, orgTimezone);
      const currentTime = getCurrentTimeInTimezone(orgTimezone);

      const { data: shifts, error } = await supabase
        .from('shifts')
        .select('*, departments(name), locations(name)')
        .contains('days_of_week', [currentDay])
        .is('archived_at', null);

      if (error) throw error;

      // Find ALL active shifts based on org timezone
      const currentActiveShifts = shifts?.filter((shift: Shift) => {
        const isTimeInRange = currentTime >= shift.start_time.slice(0, 5) && currentTime <= shift.end_time.slice(0, 5);
        return isTimeInRange;
      }) || [];

      console.log(`Found ${currentActiveShifts.length} active shifts (TZ: ${orgTimezone}):`, currentActiveShifts.map(s => s.name));
      setActiveShifts(currentActiveShifts);
    } catch (error: any) {
      toast.error('Failed to load active shifts');
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
        .select('id, name, location_id')
        .is('archived_at', null)
        .order('name');

      if (error) throw error;
      setDepartments(data || []);
    } catch (error: any) {
      console.error('Failed to load departments:', error);
    }
  };


  const loadTasks = async () => {
    try {
      // Build date range for selected date using org timezone
      const startOfDay = getStartOfDayInTimezone(selectedDate, orgTimezone);
      const endOfDay = getEndOfDayInTimezone(selectedDate, orgTimezone);

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
      if (selectedShiftId === 'active') {
        // Show tasks from ALL currently active shifts
        if (activeShifts.length > 0) {
          const activeShiftIds = activeShifts.map(s => s.id);
          query = query.in('shift_id', activeShiftIds);
        }
      } else if (selectedShiftId !== 'all') {
        // Show tasks from a specific selected shift
        query = query.eq('shift_id', selectedShiftId);
      }

      // Apply department filter
      if (selectedDepartmentId !== 'all') {
        query = query.eq('department_id', selectedDepartmentId);
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
    if (activeShifts.length === 0) return;

    try {
      // Load team members from ALL active shifts
      const activeShiftIds = activeShifts.map(s => s.id);
      
      const { data: shiftMembers, error: shiftError } = await supabase
        .from('user_shifts')
        .select(`
          user_id,
          profiles(id, display_name, pin_hash)
        `)
        .in('shift_id', activeShiftIds);

      if (shiftError) throw shiftError;

      // Get current user's org_id to find all org admins
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userProfile } = await supabase
        .from('profiles')
        .select('org_id')
        .eq('id', user.id)
        .single();

      // Load all org admins from the same organization
      const { data: adminRoles, error: adminError } = await supabase
        .from('user_roles')
        .select(`
          user_id,
          profiles!inner(id, display_name, pin_hash, org_id)
        `)
        .eq('role', 'org_admin')
        .eq('profiles.org_id', userProfile?.org_id);

      if (adminError) throw adminError;

      // Combine shift members and org admins
      const shiftMemberProfiles = (shiftMembers || [])
        .map((us: any) => us.profiles)
        .filter(Boolean)
        .map(member => ({ ...member, is_admin: false }));

      const adminProfiles = (adminRoles || [])
        .map((ar: any) => ar.profiles)
        .filter(Boolean)
        .map(admin => ({ ...admin, is_admin: true }));

      // Deduplicate (if admin is also in shift, mark them as admin)
      const memberMap = new Map();
      
      shiftMemberProfiles.forEach(member => {
        memberMap.set(member.id, member);
      });
      
      adminProfiles.forEach(admin => {
        memberMap.set(admin.id, admin);
      });

      const uniqueMembers = Array.from(memberMap.values());
      setTeamMembers(uniqueMembers);
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
      // Use the secure complete-task edge function
      const { data, error } = await supabase.functions.invoke('complete-task', {
        body: {
          taskInstanceId: selectedTask.id,
          userId: selectedMember,
          pin: pin,
          outcome: 'completed'
        }
      });

      if (error) {
        console.error('Task completion error:', error);
        toast.error(error.message || 'Invalid PIN or failed to complete task');
        return;
      }

      if (!data?.success) {
        toast.error('Failed to complete task');
        return;
      }

      toast.success('Task completed!');
      setSelectedTask(null);
      setSelectedMember(null);
      setPin('');
      loadTasks();
    } catch (error: any) {
      toast.error(error.message || 'Failed to complete task');
      console.error('Task completion error:', error);
    }
  };

  const getUrgencyColor = (score: number) => {
    if (score >= 0.8) return 'bg-destructive';
    if (score >= 0.6) return 'bg-orange-500';
    if (score >= 0.4) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  if (loading || tzLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (activeShifts.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="p-8 max-w-md text-center">
          <Clock className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-2xl font-bold mb-2">No Active Shifts</h2>
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
            <Button variant="outline" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            
            <div className="text-center">
              <h1 className="text-xl font-bold">Task Kiosk</h1>
              <p className="text-sm text-muted-foreground">
                {activeShifts.length > 0 ? (
                  <>
                    {activeShifts.length === 1 ? (
                      activeShifts[0].name
                    ) : (
                      `${activeShifts.length} Active Shifts`
                    )}
                    {selectedDepartmentId !== 'all' && (
                      <> • {departments.find(d => d.id === selectedDepartmentId)?.name || 'Department'}</>
                    )}
                  </>
                ) : 'No active shifts'}
              </p>
            </div>
            
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
          </div>

          {/* Filter Controls: Date | Department | Shift */}
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

            {/* Shift Filter - Filtered by Department */}
            <Select 
              value={selectedShiftId} 
              onValueChange={setSelectedShiftId}
              disabled={selectedDepartmentId !== 'all' && getFilteredShifts().length === 0}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select shift" />
              </SelectTrigger>
              <SelectContent className="z-50 bg-background">
                <SelectItem value="active">Active Shifts</SelectItem>
                <SelectItem value="all">All Shifts</SelectItem>
                {getFilteredShifts().map((shift) => (
                  <SelectItem key={shift.id} value={shift.id}>
                    {shift.name}
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
            {tasks.length} task{tasks.length !== 1 ? 's' : ''} 
            {selectedShiftId === 'active' && activeShifts.length > 1 && (
              <> across {activeShifts.length} active shifts</>
            )}
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
              
              <div className="space-y-1 mb-2">
                {task.departments?.name && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Building2 className="h-3 w-3" />
                    <span>{task.departments.name}</span>
                  </div>
                )}
                
                {task.areas?.name && (
                  <p className="text-sm text-muted-foreground">
                    {task.areas.name}
                  </p>
                )}
              </div>
              
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
                    className="relative"
                  >
                    {member.display_name}
                    {member.is_admin && (
                      <Badge className="absolute -top-1 -right-1 text-[10px] px-1 py-0 h-4" variant="secondary">
                        Admin
                      </Badge>
                    )}
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
