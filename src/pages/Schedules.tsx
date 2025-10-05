import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScheduleForm } from '@/components/ScheduleForm';
import { ArrowLeft, Plus, Edit, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export default function Schedules() {
  const navigate = useNavigate();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const [schedules, setSchedules] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | undefined>();

  useEffect(() => {
    if (!roleLoading && !isAdmin()) {
      navigate('/dashboard');
    }
  }, [roleLoading, isAdmin, navigate]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [schedulesRes, templatesRes] = await Promise.all([
      supabase
        .from('schedules')
        .select(`
          *, 
          task_routines!routine_id(title),
          departments(name),
          shifts(name, start_time, end_time)
        `)
        .is('archived_at', null)
        .order('created_at', { ascending: false }),
      supabase
        .from('task_routines')
        .select('id, title')
        .is('archived_at', null),
    ]);

    if (schedulesRes.data) setSchedules(schedulesRes.data);
    if (templatesRes.data) setTemplates(templatesRes.data);
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Archive this schedule?')) return;

    const { error } = await supabase
      .from('schedules')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Schedule archived');
      loadData();
    }
  };

  const getScheduleDisplay = (schedule: any) => {
    if (schedule.type === 'window') {
      const days = schedule.days_of_week?.map((d: number) => 
        ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]
      ).join(', ') || 'No days';
      return `${days}, ${schedule.window_start} - ${schedule.window_end}`;
    } else if (schedule.type === 'cron') {
      return schedule.cron_expr || 'Invalid cron';
    } else {
      return schedule.window_start || 'Not set';
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
            <h1 className="text-3xl font-bold">Schedules</h1>
          </div>
          <Button onClick={() => { setEditingId(undefined); setDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Create Schedule
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Schedules</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Template</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Schedule</TableHead>
                  <TableHead>Assigned Role</TableHead>
                  <TableHead>Shift</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schedules.map(schedule => (
                  <TableRow key={schedule.id}>
                    <TableCell className="font-medium">
                      {schedule.task_routines?.title || 'Unknown'}
                    </TableCell>
                    <TableCell>
                      {schedule.departments?.name || '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {schedule.type}
                      </Badge>
                    </TableCell>
                    <TableCell>{getScheduleDisplay(schedule)}</TableCell>
                    <TableCell>{schedule.assignee_role || 'crew'}</TableCell>
                    <TableCell>
                      {schedule.shifts ? 
                        `${schedule.shifts.name} (${schedule.shifts.start_time}-${schedule.shifts.end_time})` 
                        : schedule.shift_name || '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => { setEditingId(schedule.id); setDialogOpen(true); }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(schedule.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Edit Schedule' : 'Create Schedule'}</DialogTitle>
            </DialogHeader>
            <ScheduleForm
              scheduleId={editingId}
              onSuccess={() => { setDialogOpen(false); loadData(); }}
              onCancel={() => setDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
