import { useEffect, useState, useMemo } from 'react';
import { PageSkeleton } from '@/components/PageSkeleton';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, ArrowLeft, Search, RotateCcw } from 'lucide-react';
import { TaskRoutineForm } from '@/components/TaskRoutineForm';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useUserRole } from '@/hooks/useUserRole';

interface TaskRoutine {
  id: string;
  title: string;
  description: string | null;
  est_minutes: number;
  criticality: number;
  required_proof: string;
  steps: any;
  department_id: string | null;
  archived_at: string | null;
  departments?: { name: string } | null;
}

interface Department {
  id: string;
  name: string;
}

export default function TaskRoutines() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const [routines, setRoutines] = useState<TaskRoutine[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRoutine, setEditingRoutine] = useState<TaskRoutine | null>(null);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    checkAuth();
    fetchRoutines();
    fetchDepartments();
  }, [showArchived]);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate('/auth');
    }
  };

  const fetchDepartments = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('org_id')
      .eq('id', user.id)
      .single();

    if (!profile?.org_id) return;

    const { data } = await supabase
      .from('departments')
      .select('id, name')
      .is('archived_at', null)
      .order('name');

    setDepartments(data || []);
  };

  const fetchRoutines = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profile } = await supabase
        .from('profiles')
        .select('org_id')
        .eq('id', user.id)
        .single();

      if (!profile?.org_id) throw new Error('No organization found');

      let query = supabase
        .from('task_routines')
        .select('*, departments(name)')
        .eq('org_id', profile.org_id)
        .order('title');

      if (!showArchived) {
        query = query.is('archived_at', null);
      }

      const { data, error } = await query;

      if (error) throw error;
      setRoutines(data || []);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredRoutines = useMemo(() => {
    return routines.filter((routine) => {
      const matchesSearch = !searchQuery ||
        routine.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        routine.description?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesDept = departmentFilter === 'all' ||
        routine.department_id === departmentFilter;

      return matchesSearch && matchesDept;
    });
  }, [routines, searchQuery, departmentFilter]);

  const handleArchive = async (id: string) => {
    if (!confirm('Are you sure you want to archive this routine?')) return;

    try {
      const { error } = await supabase
        .from('task_routines')
        .update({ archived_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;

      toast({ title: 'Success', description: 'Routine archived' });
      fetchRoutines();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleRestore = async (id: string) => {
    try {
      const { error } = await supabase
        .from('task_routines')
        .update({ archived_at: null })
        .eq('id', id);

      if (error) throw error;

      toast({ title: 'Success', description: 'Routine restored' });
      fetchRoutines();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleEdit = (routine: TaskRoutine) => {
    setEditingRoutine(routine);
    setDialogOpen(true);
  };

  const handleCreate = () => {
    setEditingRoutine(null);
    setDialogOpen(true);
  };

  const handleFormSuccess = async () => {
    setDialogOpen(false);
    setEditingRoutine(null);

    toast({
      title: 'Success',
      description: 'Routine saved successfully',
    });

    fetchRoutines();
  };

  if (roleLoading || loading) {
    return <PageSkeleton />;
  }

  if (!isAdmin()) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card>
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>You don't have permission to view this page.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Task Routines</CardTitle>
                <CardDescription>Manage reusable task routines</CardDescription>
              </div>
              <Button onClick={handleCreate}>
                <Plus className="mr-2 h-4 w-4" />
                Create Routine
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-4 mb-4">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search routines..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="All Departments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex items-center gap-2">
                <Switch
                  id="show-archived"
                  checked={showArchived}
                  onCheckedChange={setShowArchived}
                />
                <Label htmlFor="show-archived" className="text-sm">Show archived</Label>
              </div>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Est. Minutes</TableHead>
                  <TableHead>Criticality</TableHead>
                  <TableHead>Required Proof</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRoutines.map((routine) => (
                  <TableRow key={routine.id} className={routine.archived_at ? 'opacity-60' : ''}>
                    <TableCell className="font-medium">{routine.title}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {(routine.departments as any)?.name || '—'}
                    </TableCell>
                    <TableCell>{routine.est_minutes}</TableCell>
                    <TableCell>{routine.criticality}/5</TableCell>
                    <TableCell className="capitalize">{routine.required_proof}</TableCell>
                    <TableCell>
                      {routine.archived_at ? (
                        <Badge variant="secondary">Archived</Badge>
                      ) : (
                        <Badge variant="default">Active</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {routine.archived_at ? (
                          <Button variant="outline" size="sm" onClick={() => handleRestore(routine.id)}>
                            <RotateCcw className="h-4 w-4 mr-1" />
                            Restore
                          </Button>
                        ) : (
                          <>
                            <Button variant="ghost" size="sm" onClick={() => handleEdit(routine)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleArchive(routine.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredRoutines.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      {searchQuery || departmentFilter !== 'all'
                        ? 'No routines match your filters.'
                        : 'No routines found. Create your first routine to get started.'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingRoutine ? 'Edit Routine' : 'Create Routine'}
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              {editingRoutine ? 'Modify the routine details below.' : 'Define a new reusable task routine for your team.'}
            </DialogDescription>
          </DialogHeader>
          <TaskRoutineForm
            template={editingRoutine}
            onSuccess={handleFormSuccess}
            onCancel={() => setDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
