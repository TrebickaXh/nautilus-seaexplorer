import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Download } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface ExportScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shifts: any[];
  employees: any[];
  weekStart: Date;
}

export function ExportScheduleDialog({
  open,
  onOpenChange,
  shifts,
  employees,
  weekStart,
}: ExportScheduleDialogProps) {
  const [includeUnassigned, setIncludeUnassigned] = useState(true);
  const [includeEmployeeInfo, setIncludeEmployeeInfo] = useState(true);
  const [includeHours, setIncludeHours] = useState(true);

  const exportToCSV = () => {
    try {
      const headers = ["Employee", "Position", "Date", "Start Time", "End Time", "Duration (hrs)", "Department"];
      const rows = [];

      shifts.forEach((shift) => {
        if (!includeUnassigned && !shift.employee_id) return;

        const employee = employees.find((e) => e.id === shift.employee_id);
        const startTime = format(new Date(shift.start_at), "HH:mm");
        const endTime = format(new Date(shift.end_at), "HH:mm");
        const date = format(new Date(shift.start_at), "MMM d, yyyy");
        const duration = (
          (new Date(shift.end_at).getTime() - new Date(shift.start_at).getTime()) /
          (1000 * 60 * 60)
        ).toFixed(1);

        rows.push([
          includeEmployeeInfo ? (employee?.display_name || "Unassigned") : "—",
          includeEmployeeInfo ? (employee?.position_name || "—") : "—",
          date,
          startTime,
          endTime,
          includeHours ? duration : "—",
          shift.department_name || "—",
        ]);
      });

      // Create CSV content
      const csvContent = [
        headers.join(","),
        ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
      ].join("\n");

      // Download
      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `schedule-${format(weekStart, "yyyy-MM-dd")}.csv`;
      link.click();
      URL.revokeObjectURL(url);

      toast.success("Schedule exported successfully");
      onOpenChange(false);
    } catch (error) {
      toast.error("Failed to export schedule");
    }
  };

  const exportToPrint = () => {
    try {
      // Group by employee
      const employeeShifts = employees.map((employee) => {
        const empShifts = shifts.filter((s) => s.employee_id === employee.id);
        const totalHours = empShifts.reduce((acc, shift) => {
          const hours =
            (new Date(shift.end_at).getTime() - new Date(shift.start_at).getTime()) /
            (1000 * 60 * 60);
          return acc + hours;
        }, 0);

        return {
          employee,
          shifts: empShifts,
          totalHours: totalHours.toFixed(1),
        };
      });

      // Create printable HTML
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Schedule - ${format(weekStart, "MMM d, yyyy")}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { text-align: center; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
            .employee-header { background-color: #e8f4f8; font-weight: bold; }
            @media print {
              button { display: none; }
            }
          </style>
        </head>
        <body>
          <h1>Work Schedule</h1>
          <p style="text-align: center;">Week of ${format(weekStart, "MMMM d, yyyy")}</p>
          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Position</th>
                <th>Date</th>
                <th>Time</th>
                <th>Department</th>
                <th>Hours</th>
              </tr>
            </thead>
            <tbody>
              ${employeeShifts
                .map(
                  ({ employee, shifts, totalHours }) => `
                ${shifts
                  .map(
                    (shift, idx) => `
                  <tr>
                    <td>${idx === 0 ? employee.display_name : ""}</td>
                    <td>${idx === 0 ? employee.position_name || "—" : ""}</td>
                    <td>${format(new Date(shift.start_at), "EEE, MMM d")}</td>
                    <td>${format(new Date(shift.start_at), "HH:mm")} - ${format(
                      new Date(shift.end_at),
                      "HH:mm"
                    )}</td>
                    <td>${shift.department_name || "—"}</td>
                    <td>${(
                      (new Date(shift.end_at).getTime() - new Date(shift.start_at).getTime()) /
                      (1000 * 60 * 60)
                    ).toFixed(1)}</td>
                  </tr>
                `
                  )
                  .join("")}
                <tr class="employee-header">
                  <td colspan="5">Total for ${employee.display_name}</td>
                  <td>${totalHours} hrs</td>
                </tr>
              `
                )
                .join("")}
            </tbody>
          </table>
          <button onclick="window.print()" style="margin-top: 20px; padding: 10px 20px;">Print</button>
        </body>
        </html>
      `;

      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
      }

      onOpenChange(false);
    } catch (error) {
      toast.error("Failed to open print view");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export Schedule</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="unassigned"
                checked={includeUnassigned}
                onCheckedChange={(checked) => setIncludeUnassigned(checked === true)}
              />
              <Label htmlFor="unassigned" className="cursor-pointer">
                Include unassigned shifts
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="employee-info"
                checked={includeEmployeeInfo}
                onCheckedChange={(checked) => setIncludeEmployeeInfo(checked === true)}
              />
              <Label htmlFor="employee-info" className="cursor-pointer">
                Include employee information
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="hours"
                checked={includeHours}
                onCheckedChange={(checked) => setIncludeHours(checked === true)}
              />
              <Label htmlFor="hours" className="cursor-pointer">
                Include hours calculation
              </Label>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={exportToCSV} className="flex-1">
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
            <Button onClick={exportToPrint} variant="outline" className="flex-1">
              <Download className="w-4 h-4 mr-2" />
              Print View
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
