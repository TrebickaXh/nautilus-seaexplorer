import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Building2 } from 'lucide-react';

interface Department {
  id: string;
  name: string;
  description?: string;
  locations?: {
    name: string;
    org_id: string;
  };
}

interface UserDepartmentAssignmentProps {
  userId: string;
  userName: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export function UserDepartmentAssignment({ 
  userId, 
  userName, 
  onSuccess, 
  onCancel 
}: UserDepartmentAssignmentProps) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDepts, setSelectedDepts] = useState<string[]>([]);
  const [primaryDept, setPrimaryDept] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, [userId]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Get user's org_id
      const { data: profile } = await supabase
        .from('profiles')
        .select('org_id')
        .eq('id', userId)
        .single();

      if (!profile) return;

      // Load all departments across all locations in org
      const { data: depts } = await supabase
        .from('departments')
        .select(`
          *,
          locations(name, org_id)
        `)
        .is('archived_at', null)
        .order('name');

      if (depts) {
        // Filter departments to only show those in the user's org
        const orgDepts = depts.filter(d => d.locations?.org_id === profile.org_id);
        setDepartments(orgDepts);
      }

      // Load user's current department assignments
      const { data: userDepts } = await supabase
        .from('user_departments')
        .select('department_id, is_primary')
        .eq('user_id', userId);

      if (userDepts) {
        const deptIds = userDepts.map(ud => ud.department_id);
        setSelectedDepts(deptIds);
        
        const primary = userDepts.find(ud => ud.is_primary);
        if (primary) {
          setPrimaryDept(primary.department_id);
        }
      }
    } catch (error: any) {
      console.error('Error loading data:', error);
      toast.error('Failed to load departments');
    } finally {
      setLoading(false);
    }
  };

  const handleDeptToggle = (deptId: string) => {
    setSelectedDepts(prev => {
      if (prev.includes(deptId)) {
        // If removing primary dept, clear primary selection
        if (deptId === primaryDept) {
          setPrimaryDept('');
        }
        return prev.filter(id => id !== deptId);
      } else {
        return [...prev, deptId];
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (selectedDepts.length === 0) {
        throw new Error('Please select at least one department');
      }

      if (!primaryDept) {
        throw new Error('Please select a primary department');
      }

      // Delete existing assignments
      await supabase
        .from('user_departments')
        .delete()
        .eq('user_id', userId);

      // Insert new assignments
      const assignments = selectedDepts.map(deptId => ({
        user_id: userId,
        department_id: deptId,
        is_primary: deptId === primaryDept,
      }));

      const { error } = await supabase
        .from('user_departments')
        .insert(assignments);

      if (error) throw error;

      toast.success('Department assignments updated');
      onSuccess();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Building2 className="h-4 w-4" />
          <span>Assigning departments for: <strong>{userName}</strong></span>
        </div>

        <div className="space-y-3">
          <Label>Select Departments</Label>
          {departments.map(dept => (
            <div key={dept.id} className="flex items-start space-x-3 p-3 rounded-lg border">
              <Checkbox
                id={`dept-${dept.id}`}
                checked={selectedDepts.includes(dept.id)}
                onCheckedChange={() => handleDeptToggle(dept.id)}
              />
              <div className="flex-1">
                <label
                  htmlFor={`dept-${dept.id}`}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  {dept.locations?.name ? `${dept.locations.name} - ${dept.name}` : dept.name}
                </label>
                {dept.description && (
                  <p className="text-xs text-muted-foreground mt-1">{dept.description}</p>
                )}
              </div>
            </div>
          ))}
        </div>

        {selectedDepts.length > 0 && (
          <div className="space-y-3 pt-4 border-t">
            <Label>Primary Department</Label>
            <RadioGroup value={primaryDept} onValueChange={setPrimaryDept}>
              {selectedDepts.map(deptId => {
                const dept = departments.find(d => d.id === deptId);
                if (!dept) return null;
                return (
                  <div key={deptId} className="flex items-center space-x-2">
                    <RadioGroupItem value={deptId} id={`primary-${deptId}`} />
                    <Label htmlFor={`primary-${deptId}`} className="font-normal cursor-pointer">
                      {dept.locations?.name ? `${dept.locations.name} - ${dept.name}` : dept.name}
                    </Label>
                  </div>
                );
              })}
            </RadioGroup>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading || selectedDepts.length === 0 || !primaryDept}>
          {loading ? 'Saving...' : 'Save Assignments'}
        </Button>
      </div>
    </form>
  );
}
