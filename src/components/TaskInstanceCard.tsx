import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { UrgencyBadge } from './UrgencyBadge';
import { MoreVertical, Eye, SkipForward, Trash2, CheckCircle2 } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { formatDistanceToNow } from 'date-fns';

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

  const timeUntilDue = task.due_at ? formatDistanceToNow(new Date(task.due_at), { addSuffix: true }) : 'No due date';

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg">{task.task_templates?.title || 'Untitled Task'}</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {task.locations?.name} {task.areas?.name && `• ${task.areas.name}`}
            </p>
            {(task.departments?.name || task.shifts?.name) && (
              <p className="text-xs text-muted-foreground mt-1">
                {task.departments?.name}
                {task.shifts?.name && ` • ${task.shifts.name}`}
              </p>
            )}
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
            <Badge variant={getStatusColor(task.status)}>{task.status}</Badge>
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
