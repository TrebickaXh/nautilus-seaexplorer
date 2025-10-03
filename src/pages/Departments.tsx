import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DepartmentForm } from '@/components/DepartmentForm';
import { ShiftForm } from '@/components/ShiftForm';
import { ArrowLeft, Plus, Edit, Trash2, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

export default function Departments() {
  const navigate = useNavigate();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const [departments, setDepartments] = useState<any[]>([]);
  const [shifts, setShifts] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [deptDialogOpen, setDeptDialogOpen] = useState(false);
  const [shiftDialogOpen, setShiftDialogOpen] = useState(false);
  const [editingDeptId, setEditingDeptId] = useState<string | undefined>();
  const [editingShiftId, setEditingShiftId] = useState<string | undefined>();
  const [selectedDeptId, setSelectedDeptId] = useState<string | undefined>();

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
    const { data: deptData } = await supabase
      .from('departments')
      .select('*')
      .is('archived_at', null)
      .order('name');

    if (deptData) {
      setDepartments(deptData);
      
      // Load shifts for each department
      const shiftsMap: Record<string, any[]> = {};
      for (const dept of deptData) {
        const { data: shiftData } = await supabase
          .from('shifts')
          .select('*')
          .eq('department_id', dept.id)
          .is('archived_at', null)
          .order('start_time');
        
        if (shiftData) {
          shiftsMap[dept.id] = shiftData;
        }
      }
      setShifts(shiftsMap);
    }
    setLoading(false);
  };

  const handleDeleteDept = async (id: string) => {
    if (!confirm('Archive this department? This will also archive all its shifts.')) return;

    const { error } = await supabase
      .from('departments')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Department archived');
      loadData();
    }
  };

  const handleDeleteShift = async (id: string) => {
    if (!confirm('Archive this shift?')) return;

    const { error } = await supabase
      .from('shifts')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Shift archived');
      loadData();
    }
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const h = parseInt(hours);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${displayH}:${minutes} ${ampm}`;
  };

  const getDaysDisplay = (days: number[]) => {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days.map(d => dayNames[d]).join(', ');
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
            <h1 className="text-3xl font-bold">Departments & Shifts</h1>
          </div>
          <Button onClick={() => { setEditingDeptId(undefined); setDeptDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Create Department
          </Button>
        </div>

        <div className="space-y-4">
          {departments.map(dept => (
            <Card key={dept.id}>
              <Collapsible>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <CollapsibleTrigger className="w-full text-left">
                        <CardTitle className="flex items-center gap-2">
                          {dept.name}
                          <Badge variant="outline">
                            {shifts[dept.id]?.length || 0} shifts
                          </Badge>
                        </CardTitle>
                        {dept.description && (
                          <p className="text-sm text-muted-foreground mt-1">{dept.description}</p>
                        )}
                      </CollapsibleTrigger>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedDeptId(dept.id);
                          setEditingShiftId(undefined);
                          setShiftDialogOpen(true);
                        }}
                      >
                        <Clock className="h-4 w-4 mr-2" />
                        Add Shift
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => { setEditingDeptId(dept.id); setDeptDialogOpen(true); }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteDept(dept.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CollapsibleContent>
                  <CardContent>
                    {shifts[dept.id]?.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Shift Name</TableHead>
                            <TableHead>Time</TableHead>
                            <TableHead>Days</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {shifts[dept.id].map(shift => (
                            <TableRow key={shift.id}>
                              <TableCell className="font-medium">{shift.name}</TableCell>
                              <TableCell>
                                {formatTime(shift.start_time)} - {formatTime(shift.end_time)}
                              </TableCell>
                              <TableCell>{getDaysDisplay(shift.days_of_week)}</TableCell>
                              <TableCell>
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                      setSelectedDeptId(dept.id);
                                      setEditingShiftId(shift.id);
                                      setShiftDialogOpen(true);
                                    }}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleDeleteShift(shift.id)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <p className="text-muted-foreground text-center py-4">
                        No shifts created yet. Click "Add Shift" to create one.
                      </p>
                    )}
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          ))}

          {departments.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">
                  No departments yet. Create your first department to get started.
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        <Dialog open={deptDialogOpen} onOpenChange={setDeptDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingDeptId ? 'Edit Department' : 'Create Department'}</DialogTitle>
            </DialogHeader>
            <DepartmentForm
              departmentId={editingDeptId}
              onSuccess={() => { setDeptDialogOpen(false); loadData(); }}
              onCancel={() => setDeptDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>

        <Dialog open={shiftDialogOpen} onOpenChange={setShiftDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingShiftId ? 'Edit Shift' : 'Create Shift'}</DialogTitle>
            </DialogHeader>
            <ShiftForm
              shiftId={editingShiftId}
              departmentId={selectedDeptId}
              onSuccess={() => { setShiftDialogOpen(false); loadData(); }}
              onCancel={() => setShiftDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
