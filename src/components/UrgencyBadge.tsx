import { Badge } from '@/components/ui/badge';
import { getUrgencyLevel } from '@/lib/urgency';

interface UrgencyBadgeProps {
  score: number;
}

export const UrgencyBadge = ({ score }: UrgencyBadgeProps) => {
  const level = getUrgencyLevel(score);
  
  const variant = {
    low: 'secondary' as const,
    medium: 'default' as const,
    high: 'default' as const,
    critical: 'destructive' as const,
  }[level];

  const colorClass = {
    low: 'bg-muted text-muted-foreground',
    medium: 'bg-accent text-accent-foreground',
    high: 'bg-warning text-warning-foreground',
    critical: 'bg-destructive text-destructive-foreground',
  }[level];

  return (
    <Badge variant={variant} className={colorClass}>
      {level.toUpperCase()} ({score.toFixed(2)})
    </Badge>
  );
};
