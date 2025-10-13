import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Save, Trash2, Upload } from "lucide-react";

interface ScheduleTemplate {
  id: string;
  name: string;
  description: string;
  template_data: any;
  created_at: string;
}

interface ScheduleTemplatesProps {
  currentWeekStart: Date;
  currentWeekEnd: Date;
  currentShifts: any[];
}

export function ScheduleTemplates({ currentWeekStart, currentWeekEnd, currentShifts }: ScheduleTemplatesProps) {
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const queryClient = useQueryClient();

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["schedule-templates"],
    queryFn: async () => {
      // This would fetch from a schedule_templates table
      // For now returning empty array as table doesn't exist yet
      return [] as ScheduleTemplate[];
    },
  });

  const saveTemplateMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Create template data from current shifts
      const templateData = {
        shifts: currentShifts.map(s => ({
          department_id: s.department_id,
          location_id: s.location_id,
          name: s.name,
          start_time: s.start_time,
          end_time: s.end_time,
          days_of_week: s.days_of_week,
          required_skills: s.required_skills,
          notes: s.notes,
        })),
        week_start: currentWeekStart.toISOString(),
        week_end: currentWeekEnd.toISOString(),
      };

      // This would save to a schedule_templates table
      // Implementation pending table creation
      toast.info("Template save functionality will be available after database migration");
      
      // Return success for now
      return templateData;
    },
    onSuccess: () => {
      toast.success("Template configuration ready - database migration needed");
      setSaveDialogOpen(false);
      setTemplateName("");
      setTemplateDescription("");
      queryClient.invalidateQueries({ queryKey: ["schedule-templates"] });
    },
    onError: (error) => {
      toast.error("Failed to save template: " + error.message);
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Save className="w-5 h-5" />
          Schedule Templates
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={() => setSaveDialogOpen(true)} className="w-full">
          <Save className="w-4 h-4 mr-2" />
          Save Current Week as Template
        </Button>

        {isLoading ? (
          <div className="text-center py-4 text-muted-foreground text-sm">Loading templates...</div>
        ) : templates.length === 0 ? (
          <div className="py-4 text-center text-muted-foreground text-sm">
            No templates saved yet. Save your current schedule to reuse it later.
          </div>
        ) : (
          <div className="space-y-2">
            {templates.map((template) => (
              <div key={template.id} className="p-3 border rounded-lg">
                <div className="font-medium text-sm">{template.name}</div>
                <p className="text-xs text-muted-foreground mt-1">{template.description}</p>
                <div className="flex gap-2 mt-2">
                  <Button variant="outline" size="sm" className="flex-1">
                    <Upload className="w-3 h-3 mr-1" />
                    Apply
                  </Button>
                  <Button variant="outline" size="sm">
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Schedule Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Template Name</Label>
              <Input
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="e.g., Summer Week Template"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Input
                value={templateDescription}
                onChange={(e) => setTemplateDescription(e.target.value)}
                placeholder="Brief description..."
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => saveTemplateMutation.mutate()}
                disabled={!templateName || saveTemplateMutation.isPending}
              >
                Save Template
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      </CardContent>
    </Card>
  );
}
