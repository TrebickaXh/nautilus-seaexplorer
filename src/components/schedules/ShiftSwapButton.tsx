import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SwapRequestDialog } from "./SwapRequestDialog";
import { Repeat2 } from "lucide-react";

interface ShiftSwapButtonProps {
  assignmentId: string;
  shiftDetails: any;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg";
}

export function ShiftSwapButton({ assignmentId, shiftDetails, variant = "outline", size = "sm" }: ShiftSwapButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={() => setOpen(true)}
      >
        <Repeat2 className="w-4 h-4 mr-1" />
        Request Swap
      </Button>
      <SwapRequestDialog
        open={open}
        onOpenChange={setOpen}
        assignmentId={assignmentId}
        shiftDetails={shiftDetails}
      />
    </>
  );
}
