import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Wifi, WifiOff, ArrowLeft, CheckCircle2, Clock, CalendarIcon, Filter, Building2, Camera, Upload, X, Loader2, SkipForward, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useOrgTimezone, getStartOfDayInTimezone, getEndOfDayInTimezone, getCurrentTimeInTimezone, getDayOfWeekInTimezone } from '@/hooks/useOrgTimezone';
import { KioskDebugPanel } from '@/components/KioskDebugPanel';

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
  required_proof: 'none' | 'note' | 'photo' | 'dual' | null;
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
  const [searchParams] = useSearchParams();
  const showDebug = searchParams.get('debug') === 'true';
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
  
  // Skip flow state
  const [dialogMode, setDialogMode] = useState<'complete' | 'skip'>('complete');
  const [skipReason, setSkipReason] = useState('');
  const [skipReasonCategory, setSkipReasonCategory] = useState('');
  
  // Proof collection state
  const [completionNote, setCompletionNote] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
        const start = shift.start_time.slice(0, 5);
        const end = shift.end_time.slice(0, 5);
        if (end <= start) {
          // Overnight shift: active if current time is after start OR before end
          return currentTime >= start || currentTime < end;
        }
        return currentTime >= start && currentTime < end;
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

  const SKIP_REASONS: Record<string, string> = {
    no_supplies: 'No Supplies Available',
    equipment_broken: 'Equipment Broken/Unavailable',
    area_locked: 'Area Locked/Inaccessible',
    safety_concern: 'Safety Concern',
    other: 'Other',
  };

  const resetDialogState = () => {
    setSelectedTask(null);
    setSelectedMember(null);
    setPin('');
    setDialogMode('complete');
    setSkipReason('');
    setSkipReasonCategory('');
    setCompletionNote('');
    setPhotoFile(null);
    setPhotoPreview(null);
    setSubmitting(false);
  };

  const handleTaskClick = (task: TaskInstance) => {
    resetDialogState();
    setSelectedTask(task);
  };

  const handleMemberSelect = (memberId: string) => {
    setSelectedMember(memberId);
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error('Photo must be smaller than 10MB');
        return;
      }
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setPhotoPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const getRequiredProof = (): string => {
    return selectedTask?.required_proof || 
           (selectedTask?.denormalized_data as any)?.required_proof || 
           'none';
  };

  const handleComplete = async () => {
    if (!selectedTask || !selectedMember || !pin) {
      toast.error('Please select a team member and enter PIN');
      return;
    }

    const proof = getRequiredProof();
    const requiresNote = proof === 'note' || proof === 'dual';
    const requiresPhoto = proof === 'photo' || proof === 'dual';

    if (requiresNote && !completionNote.trim()) {
      toast.error('A completion note is required for this task');
      return;
    }
    if (requiresPhoto && !photoFile) {
      toast.error('A photo is required for this task');
      return;
    }

    setSubmitting(true);
    try {
      let photoUrl: string | null = null;

      // Upload photo if provided
      if (photoFile) {
        const fileExt = photoFile.name.split('.').pop();
        const fileName = `kiosk/${selectedTask.id}_${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('task-photos')
          .upload(fileName, photoFile, { cacheControl: '3600', upsert: false });
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage
          .from('task-photos')
          .getPublicUrl(fileName);
        photoUrl = publicUrl;
      }

      const { data, error } = await supabase.functions.invoke('complete-task', {
        body: {
          taskInstanceId: selectedTask.id,
          userId: selectedMember,
          pin: pin,
          outcome: 'completed',
          note: completionNote.trim() || null,
          photoUrl: photoUrl,
        }
      });

      if (error) {
        // Try to extract error message from response
        let errorMsg = error.message || 'Invalid PIN or failed to complete task';
        try {
          const errorBody = (error as any)?.context ? await (error as any).context.json() : null;
          if (errorBody?.error) errorMsg = errorBody.error;
        } catch {}
        toast.error(errorMsg);
        return;
      }

      if (!data?.success) {
        toast.error(data?.error || 'Failed to complete task');
        return;
      }

      toast.success('Task completed!');
      resetDialogState();
      loadTasks();
    } catch (error: any) {
      toast.error(error.message || 'Failed to complete task');
      console.error('Task completion error:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkip = async () => {
    if (!selectedTask || !selectedMember || !pin) {
      toast.error('Please select a team member and enter PIN');
      return;
    }
    if (!skipReasonCategory) {
      toast.error('Please select a reason for skipping');
      return;
    }
    if (!skipReason.trim()) {
      toast.error('Please provide details for why this task is being skipped');
      return;
    }

    setSubmitting(true);
    try {
      const noteText = `[${SKIP_REASONS[skipReasonCategory] || skipReasonCategory}] ${skipReason.trim()}`;

      const { data, error } = await supabase.functions.invoke('complete-task', {
        body: {
          taskInstanceId: selectedTask.id,
          userId: selectedMember,
          pin: pin,
          outcome: 'skipped',
          note: noteText,
        }
      });

      if (error) {
        let errorMsg = error.message || 'Failed to skip task';
        try {
          const errorBody = (error as any)?.context ? await (error as any).context.json() : null;
          if (errorBody?.error) errorMsg = errorBody.error;
        } catch {}
        toast.error(errorMsg);
        return;
      }

      if (!data?.success) {
        toast.error(data?.error || 'Failed to skip task');
        return;
      }

      toast.success('Task skipped');
      resetDialogState();
      loadTasks();
    } catch (error: any) {
      toast.error(error.message || 'Failed to skip task');
      console.error('Task skip error:', error);
    } finally {
      setSubmitting(false);
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
                <Wifi className="h-5 w-5 text-success" />
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
        {/* Debug Panel */}
        {showDebug && (
          <KioskDebugPanel
            orgTimezone={orgTimezone}
            allShifts={allShifts}
            activeShiftIds={activeShifts.map(s => s.id)}
          />
        )}

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
                {task.areas?.name ? (
                  <>
                    {task.departments?.name && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Building2 className="h-3 w-3" />
                        <span>{task.departments.name}</span>
                      </div>
                    )}
                    <p className="text-sm text-muted-foreground">
                      {task.areas.name}
                    </p>
                  </>
                ) : task.departments?.name ? (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Building2 className="h-3 w-3" />
                    <span>{task.departments.name}</span>
                  </div>
                ) : null}
              </div>
              
              <p className="text-sm text-muted-foreground">
                Due: {format(new Date(task.due_at), 'h:mm a')}
              </p>
            </Card>
          ))}
        </div>

        {tasks.length === 0 && (
          <Card className="p-12 text-center">
            <CheckCircle2 className="w-16 h-16 mx-auto mb-4 text-success" />
            <h3 className="text-xl font-bold mb-2">All Caught Up!</h3>
            <p className="text-muted-foreground">
              No pending tasks for this shift.
            </p>
          </Card>
        )}
      </main>

      {/* Task Completion / Skip Dialog */}
      <Dialog open={!!selectedTask} onOpenChange={() => resetDialogState()}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {dialogMode === 'skip' ? (
                <span className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-orange-500" />
                  Skip Task
                </span>
              ) : 'Complete Task'}
            </DialogTitle>
            <DialogDescription>
              {dialogMode === 'skip' 
                ? 'Provide a reason for skipping this task.'
                : 'Select a team member and enter their PIN to verify completion.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Task info */}
            <div className="bg-muted p-3 rounded-lg">
              <h4 className="font-semibold">{selectedTask?.task_routines?.title}</h4>
              {selectedTask?.task_routines?.description && (
                <p className="text-sm text-muted-foreground mt-1">
                  {selectedTask.task_routines.description}
                </p>
              )}
              {getRequiredProof() !== 'none' && dialogMode === 'complete' && (
                <p className="text-xs text-muted-foreground mt-1">
                  Required proof: {getRequiredProof()}
                </p>
              )}
            </div>

            {/* Team member selection */}
            <div>
              <label className="text-sm font-medium mb-2 block">
                Who is {dialogMode === 'skip' ? 'skipping' : 'completing'} this task?
              </label>
              <div className="grid grid-cols-2 gap-2">
                {teamMembers.map((member) => (
                  <Button
                    key={member.id}
                    variant={selectedMember === member.id ? 'default' : 'outline'}
                    onClick={() => handleMemberSelect(member.id)}
                    className="relative min-h-[44px]"
                    disabled={submitting}
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

            {/* PIN input */}
            {selectedMember && (
              <div>
                <Label className="text-sm font-medium mb-2 block">
                  Enter PIN to verify
                </Label>
                <Input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="Enter PIN"
                  className="text-center text-2xl tracking-widest"
                  disabled={submitting}
                />
              </div>
            )}

            {/* === COMPLETE MODE: Proof collection === */}
            {dialogMode === 'complete' && selectedMember && pin.length >= 4 && (() => {
              const proof = getRequiredProof();
              const showNote = proof === 'note' || proof === 'dual';
              const showPhoto = proof === 'photo' || proof === 'dual';
              
              if (!showNote && !showPhoto) return null;
              
              return (
                <div className="space-y-4 border-t pt-4">
                  {showNote && (
                    <div className="space-y-2">
                      <Label>
                        Completion note <span className="text-destructive">*</span>
                      </Label>
                      <Textarea
                        value={completionNote}
                        onChange={(e) => setCompletionNote(e.target.value)}
                        placeholder="Describe what was done..."
                        rows={3}
                        maxLength={1000}
                        disabled={submitting}
                      />
                      <p className="text-xs text-muted-foreground text-right">{completionNote.length}/1000</p>
                    </div>
                  )}
                  {showPhoto && (
                    <div className="space-y-2">
                      <Label>
                        Photo proof <span className="text-destructive">*</span>
                      </Label>
                      {photoPreview ? (
                        <div className="relative">
                          <img 
                            src={photoPreview} 
                            alt="Task proof" 
                            className="w-full h-40 object-cover rounded-lg"
                          />
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            className="absolute top-2 right-2"
                            onClick={() => { setPhotoFile(null); setPhotoPreview(null); }}
                            disabled={submitting}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <Label
                            htmlFor="kiosk-photo-upload"
                            className="flex-1 flex items-center justify-center gap-2 border-2 border-dashed rounded-lg p-4 cursor-pointer hover:bg-muted transition-colors min-h-[44px]"
                          >
                            <Upload className="h-5 w-5 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">Upload</span>
                          </Label>
                          <Input
                            id="kiosk-photo-upload"
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handlePhotoChange}
                          />
                          <Label
                            htmlFor="kiosk-photo-camera"
                            className="flex items-center justify-center gap-2 border-2 border-dashed rounded-lg p-4 cursor-pointer hover:bg-muted transition-colors min-h-[44px]"
                          >
                            <Camera className="h-5 w-5 text-muted-foreground" />
                          </Label>
                          <Input
                            id="kiosk-photo-camera"
                            type="file"
                            accept="image/*"
                            capture="environment"
                            className="hidden"
                            onChange={handlePhotoChange}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* === SKIP MODE: Reason fields === */}
            {dialogMode === 'skip' && selectedMember && pin.length >= 4 && (
              <div className="space-y-4 border-t pt-4">
                <div className="space-y-2">
                  <Label>Reason for skipping <span className="text-destructive">*</span></Label>
                  <Select value={skipReasonCategory} onValueChange={setSkipReasonCategory} disabled={submitting}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a reason..." />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(SKIP_REASONS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Additional details <span className="text-destructive">*</span></Label>
                  <Textarea
                    value={skipReason}
                    onChange={(e) => setSkipReason(e.target.value)}
                    placeholder="Provide context for why this task is being skipped..."
                    rows={3}
                    maxLength={500}
                    disabled={submitting}
                  />
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-2 pt-4">
              <Button 
                variant="outline" 
                onClick={resetDialogState}
                className="flex-1 min-h-[44px]"
                disabled={submitting}
              >
                Cancel
              </Button>
              
              {dialogMode === 'complete' ? (
                <>
                  <Button 
                    variant="outline"
                    onClick={() => setDialogMode('skip')}
                    className="min-h-[44px]"
                    disabled={submitting || !selectedMember || pin.length < 4}
                  >
                    <SkipForward className="h-4 w-4 mr-1" />
                    Skip
                  </Button>
                  <Button 
                    onClick={handleComplete}
                    disabled={submitting || !selectedMember || pin.length < 4}
                    className="flex-1 min-h-[44px]"
                  >
                    {submitting ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Completing...</>
                    ) : 'Complete'}
                  </Button>
                </>
              ) : (
                <>
                  <Button 
                    variant="outline"
                    onClick={() => setDialogMode('complete')}
                    className="min-h-[44px]"
                    disabled={submitting}
                  >
                    Back
                  </Button>
                  <Button 
                    variant="destructive"
                    onClick={handleSkip}
                    disabled={submitting || !selectedMember || pin.length < 4 || !skipReasonCategory || !skipReason.trim()}
                    className="flex-1 min-h-[44px]"
                  >
                    {submitting ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Skipping...</>
                    ) : 'Skip Task'}
                  </Button>
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
