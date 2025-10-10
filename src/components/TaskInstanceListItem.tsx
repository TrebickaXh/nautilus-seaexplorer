import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { UrgencyBadge } from './UrgencyBadge';
import { MoreVertical, Eye, SkipForward, Trash2, CheckCircle2 } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { formatDistanceToNow } from 'date-fns';

interface TaskInstanceListItemProps {
  task: any;
  onViewDetails: () => void;
  onSkip: () => void;
  onComplete: () => void;
  onDelete?: () => void;
  isAdmin: boolean;
}

export function TaskInstanceListItem({ task, onViewDetails, onSkip, onComplete, onDelete, isAdmin }: TaskInstanceListItemProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'done': return 'default';
      case 'skipped': return 'secondary';
      default: return 'outline';
    }
  };

  const isOverdue = task.status === 'pending' && task.due_at && new Date(task.due_at) < new Date();
  const timeUntilDue = task.due_at ? formatDistanceToNow(new Date(task.due_at), { addSuffix: true }) : 'No due date';

  return (
    <div className={`flex items-center gap-4 p-4 border rounded-lg hover:shadow-md transition-shadow ${isOverdue ? 'border-destructive border-2' : ''}`}>
      {/* Left side - Task info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-base truncate">{task.task_routines?.title || 'Untitled Task'}</h3>
            <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-muted-foreground">
              <span>{task.locations?.name}</span>
              {task.areas?.name && (
                <>
                  <span>•</span>
                  <span>{task.areas.name}</span>
                </>
              )}
              {task.departments?.name && (
                <>
                  <span>•</span>
                  <span>{task.departments.name}</span>
                </>
              )}
              {task.shifts?.name && (
                <>
                  <span>•</span>
                  <span>{task.shifts.name}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Middle - Time and urgency */}
      <div className="flex flex-col items-end gap-2 min-w-[120px]">
        <span className="text-sm text-muted-foreground whitespace-nowrap">Due {timeUntilDue}</span>
        <UrgencyBadge score={task.urgency_score || 0.5} />
      </div>

      {/* Right side - Status and actions */}
      <div className="flex items-center gap-3">
        <div className="flex gap-2">
          {isOverdue && <Badge variant="destructive">OVERDUE</Badge>}
          <Badge variant={getStatusColor(task.status)}>{task.status}</Badge>
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
    </div>
  );
}
