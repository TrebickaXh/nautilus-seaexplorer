import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CheckCircle2, AlertCircle, Clock, Users } from "lucide-react";

interface HandoffData {
  total: number;
  done: number;
  skippedTasks: { title: string; note: string | null }[];
  completionRate: number;
  crewNames: string[];
  shiftName: string | null;
}

interface YesterdayHandoffProps {
  data: HandoffData | undefined;
}

export default function YesterdayHandoffCard({ data }: YesterdayHandoffProps) {
  if (!data || data.total === 0) {
    return (
      <Card className="shadow-ocean">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="w-4 h-4" />
            Yesterday's Handoff
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            <p className="text-sm">No data from yesterday</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const rateColor = data.completionRate >= 90 ? "text-success" : data.completionRate >= 70 ? "text-warning" : "text-destructive";

  return (
    <Card className="shadow-ocean">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock className="w-4 h-4" />
          Yesterday's Handoff
        </CardTitle>
        {data.shiftName && (
          <CardDescription>{data.shiftName}</CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Rate */}
        <div className="flex items-baseline gap-2">
          <span className={`text-3xl font-bold ${rateColor}`}>{data.completionRate}%</span>
          <span className="text-sm text-muted-foreground">completed ({data.done}/{data.total})</span>
        </div>

        {/* Skipped tasks */}
        {data.skippedTasks.length > 0 && (
          <div>
            <p className="text-xs font-medium text-warning mb-1.5 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {data.skippedTasks.length} skipped
            </p>
            <div className="space-y-1.5">
              {data.skippedTasks.slice(0, 3).map((task, i) => (
                <div key={i} className="text-sm pl-4 border-l-2 border-warning/30">
                  <p className="font-medium">{task.title}</p>
                  {task.note && <p className="text-xs text-muted-foreground italic">"{task.note}"</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Crew on shift */}
        {data.crewNames.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
              <Users className="w-3 h-3" /> On shift
            </p>
            <p className="text-sm">{data.crewNames.join(", ")}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
