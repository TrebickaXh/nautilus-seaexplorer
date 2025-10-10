import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { UrgencyBadge } from './UrgencyBadge';
import { MoreVertical, Eye, SkipForward, Trash2, CheckCircle2, Copy } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

interface TaskInstanceCardProps {
  task: any;
  onViewDetails: () => void;
  onSkip: () => void;
  onComplete: () => void;
  onDelete?: () => void;
  isAdmin: boolean;
}

export function TaskInstanceCard({ task, onViewDetails, onSkip, onComplete, onDelete, isAdmin }: TaskInstanceCardProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'done': return 'default';
      case 'skipped': return 'secondary';
      default: return 'outline';
    }
  };

  const copyTaskId = () => {
    navigator.clipboard.writeText(task.id);
    toast.success('Task ID copied to clipboard');
  };

  const isOverdue = task.status === 'pending' && task.due_at && new Date(task.due_at) < new Date();
  const timeUntilDue = task.due_at ? formatDistanceToNow(new Date(task.due_at), { addSuffix: true }) : 'No due date';

  return (
    <Card className={`hover:shadow-lg transition-shadow ${isOverdue ? 'border-destructive border-2' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg">{task.task_routines?.title || 'Untitled Task'}</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {task.locations?.name} {task.areas?.name && `• ${task.areas.name}`}
            </p>
            {(task.departments?.name || task.shifts?.name) && (
              <p className="text-xs text-muted-foreground mt-1">
                {task.departments?.name}
                {task.shifts?.name && ` • ${task.shifts.name}`}
              </p>
            )}
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">
                ID: {task.id.slice(0, 8)}...
              </span>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-6 w-6 p-0" 
                onClick={copyTaskId}
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onViewDetails}>
                <Eye className="h-4 w-4 mr-2" />
                View Details
              </DropdownMenuItem>
              {task.status === 'pending' && (
                <>
                  <DropdownMenuItem onClick={onComplete}>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Complete Task
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onSkip}>
                    <SkipForward className="h-4 w-4 mr-2" />
                    Skip Task
                  </DropdownMenuItem>
                </>
              )}
              {isAdmin && onDelete && (
                <DropdownMenuItem onClick={onDelete} className="text-destructive">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Due {timeUntilDue}</span>
            <div className="flex gap-2">
              {isOverdue && <Badge variant="destructive">OVERDUE</Badge>}
              <Badge variant={getStatusColor(task.status)}>{task.status}</Badge>
            </div>
          </div>
          
          {task.window_start && task.window_end && (
            <div className="text-xs text-muted-foreground">
              Window: {new Date(task.window_start).toLocaleTimeString()} - {new Date(task.window_end).toLocaleTimeString()}
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <UrgencyBadge score={task.urgency_score || 0.5} />
            {task.assigned_role && (
              <span className="text-xs text-muted-foreground">
                Assigned to: {task.assigned_role}
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
