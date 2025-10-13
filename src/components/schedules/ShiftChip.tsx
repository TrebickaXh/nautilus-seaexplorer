import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { ShiftDetailsDrawer } from "./ShiftDetailsDrawer";
import { ConflictIndicator } from "./ConflictIndicator";

interface ShiftChipProps {
  shift: any;
  isOpen?: boolean;
}

export function ShiftChip({ shift, isOpen }: ShiftChipProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const startTime = format(new Date(shift.start_at), "HH:mm");
  const endTime = format(new Date(shift.end_at), "HH:mm");

  // Detect conflicts
  const conflicts = [];
  if (shift.has_claims) {
    conflicts.push({
      type: "availability" as const,
      message: "Has pending claims that need review",
    });
  }

  return (
    <>
      <div
        className={cn(
          "p-2 rounded border text-xs cursor-pointer hover:shadow-md transition-shadow",
          isOpen ? "bg-primary/10 border-primary" : "bg-card border-border"
        )}
        onClick={() => setDetailsOpen(true)}
      >
      <div className="flex items-center justify-between gap-1 mb-1">
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          <span className="font-medium">
            {startTime}–{endTime}
          </span>
        </div>
        {conflicts.length > 0 && <ConflictIndicator conflicts={conflicts} />}
      </div>

      {shift.position_name && (
        <div className="text-muted-foreground truncate">{shift.position_name}</div>
      )}

      <div className="flex gap-1 mt-1 flex-wrap">
        {shift.status === "pending_swap" && (
          <Badge variant="outline" className="text-[10px] px-1 py-0">
            Swap
          </Badge>
        )}
        {shift.requires_skills && shift.requires_skills.length > 0 && (
          <Badge variant="secondary" className="text-[10px] px-1 py-0">
            Skills
          </Badge>
        )}
        {shift.has_claims && (
          <Badge variant="default" className="text-[10px] px-1 py-0">
            Claims
          </Badge>
        )}
      </div>
      </div>

      <ShiftDetailsDrawer
        shift={shift}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
      />
    </>
  );
}
