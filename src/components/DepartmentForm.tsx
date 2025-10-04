import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

interface DepartmentFormProps {
  locationId: string;
  department?: any;
  onSuccess: () => void;
  onCancel: () => void;
}

export function DepartmentForm({ locationId, department, onSuccess, onCancel }: DepartmentFormProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: department?.name || '',
    description: department?.description || '',
  });

  useEffect(() => {
    if (department) {
      setFormData({
        name: department.name || '',
        description: department.description || '',
      });
    }
  }, [department]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        name: formData.name.trim(),
        description: formData.description?.trim() || null,
        location_id: locationId,
      };

      if (department) {
        // Update existing department
        const { error } = await supabase
          .from('departments')
          .update({
            name: payload.name,
            description: payload.description,
          })
          .eq('id', department.id);

        if (error) throw error;
        toast.success('Department updated');
      } else {
        // Create new department
        const { error } = await supabase
          .from('departments')
          .insert(payload);

        if (error) throw error;
        toast.success('Department created');
      }

      onSuccess();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="name">Department Name</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="e.g., Kitchen, Lobby, Storage Room"
          maxLength={200}
          required
        />
      </div>

      <div>
        <Label htmlFor="description">Description (optional)</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Brief description of this department"
          rows={3}
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? 'Saving...' : department ? 'Update' : 'Create'}
        </Button>
      </div>
    </form>
  );
}
