import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ListTodo, ArrowLeft, Rocket, Clock, Star, Plus, X } from "lucide-react";
import { Industry, INDUSTRY_TASKS, TaskTemplate } from "@/lib/industryTemplates";

export interface CustomTask {
  title: string;
  frequency: "daily" | "weekly";
  estMinutes: number;
  criticality: number;
}

interface Props {
  industry: Industry;
  selectedTemplateIds: string[];
  customTasks: CustomTask[];
  onToggleTemplate: (id: string) => void;
  onAddCustomTask: (task: CustomTask) => void;
  onRemoveCustomTask: (index: number) => void;
  onBack: () => void;
  onFinish: () => void;
  isSubmitting: boolean;
}

export default function OnboardingStep3({
  industry,
  selectedTemplateIds,
  customTasks,
  onToggleTemplate,
  onAddCustomTask,
  onRemoveCustomTask,
  onBack,
  onFinish,
  isSubmitting,
}: Props) {
  const templates = INDUSTRY_TASKS[industry] || [];
  const totalTasks = selectedTemplateIds.length + customTasks.length;
  const canFinish = totalTasks > 0;

  return (
    <div className="space-y-8">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl gradient-ocean shadow-ocean">
          <ListTodo className="w-7 h-7 text-primary-foreground" />
        </div>
        <h2 className="text-2xl font-bold">Your First Tasks</h2>
        <p className="text-muted-foreground text-sm">
          Pick template tasks or create your own. Select at least 1.
        </p>
      </div>

      <div className="max-w-2xl mx-auto space-y-6">
        {/* Template tasks */}
        {templates.length > 0 && (
          <div className="space-y-3">
            <Label className="text-base font-semibold">
              Suggested tasks for your industry
            </Label>
            <div className="grid sm:grid-cols-2 gap-2">
              {templates.map((t) => (
                <TemplateCard
                  key={t.id}
                  template={t}
                  selected={selectedTemplateIds.includes(t.id)}
                  onToggle={() => onToggleTemplate(t.id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Custom tasks */}
        <div className="space-y-3">
          <Label className="text-base font-semibold">
            {templates.length > 0 ? "Or add a custom task" : "Create your tasks"}
          </Label>

          {customTasks.map((task, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between gap-2 p-3 rounded-lg border bg-card"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{task.title}</p>
                <p className="text-xs text-muted-foreground">
                  {task.frequency} · {task.estMinutes}min · {task.criticality}★
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => onRemoveCustomTask(idx)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          ))}

          <AddCustomTaskForm onAdd={onAddCustomTask} />
        </div>

        <p className="text-xs text-muted-foreground text-center">
          You can add more tasks from the Task Routines page anytime.
        </p>

        <div className="flex gap-3">
          <Button variant="outline" onClick={onBack} className="flex-1" size="lg" disabled={isSubmitting}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <Button
            onClick={onFinish}
            disabled={!canFinish || isSubmitting}
            className="flex-1"
            size="lg"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin mr-2" />
                Creating workspace…
              </>
            ) : (
              <>
                <Rocket className="w-4 h-4 mr-2" />
                Finish Setup ({totalTasks} {totalTasks === 1 ? "task" : "tasks"})
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

function TemplateCard({
  template,
  selected,
  onToggle,
}: {
  template: TaskTemplate;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-base w-full ${
        selected
          ? "border-primary bg-primary/5 shadow-sm"
          : "border-border bg-card hover:border-primary/30"
      }`}
    >
      <Checkbox checked={selected} className="mt-0.5 pointer-events-none" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-tight">{template.title}</p>
        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-0.5">
            <Clock className="w-3 h-3" />
            {template.estMinutes}m
          </span>
          <span className="capitalize">{template.frequency}</span>
          <span className="flex items-center gap-0.5">
            <Star className="w-3 h-3" />
            {template.criticality}
          </span>
        </div>
      </div>
    </button>
  );
}

function AddCustomTaskForm({ onAdd }: { onAdd: (task: CustomTask) => void }) {
  const [title, setTitle] = useState("");
  const [frequency, setFrequency] = useState<"daily" | "weekly">("daily");
  const [estMinutes, setEstMinutes] = useState(15);
  const [criticality, setCriticality] = useState(3);

  const handleAdd = () => {
    if (!title.trim()) return;
    onAdd({ title: title.trim(), frequency, estMinutes, criticality });
    setTitle("");
    setEstMinutes(15);
    setCriticality(3);
  };

  return (
    <Card className="p-4 space-y-3">
      <div className="space-y-2">
        <Label htmlFor="customTitle" className="text-sm">Task Title</Label>
        <Input
          id="customTitle"
          placeholder="e.g. Check supply closet"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAdd();
            }
          }}
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Frequency</Label>
          <Select value={frequency} onValueChange={(v) => setFrequency(v as "daily" | "weekly")}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Est. Minutes</Label>
          <Input
            type="number"
            min={5}
            max={240}
            value={estMinutes}
            onChange={(e) => setEstMinutes(Number(e.target.value) || 15)}
            className="h-9 text-xs"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Criticality</Label>
          <div className="flex gap-0.5 h-9 items-center">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setCriticality(n)}
                className="p-0.5"
              >
                <Star
                  className={`w-4 h-4 transition-base ${
                    n <= criticality ? "text-warning fill-warning" : "text-muted-foreground/30"
                  }`}
                />
              </button>
            ))}
          </div>
        </div>
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={handleAdd}
        disabled={!title.trim()}
        className="w-full"
      >
        <Plus className="w-3.5 h-3.5 mr-1.5" />
        Add Task
      </Button>
    </Card>
  );
}
