import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SkipTaskDialogProps {
  taskId: string | null;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function SkipTaskDialog({ taskId, open, onClose, onSuccess }: SkipTaskDialogProps) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!taskId || !reason.trim()) {
      toast.error('Please provide a reason');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('task_instances')
        .update({ 
          status: 'skipped',
          // Store reason in a note - we could add a skip_reason column if needed
        })
        .eq('id', taskId);

      if (error) throw error;

      toast.success('Task marked as skipped');
      setReason('');
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Skip Task</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="reason">Reason for skipping (required)</Label>
            <Textarea
              id="reason"
              placeholder="Explain why this task is being skipped..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              className="mt-2"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading || !reason.trim()}>
            {loading ? 'Skipping...' : 'Skip Task'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
