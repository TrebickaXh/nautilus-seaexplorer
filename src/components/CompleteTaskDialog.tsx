import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Camera, Upload, X, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface CompleteTaskDialogProps {
  taskId: string | null;
  taskTemplate: any;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CompleteTaskDialog({ taskId, taskTemplate, open, onClose, onSuccess }: CompleteTaskDialogProps) {
  const [note, setNote] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [pin, setPin] = useState('');

  const requiresPhoto = taskTemplate?.required_proof === 'photo' || taskTemplate?.required_proof === 'photo_and_note';
  const requiresNote = taskTemplate?.required_proof === 'note' || taskTemplate?.required_proof === 'photo_and_note';

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error('Photo must be smaller than 10MB');
        return;
      }
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
  };

  const handleComplete = async () => {
    if (!taskId) return;

    // Validation
    if (!displayName.trim()) {
      toast.error('Please enter your name');
      return;
    }

    if (!pin || pin.length < 4) {
      toast.error('Please enter your PIN (at least 4 digits)');
      return;
    }

    if (requiresPhoto && !photoFile) {
      toast.error('Photo is required for this task');
      return;
    }

    if (requiresNote && !note.trim()) {
      toast.error('Note is required for this task');
      return;
    }

    setUploading(true);

    try {
      // Verify PIN
      const { data: verifyData, error: verifyError } = await supabase.functions.invoke('verify-pin', {
        body: { pin },
      });

      if (verifyError || !verifyData?.success) {
        toast.error('Invalid PIN. Please try again.');
        setUploading(false);
        return;
      }

      const userId = verifyData.user.id;
      let photoUrl = null;

      // Upload photo if provided
      if (photoFile) {
        const fileExt = photoFile.name.split('.').pop();
        const fileName = `${userId}/${taskId}_${Date.now()}.${fileExt}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('task-photos')
          .upload(fileName, photoFile, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('task-photos')
          .getPublicUrl(fileName);

        photoUrl = publicUrl;
      }

      // Create completion record
      const { error: completionError } = await supabase
        .from('completions')
        .insert({
          task_instance_id: taskId,
          user_id: userId,
          note: note.trim() || null,
          photo_url: photoUrl
        });

      if (completionError) throw completionError;

      // Update task instance status
      const { error: updateError } = await supabase
        .from('task_instances')
        .update({
          status: 'done',
          completed_at: new Date().toISOString()
        })
        .eq('id', taskId);

      if (updateError) throw updateError;

      toast.success(`Task completed by ${displayName}!`);
      setNote('');
      setPhotoFile(null);
      setPhotoPreview(null);
      setDisplayName('');
      setPin('');
      onClose();
      onSuccess();
    } catch (error: any) {
      console.error('Error completing task:', error);
      toast.error(error.message || 'Failed to complete task');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Complete Task</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {taskTemplate && (
            <div className="bg-muted p-3 rounded-lg">
              <p className="font-semibold">{taskTemplate.title}</p>
              {taskTemplate.required_proof !== 'none' && (
                <p className="text-sm text-muted-foreground mt-1">
                  Required: {taskTemplate.required_proof.replace(/_/g, ' ')}
                </p>
              )}
            </div>
          )}

          {/* User Verification */}
          <div className="space-y-3 p-3 border rounded-lg bg-muted/50">
            <p className="text-sm font-medium">Complete this task as:</p>
            <div className="space-y-2">
              <Label htmlFor="displayName">
                Your Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Enter your name"
                disabled={uploading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pin">
                PIN <span className="text-destructive">*</span>
              </Label>
              <Input
                id="pin"
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="Enter your PIN"
                maxLength={6}
                disabled={uploading}
              />
            </div>
          </div>

          {/* Photo Upload */}
          <div className="space-y-2">
            <Label htmlFor="photo">
              Photo {requiresPhoto && <span className="text-destructive">*</span>}
            </Label>
            
            {photoPreview ? (
              <div className="relative">
                <img 
                  src={photoPreview} 
                  alt="Task completion proof" 
                  className="w-full h-48 object-cover rounded-lg"
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="absolute top-2 right-2"
                  onClick={removePhoto}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Label
                  htmlFor="photo-upload"
                  className="flex-1 flex items-center justify-center gap-2 border-2 border-dashed rounded-lg p-4 cursor-pointer hover:bg-muted transition-colors"
                >
                  <Upload className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Upload Photo</span>
                </Label>
                <Input
                  id="photo-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoChange}
                />
                
                <Label
                  htmlFor="photo-camera"
                  className="flex items-center justify-center gap-2 border-2 border-dashed rounded-lg p-4 cursor-pointer hover:bg-muted transition-colors"
                >
                  <Camera className="h-5 w-5 text-muted-foreground" />
                </Label>
                <Input
                  id="photo-camera"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handlePhotoChange}
                />
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="note">
              Notes {requiresNote && <span className="text-destructive">*</span>}
            </Label>
            <Textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add any notes about this task completion..."
              rows={4}
              maxLength={1000}
            />
            <p className="text-xs text-muted-foreground text-right">
              {note.length}/1000
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={uploading}>
            Cancel
          </Button>
          <Button onClick={handleComplete} disabled={uploading}>
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Completing...
              </>
            ) : (
              'Complete Task'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
