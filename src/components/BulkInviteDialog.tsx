import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Upload, AlertCircle, CheckCircle2, XCircle, FileSpreadsheet } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface BulkInviteDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  orgId: string;
}

interface ParsedRow {
  email: string;
  display_name: string;
  role: string;
  phone: string;
  employee_id: string;
  shift_type: string;
  errors: string[];
}

type InviteStatus = "idle" | "processing" | "done";

const VALID_ROLES = ["crew", "location_manager", "org_admin"];

const TEMPLATE_HEADERS = ["email", "display_name", "role", "phone", "employee_id", "shift_type"];

const TEMPLATE_EXAMPLE = [
  "john@example.com,John Smith,crew,+1234567890,EMP-001,full_time",
  "jane@example.com,Jane Doe,location_manager,,EMP-002,part_time",
];

function downloadTemplate() {
  const headerComment = "# Valid roles: crew, location_manager, org_admin. Phone and employee_id are optional.";
  const csv = [headerComment, TEMPLATE_HEADERS.join(","), ...TEMPLATE_EXAMPLE].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "team_invite_template.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function parseCSV(text: string): ParsedRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#"));

  // Skip header if it matches our template
  const first = lines[0]?.toLowerCase();
  const startIdx = first && first.includes("email") && first.includes("display_name") ? 1 : 0;

  return lines.slice(startIdx).map((line) => {
    // Simple CSV parse handling quoted fields
    const cols: string[] = [];
    let current = "";
    let inQuotes = false;
    for (const ch of line) {
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === "," && !inQuotes) {
        cols.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    cols.push(current.trim());

    const [email = "", display_name = "", role = "", phone = "", employee_id = "", shift_type = ""] = cols;
    const errors: string[] = [];

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push("Invalid email");
    if (!display_name) errors.push("Name required");
    if (role && !VALID_ROLES.includes(role.toLowerCase())) errors.push(`Invalid role "${role}"`);

    return {
      email: email.toLowerCase(),
      display_name,
      role: role.toLowerCase() || "crew",
      phone,
      employee_id,
      shift_type,
      errors,
    };
  });
}

export function BulkInviteDialog({ open, onClose, onSuccess, orgId }: BulkInviteDialogProps) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [status, setStatus] = useState<InviteStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<{ email: string; ok: boolean; error?: string }[]>([]);

  const validRows = rows.filter((r) => r.errors.length === 0);
  const invalidRows = rows.filter((r) => r.errors.length > 0);

  const reset = () => {
    setRows([]);
    setStatus("idle");
    setProgress(0);
    setResults([]);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setRows(parseCSV(text));
      setStatus("idle");
      setResults([]);
    };
    reader.readAsText(file);
    // Reset so re-uploading same file triggers change
    e.target.value = "";
  };

  const handleSubmit = async () => {
    if (validRows.length === 0) return;
    setStatus("processing");
    setProgress(0);
    const inviteResults: { email: string; ok: boolean; error?: string }[] = [];

    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i];
      try {
        const { data, error } = await supabase.functions.invoke("invite-user", {
          body: {
            email: row.email,
            displayName: row.display_name,
            role: row.role,
            phone: row.phone || undefined,
            departmentId: "",
            employeeId: row.employee_id || undefined,
            shiftType: row.shift_type || undefined,
            orgId,
          },
        });

        if (error) {
          inviteResults.push({ email: row.email, ok: false, error: error.message });
        } else if (data?.error) {
          inviteResults.push({ email: row.email, ok: false, error: data.error });
        } else {
          inviteResults.push({ email: row.email, ok: true });
        }
      } catch (err: any) {
        inviteResults.push({ email: row.email, ok: false, error: err.message || "Unknown error" });
      }

      setProgress(Math.round(((i + 1) / validRows.length) * 100));
      setResults([...inviteResults]);

      // Small delay to avoid rate limiting
      if (i < validRows.length - 1) {
        await new Promise((r) => setTimeout(r, 300));
      }
    }

    setStatus("done");
    const successCount = inviteResults.filter((r) => r.ok).length;
    toast({
      title: "Bulk Invite Complete",
      description: `${successCount} of ${validRows.length} users invited successfully.`,
    });
    if (successCount > 0) onSuccess();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Bulk Invite Team Members
          </DialogTitle>
          <DialogDescription>
            Download the CSV template, fill it in, then upload to invite multiple team members at once.
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Download Template */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="text-xs">Step 1</Badge>
            <span className="text-sm font-medium">Download the template</span>
          </div>
          <Button variant="outline" onClick={downloadTemplate} className="gap-2">
            <Download className="h-4 w-4" />
            Download CSV Template
          </Button>
        </div>

        {/* Step 2: Upload */}
        <div className="space-y-4 pt-4 border-t">
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="text-xs">Step 2</Badge>
            <span className="text-sm font-medium">Upload your filled template</span>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleFileChange}
          />
          <Button variant="outline" onClick={() => fileRef.current?.click()} className="gap-2">
            <Upload className="h-4 w-4" />
            Upload CSV
          </Button>
        </div>

        {/* Preview */}
        {rows.length > 0 && (
          <div className="space-y-4 pt-4 border-t">
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="text-xs">Step 3</Badge>
              <span className="text-sm font-medium">Review & submit</span>
            </div>

            <div className="flex gap-3 text-sm">
              <Badge variant="default" className="gap-1">
                <CheckCircle2 className="h-3 w-3" />
                {validRows.length} valid
              </Badge>
              {invalidRows.length > 0 && (
                <Badge variant="destructive" className="gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {invalidRows.length} with errors
                </Badge>
              )}
            </div>

            <div className="max-h-60 overflow-y-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, i) => (
                    <TableRow key={i} className={row.errors.length > 0 ? "bg-destructive/5" : ""}>
                      <TableCell className="text-sm">{row.email || "—"}</TableCell>
                      <TableCell className="text-sm">{row.display_name || "—"}</TableCell>
                      <TableCell className="text-sm">{row.role}</TableCell>
                      <TableCell>
                        {row.errors.length > 0 ? (
                          <span className="text-xs text-destructive">{row.errors.join(", ")}</span>
                        ) : status === "done" ? (
                          (() => {
                            const res = results.find((r) => r.email === row.email);
                            if (!res) return <span className="text-xs text-muted-foreground">—</span>;
                            return res.ok ? (
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                            ) : (
                              <span className="text-xs text-destructive">{res.error}</span>
                            );
                          })()
                        ) : (
                          <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Progress */}
            {status === "processing" && (
              <div className="space-y-2">
                <Progress value={progress} className="h-2" />
                <p className="text-xs text-muted-foreground text-center">
                  Inviting {Math.round((progress / 100) * validRows.length)} of {validRows.length}…
                </p>
              </div>
            )}

            {/* Results summary */}
            {status === "done" && (
              <div className="rounded-md bg-muted p-3 text-sm">
                <p>
                  <strong>{results.filter((r) => r.ok).length}</strong> invited successfully
                  {results.some((r) => !r.ok) && (
                    <>, <strong>{results.filter((r) => !r.ok).length}</strong> failed</>
                  )}
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2">
              {status === "done" ? (
                <Button onClick={handleClose}>Close</Button>
              ) : (
                <>
                  <Button variant="outline" onClick={reset}>
                    Clear
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    disabled={validRows.length === 0 || status === "processing"}
                  >
                    {status === "processing"
                      ? "Inviting…"
                      : `Invite ${validRows.length} Member${validRows.length !== 1 ? "s" : ""}`}
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
