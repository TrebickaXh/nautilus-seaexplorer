import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface AreaFormProps {
  locationId: string;
  area?: any;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function AreaForm({ locationId, area, open, onClose, onSuccess }: AreaFormProps) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (area) {
      setName(area.name || '');
    } else {
      setName('');
    }
  }, [area, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error('Area name is required');
      return;
    }

    setSaving(true);

    try {
      const areaData = {
        name: name.trim(),
        location_id: locationId,
      };

      if (area) {
        // Update existing area
        const { error } = await supabase
          .from('areas')
          .update({ name: areaData.name })
          .eq('id', area.id);

        if (error) throw error;
        toast.success('Area updated');
      } else {
        // Create new area
        const { error } = await supabase
          .from('areas')
          .insert(areaData);

        if (error) throw error;
        toast.success('Area created');
      }

      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error saving area:', error);
      toast.error(error.message || 'Failed to save area');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{area ? 'Edit Area' : 'Create Area'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">
                Area Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Kitchen, Lobby, Storage Room"
                maxLength={200}
                required
              />
            </div>

            <p className="text-xs text-muted-foreground">
              Areas help organize tasks within a location
            </p>
          </div>

          <DialogFooter className="mt-6 gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                area ? 'Update' : 'Create'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
