import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { UrgencyBadge } from './UrgencyBadge';
import { formatDistanceToNow, format } from 'date-fns';
import { Clock, MapPin, User, FileCheck } from 'lucide-react';

interface TaskInstanceDetailsProps {
  task: any;
  open: boolean;
  onClose: () => void;
}

export function TaskInstanceDetails({ task, open, onClose }: TaskInstanceDetailsProps) {
  if (!task) return null;

  const template = task.task_templates;

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

          {task.completions && task.completions.length > 0 && (
            <div>
              <h3 className="font-semibold mb-2">Completion History</h3>
              {task.completions.map((completion: any) => (
                <div key={completion.id} className="border rounded-lg p-3 space-y-2">
                  <p className="text-sm">
                    <span className="text-muted-foreground">Completed by:</span>{' '}
                    {completion.profiles?.display_name || 'Unknown'}
                  </p>
                  <p className="text-sm">
                    <span className="text-muted-foreground">Time:</span>{' '}
                    {format(new Date(completion.created_at), 'PPp')}
                  </p>
                  {completion.note && (
                    <p className="text-sm">
                      <span className="text-muted-foreground">Note:</span> {completion.note}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
