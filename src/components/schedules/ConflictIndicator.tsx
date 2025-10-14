import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertTriangle, Clock, Users } from "lucide-react";

interface ConflictIndicatorProps {
  conflicts: {
    type: "overlap" | "rest_violation" | "overtime" | "availability";
    message: string;
  }[];
}

interface ConflictIndicatorWithActionsProps extends ConflictIndicatorProps {
  onResolve?: () => void;
  showActions?: boolean;
}

export function ConflictIndicator({ conflicts, onResolve, showActions = false }: ConflictIndicatorWithActionsProps) {
  if (!conflicts || conflicts.length === 0) return null;

  const hasError = conflicts.some((c) => c.type === "overlap" || c.type === "rest_violation");
  const hasWarning = conflicts.some((c) => c.type === "overtime" || c.type === "availability");

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant={hasError ? "destructive" : "secondary"}
            className="gap-1 cursor-help"
            onClick={(e) => {
              if (showActions && onResolve) {
                e.stopPropagation();
                onResolve();
              }
            }}
          >
            <AlertTriangle className="w-3 h-3" />
            {conflicts.length} {conflicts.length === 1 ? "Issue" : "Issues"}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-sm">
          <div className="space-y-2">
            {conflicts.map((conflict, idx) => {
              const Icon =
                conflict.type === "rest_violation"
                  ? Clock
                  : conflict.type === "overtime"
                  ? Clock
                  : conflict.type === "availability"
                  ? Users
                  : AlertTriangle;

              return (
                <div key={idx} className="flex items-start gap-2 text-sm">
                  <Icon className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{conflict.message}</span>
                </div>
              );
            })}
            {showActions && onResolve && (
              <div className="pt-2 border-t mt-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onResolve();
                  }}
                  className="text-xs text-primary hover:underline"
                >
                  Click to resolve →
                </button>
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
