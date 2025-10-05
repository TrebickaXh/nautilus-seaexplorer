import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { UrgencyBadge } from './UrgencyBadge';
import { formatDistanceToNow, format } from 'date-fns';
import { Clock, MapPin, User, FileCheck, CheckCircle2, Image as ImageIcon } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface TaskInstanceDetailsProps {
  task: any;
  open: boolean;
  onClose: () => void;
}

export function TaskInstanceDetails({ task, open, onClose }: TaskInstanceDetailsProps) {
  const [completions, setCompletions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (task?.id && open) {
      loadCompletions();
    }
  }, [task?.id, open]);

  const loadCompletions = async () => {
    if (!task?.id) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('completions')
        .select(`
          *,
          profiles:user_id (display_name),
          cosigner:cosigner_user_id (display_name)
        `)
        .eq('task_instance_id', task.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCompletions(data || []);
    } catch (error) {
      console.error('Error loading completions:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!task) return null;

  const template = task.task_routines;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">{template?.title || 'Task Details'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div>
            <h3 className="font-semibold mb-2">Description</h3>
            <p className="text-muted-foreground">{template?.description || 'No description'}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Location</p>
                <p className="font-medium">{task.locations?.name}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Estimated Time</p>
                <p className="font-medium">{template?.est_minutes} minutes</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Assigned Role</p>
                <p className="font-medium">{task.assigned_role || 'crew'}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <FileCheck className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Required Proof</p>
                <p className="font-medium">{template?.required_proof || 'none'}</p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Status & Urgency</h3>
            <div className="flex items-center gap-4">
              <Badge>{task.status}</Badge>
              <UrgencyBadge score={task.urgency_score || 0.5} />
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Timeline</h3>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-muted-foreground">Due:</span>{' '}
                <span className="font-medium">
                  {format(new Date(task.due_at), 'PPp')} ({formatDistanceToNow(new Date(task.due_at), { addSuffix: true })})
                </span>
              </div>
              {task.window_start && task.window_end && (
                <div>
                  <span className="text-muted-foreground">Window:</span>{' '}
                  <span className="font-medium">
                    {format(new Date(task.window_start), 'p')} - {format(new Date(task.window_end), 'p')}
                  </span>
                </div>
              )}
              {task.completed_at && (
                <div>
                  <span className="text-muted-foreground">Completed:</span>{' '}
                  <span className="font-medium">{format(new Date(task.completed_at), 'PPp')}</span>
                </div>
              )}
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Criticality Level</h3>
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map(level => (
                  <div
                    key={level}
                    className={`h-3 w-8 rounded ${
                      level <= (template?.criticality || 3) ? 'bg-primary' : 'bg-muted'
                    }`}
                  />
                ))}
              </div>
              <span className="text-sm text-muted-foreground">
                {template?.criticality || 3} / 5
              </span>
            </div>
          </div>

          {template?.steps && template.steps.length > 0 && (
            <div>
              <h3 className="font-semibold mb-2">Steps</h3>
              <ol className="list-decimal list-inside space-y-2">
                {template.steps.map((step: any, idx: number) => (
                  <li key={idx} className="text-sm">{step.description || step}</li>
                ))}
              </ol>
            </div>
          )}

          {completions.length > 0 && (
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                Completion History
              </h3>
              <div className="space-y-4">
                {completions.map((completion: any) => (
                  <Card key={completion.id} className="p-4">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium">
                            {completion.profiles?.display_name || 'Unknown User'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(completion.created_at), 'PPp')}
                          </p>
                        </div>
                        {completion.cosigner && (
                          <Badge variant="secondary">
                            Co-signed by {completion.cosigner.display_name}
                          </Badge>
                        )}
                      </div>

                      {completion.note && (
                        <div className="bg-muted/50 rounded-lg p-3">
                          <p className="text-sm font-medium mb-1">Note:</p>
                          <p className="text-sm text-muted-foreground">{completion.note}</p>
                        </div>
                      )}

                      {completion.photo_url && (
                        <div>
                          <p className="text-sm font-medium mb-2 flex items-center gap-2">
                            <ImageIcon className="h-4 w-4" />
                            Photo Evidence
                          </p>
                          <img
                            src={completion.photo_url}
                            alt="Completion proof"
                            className="w-full max-w-md rounded-lg border"
                          />
                        </div>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {loading && (
            <div className="text-center py-4 text-sm text-muted-foreground">
              Loading completion history...
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
