import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';
import { Plus, X } from 'lucide-react';
import { z } from 'zod';

const templateSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200, "Title must be less than 200 characters"),
  description: z.string().max(1000, "Description must be less than 1000 characters").optional(),
  est_minutes: z.number().min(1, "Estimated time must be at least 1 minute").max(480, "Estimated time must be less than 8 hours"),
  steps: z.array(z.string().max(500, "Step must be less than 500 characters")).max(20, "Maximum 20 steps allowed"),
});

interface TaskTemplateFormProps {
  template?: any;
  onSuccess: () => void;
  onCancel: () => void;
}

export const TaskTemplateForm = ({ template, onSuccess, onCancel }: TaskTemplateFormProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: template?.title || '',
    description: template?.description || '',
    est_minutes: template?.est_minutes || 15,
    criticality: template?.criticality || 3,
    required_proof: template?.required_proof || 'none',
    steps: template?.steps || [],
  });
  const [newStep, setNewStep] = useState('');

  const handleAddStep = () => {
    const trimmed = newStep.trim();
    if (!trimmed) return;
    
    if (trimmed.length > 500) {
      toast({
        title: 'Error',
        description: 'Step must be less than 500 characters',
        variant: 'destructive',
      });
      return;
    }
    
    if (formData.steps.length >= 20) {
      toast({
        title: 'Error',
        description: 'Maximum 20 steps allowed',
        variant: 'destructive',
      });
      return;
    }
    
    setFormData({ ...formData, steps: [...formData.steps, trimmed] });
    setNewStep('');
  };

  const handleRemoveStep = (index: number) => {
    setFormData({
      ...formData,
      steps: formData.steps.filter((_: any, i: number) => i !== index),
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate input
      const result = templateSchema.safeParse(formData);
      if (!result.success) {
        const firstError = result.error.errors[0];
        toast({
          title: 'Validation Error',
          description: firstError.message,
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('org_id')
        .single();

      if (!profile?.org_id) throw new Error('No organization found');

      const payload = {
        ...formData,
        title: formData.title.trim(),
        description: formData.description?.trim(),
        org_id: profile.org_id,
      };

      if (template?.id) {
        const { error } = await supabase
          .from('task_templates')
          .update(payload)
          .eq('id', template.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('task_templates')
          .insert(payload);
        if (error) throw error;
      }

      toast({
        title: 'Success',
        description: `Template ${template ? 'updated' : 'created'} successfully`,
      });
      onSuccess();
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

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="title">Title *</Label>
        <Input
          id="title"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          required
        />
      </div>

      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          rows={3}
        />
      </div>

      <div>
        <Label>Steps</Label>
        <div className="space-y-2">
          {formData.steps.map((step: string, index: number) => (
            <div key={index} className="flex items-center gap-2">
              <Input value={step} disabled />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleRemoveStep(index)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <Input
              value={newStep}
              onChange={(e) => setNewStep(e.target.value)}
              placeholder="Add a step..."
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddStep();
                }
              }}
            />
            <Button type="button" variant="outline" size="sm" onClick={handleAddStep}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div>
        <Label htmlFor="est_minutes">Estimated Minutes</Label>
        <Input
          id="est_minutes"
          type="number"
          min={1}
          value={formData.est_minutes}
          onChange={(e) => setFormData({ ...formData, est_minutes: parseInt(e.target.value) })}
          required
        />
      </div>

      <div>
        <Label>Criticality: {formData.criticality}/5</Label>
        <Slider
          value={[formData.criticality]}
          onValueChange={(value) => setFormData({ ...formData, criticality: value[0] })}
          min={1}
          max={5}
          step={1}
          className="mt-2"
        />
      </div>

      <div>
        <Label htmlFor="required_proof">Required Proof</Label>
        <Select
          value={formData.required_proof}
          onValueChange={(value) => setFormData({ ...formData, required_proof: value })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            <SelectItem value="photo">Photo</SelectItem>
            <SelectItem value="note">Note</SelectItem>
            <SelectItem value="dual">Dual Sign-off</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? 'Saving...' : template ? 'Update' : 'Create'}
        </Button>
      </div>
    </form>
  );
};
