import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ShiftForm } from '@/components/ShiftForm';
import { Plus, Edit, Trash2, Users } from 'lucide-react';
import { toast } from 'sonner';

interface Shift {
  id: string;
  name: string;
  location_id: string;
  department_id: string;
  start_time: string;
  end_time: string;
  days_of_week: number[];
  departments?: {
    name: string;
    locations?: {
      name: string;
    };
  };
  user_count?: number;
}

interface ShiftTemplatesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ShiftTemplatesDialog({ open, onOpenChange }: ShiftTemplatesDialogProps) {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | undefined>();

  useEffect(() => {
    if (open) {
      loadShifts();
    }
  }, [open]);

  const loadShifts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('shifts')
      .select(`
        *,
        departments(
          name,
          locations(name)
        )
      `)
      .is('archived_at', null)
      .order('start_time', { ascending: true });

    if (error) {
      toast.error('Failed to load shifts');
      setLoading(false);
      return;
    }

    const shiftsWithCounts = await Promise.all(
      (data || []).map(async (shift) => {
        const { count } = await supabase
          .from('user_shifts')
          .select('*', { count: 'exact', head: true })
          .eq('shift_id', shift.id);
        return { ...shift, user_count: count || 0 };
      })
    );

    setShifts(shiftsWithCounts);
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Archive this shift? Users will be unassigned from it.')) return;

    const { error } = await supabase
      .from('shifts')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Shift archived');
      loadShifts();
    }
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const getDaysDisplay = (days: number[]) => {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days.sort().map(d => dayNames[d]).join(', ');
  };

  const groupedShifts = shifts.reduce((acc, shift) => {
    const locationName = shift.departments?.locations?.name || 'Unknown Location';
    const deptName = shift.departments?.name || 'Unknown Department';
    const key = `${locationName} → ${deptName}`;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(shift);
    return acc;
  }, {} as Record<string, Shift[]>);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Shift Templates</span>
              <Button onClick={() => { setEditingId(undefined); setFormDialogOpen(true); }} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Create Shift
              </Button>
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-auto space-y-4 pr-2">
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : Object.keys(groupedShifts).length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  No shifts created yet. Click "Create Shift" to get started.
                </CardContent>
              </Card>
            ) : (
              Object.entries(groupedShifts).map(([deptName, deptShifts]) => (
                <Card key={deptName}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      {deptName}
                      <Badge variant="secondary">{deptShifts.length} shifts</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Shift Name</TableHead>
                          <TableHead>Time</TableHead>
                          <TableHead>Days</TableHead>
                          <TableHead>Assigned Users</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {deptShifts.map(shift => (
                          <TableRow key={shift.id}>
                            <TableCell className="font-medium">{shift.name}</TableCell>
                            <TableCell>
                              {formatTime(shift.start_time)} - {formatTime(shift.end_time)}
                            </TableCell>
                            <TableCell>{getDaysDisplay(shift.days_of_week)}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Users className="h-4 w-4 text-muted-foreground" />
                                <span>{shift.user_count}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => { setEditingId(shift.id); setFormDialogOpen(true); }}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleDelete(shift.id)}
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
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={formDialogOpen} onOpenChange={setFormDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Shift' : 'Create Shift'}</DialogTitle>
          </DialogHeader>
          <ShiftForm
            shiftId={editingId}
            onSuccess={() => { setFormDialogOpen(false); loadShifts(); }}
            onCancel={() => setFormDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
