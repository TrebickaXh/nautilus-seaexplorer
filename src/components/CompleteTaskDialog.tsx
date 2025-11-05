import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Camera, Upload, X, Loader2, User, Shield } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

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
  const [pin, setPin] = useState('');
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [showPinInput, setShowPinInput] = useState(false);

  const requiresPhoto = taskTemplate?.required_proof === 'photo' || taskTemplate?.required_proof === 'photo_and_note';
  const requiresNote = taskTemplate?.required_proof === 'note' || taskTemplate?.required_proof === 'photo_and_note';

  // Load team members when dialog opens
  useEffect(() => {
    if (open && taskId) {
      loadTeamMembers();
    } else {
      // Reset state when dialog closes
      setSelectedUser(null);
      setShowPinInput(false);
      setPin('');
      setNote('');
      setPhotoFile(null);
      setPhotoPreview(null);
    }
  }, [open, taskId]);

  const loadTeamMembers = async () => {
    if (!taskId) return;
    
    setLoadingMembers(true);
    try {
      // Get task details to find location/department/shift
      const { data: task } = await supabase
        .from('task_instances')
        .select('location_id, department_id, shift_id')
        .eq('id', taskId)
        .single();

      if (!task) return;

      // Get organization for this task
      const { data: location } = await supabase
        .from('locations')
        .select('org_id')
        .eq('id', task.location_id)
        .single();

      if (!location) return;

      // Build query for team members
      let query = supabase
        .from('profiles')
        .select(`
          id,
          display_name,
          user_roles (role),
          user_shifts (shift_id),
          user_departments (department_id)
        `)
        .eq('org_id', location.org_id)
        .eq('active', true);

      const { data: members, error } = await query;

      if (error) throw error;

      // Filter to relevant members: admins OR users assigned to task's shift/department
      const relevantMembers = members?.filter((member: any) => {
        // Include org admins
        const isAdmin = member.user_roles?.some((r: any) => r.role === 'org_admin');
        if (isAdmin) return true;

        // Include users assigned to this shift
        if (task.shift_id && member.user_shifts?.some((s: any) => s.shift_id === task.shift_id)) {
          return true;
        }

        // Include users in this department
        if (task.department_id && member.user_departments?.some((d: any) => d.department_id === task.department_id)) {
          return true;
        }

        return false;
      }) || [];

      setTeamMembers(relevantMembers);
    } catch (error) {
      console.error('Error loading team members:', error);
      toast.error('Failed to load team members');
    } finally {
      setLoadingMembers(false);
    }
  };

  const handleUserSelect = (user: any) => {
    setSelectedUser(user);
    setShowPinInput(true);
    setPin('');
  };

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
    if (!taskId || !selectedUser) return;

    // Validation
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
      let photoUrl = null;

      // Upload photo if provided
      if (photoFile) {
        const fileExt = photoFile.name.split('.').pop();
        const fileName = `${selectedUser.id}/${taskId}_${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
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

      // Use the complete-task edge function
      const { data, error } = await supabase.functions.invoke('complete-task', {
        body: {
          taskInstanceId: taskId,
          userId: selectedUser.id,
          pin: pin,
          outcome: 'completed',
          note: note.trim() || null,
          photoUrl: photoUrl
        }
      });

      if (error) {
        // Handle specific error messages
        if (error.message?.includes('does not have a PIN set')) {
          toast.error(`${selectedUser.display_name} does not have a PIN set. Please ask an admin to set one in the Users page.`, {
            duration: 5000
          });
        } else if (error.message?.includes('Invalid PIN')) {
          toast.error('Invalid PIN. Please try again.');
        } else {
          throw error;
        }
        return;
      }

      toast.success(`Task completed by ${selectedUser.display_name}!`);
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
      <DialogContent className="sm:max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Complete Task</DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-8rem)] pr-4">
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

            {/* Team Member Selection */}
            {!showPinInput ? (
              <div className="space-y-3">
                <Label>Select Team Member</Label>
                {loadingMembers ? (
                  <div className="flex items-center justify-center p-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : teamMembers.length === 0 ? (
                  <div className="text-center p-6 border rounded-lg">
                    <p className="text-muted-foreground">No team members available</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                    {teamMembers.map((member) => {
                      const isAdmin = member.user_roles?.some((r: any) => r.role === 'org_admin');
                      return (
                        <Button
                          key={member.id}
                          variant="outline"
                          className="h-auto p-4 flex flex-col items-start gap-2"
                          onClick={() => handleUserSelect(member)}
                        >
                          <div className="flex items-center gap-2 w-full">
                            <User className="h-4 w-4" />
                            <span className="font-medium truncate">{member.display_name}</span>
                          </div>
                          {isAdmin && (
                            <Badge variant="secondary" className="text-xs">
                              <Shield className="h-3 w-3 mr-1" />
                              Admin
                            </Badge>
                          )}
                        </Button>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3 p-3 border rounded-lg bg-muted/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    <span className="font-medium">{selectedUser?.display_name}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowPinInput(false);
                      setSelectedUser(null);
                      setPin('');
                    }}
                  >
                    Change
                  </Button>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pin">
                    Enter PIN <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="pin"
                    type="password"
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="Enter 4-6 digit PIN"
                    maxLength={6}
                    disabled={uploading}
                    autoFocus
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter the PIN for {selectedUser?.display_name}
                  </p>
                </div>
              </div>
            )}

            {/* Photo Upload - Only show if user is selected */}
            {showPinInput && (
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
                      disabled={uploading}
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
                      disabled={uploading}
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
                      disabled={uploading}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Notes - Only show if user is selected */}
            {showPinInput && (
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
                  disabled={uploading}
                />
                <p className="text-xs text-muted-foreground text-right">
                  {note.length}/1000
                </p>
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={uploading}>
            Cancel
          </Button>
          <Button 
            onClick={handleComplete} 
            disabled={uploading || !selectedUser || !showPinInput}
          >
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
