import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle, Clock, Flame, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import ShiftInProgressCard from "./ShiftInProgressCard";

interface CrewTask {
  id: string;
  due_at: string;
  status: string;
  urgency_score: number | null;
  completed_at: string | null;
  task_routines: { title: string } | null;
  departments: { name: string } | null;
  areas: { name: string } | null;
  denormalized_data: any;
}

interface CrewDashboardProps {
  tasks: CrewTask[];
  streak: number;
  hasPinSet: boolean;
  orgId: string;
  timezone: string;
}

export default function CrewDashboard({ tasks, streak, hasPinSet, orgId, timezone }: CrewDashboardProps) {
  const navigate = useNavigate();

  const doneTasks = tasks.filter(t => t.status === "done");
  const pendingTasks = tasks.filter(t => t.status === "pending");
  const totalTasks = tasks.length;
  const completionRate = totalTasks > 0 ? Math.round((doneTasks.length / totalTasks) * 100) : 0;

  return (
    <div className="grid gap-6">
      {/* PIN Setup Prompt */}
      {!hasPinSet && (
        <Card className="shadow-ocean border-primary/30 bg-primary/5">
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <KeyRound className="w-5 h-5 text-primary" />
              <div>
                <p className="font-semibold">Set up your kiosk PIN</p>
                <p className="text-sm text-muted-foreground">You need a PIN to complete tasks on the kiosk</p>
              </div>
            </div>
            <Button size="sm" onClick={() => navigate("/settings")}>
              Set PIN
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Streak + Summary Row */}
      <div className="grid md:grid-cols-3 gap-4">
        {/* Today's Progress */}
        <Card className="md:col-span-2 shadow-ocean">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Your Tasks Today</CardTitle>
              <Badge variant="outline" className="text-sm">
                {doneTasks.length}/{totalTasks} done
              </Badge>
            </div>
            {/* Progress bar */}
            <div className="relative h-2.5 rounded-full bg-muted overflow-hidden mt-2">
              <div
                className={`absolute inset-y-0 left-0 rounded-full transition-all duration-700 ${
                  completionRate >= 90 ? "bg-success" : completionRate >= 50 ? "bg-warning" : "bg-destructive"
                }`}
                style={{ width: `${Math.min(completionRate, 100)}%` }}
              />
            </div>
          </CardHeader>
          <CardContent>
            {tasks.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle2 className="w-10 h-10 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No tasks assigned to you today</p>
              </div>
            ) : (
              <div className="space-y-2">
                {tasks.map((task) => {
                  const title = task.task_routines?.title || (task.denormalized_data as any)?.title || "Untitled";
                  const isDone = task.status === "done";
                  const isOverdue = !isDone && new Date(task.due_at) < new Date();

                  return (
                    <div
                      key={task.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                        isDone ? "bg-success/5 border-success/20 opacity-70" : isOverdue ? "bg-destructive/5 border-destructive/20" : "hover:bg-muted/50"
                      }`}
                    >
                      {isDone ? (
                        <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0" />
                      ) : (
                        <Circle className={`w-5 h-5 flex-shrink-0 ${isOverdue ? "text-destructive" : "text-muted-foreground"}`} />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className={`font-medium truncate ${isDone ? "line-through text-muted-foreground" : ""}`}>
                          {title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {task.departments?.name}
                          {task.areas?.name && ` • ${task.areas.name}`}
                        </p>
                      </div>
                      <span className={`text-xs flex-shrink-0 ${isOverdue ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                        {isDone
                          ? new Date(task.completed_at!).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                          : new Date(task.due_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
                        }
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
            {pendingTasks.length > 0 && (
              <Button className="w-full mt-4" onClick={() => navigate("/kiosk")}>
                Open Kiosk to Complete Tasks
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Right Column: Streak + Shift */}
        <div className="space-y-4">
          {/* Streak Card */}
          <Card className="shadow-md">
            <CardContent className="flex items-center gap-3 py-5">
              <Flame className={`w-8 h-8 ${streak > 0 ? "text-warning" : "text-muted-foreground opacity-40"}`} />
              <div>
                <p className="text-2xl font-bold">{streak}</p>
                <p className="text-xs text-muted-foreground">
                  {streak === 1 ? "day streak" : "day streak"} completing all tasks
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Shift Status */}
          <ShiftInProgressCard orgId={orgId} timezone={timezone} />
        </div>
      </div>
    </div>
  );
}
