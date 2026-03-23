import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Clock, AlertCircle, TrendingUp } from "lucide-react";
import { BarChart, Bar, ResponsiveContainer, XAxis, Tooltip } from "recharts";

interface TodayHealthProps {
  completionRate: number;
  completedToday: number;
  pendingTasks: number;
  overdueTasks: number;
  sparkline: { day: string; rate: number }[];
}

function getStatusLabel(rate: number) {
  if (rate >= 90) return { label: "On Track", className: "text-success" };
  if (rate >= 70) return { label: "Needs Attention", className: "text-warning" };
  return { label: "Behind Schedule", className: "text-destructive" };
}

function getProgressColor(rate: number) {
  if (rate >= 90) return "bg-success";
  if (rate >= 70) return "bg-warning";
  return "bg-destructive";
}

export default function TodayHealthCard({
  completionRate,
  completedToday,
  pendingTasks,
  overdueTasks,
  sparkline,
}: TodayHealthProps) {
  const status = getStatusLabel(completionRate);

  return (
    <Card className="shadow-ocean">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium text-muted-foreground">
            Today's Health
          </CardTitle>
          <TrendingUp className="w-4 h-4 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Dominant percentage */}
        <div className="text-center">
          <div className={`text-6xl font-bold tracking-tight ${status.className}`}>
            {completionRate}%
          </div>
          <p className={`text-sm font-semibold mt-1 ${status.className}`}>
            {status.label}
          </p>
        </div>

        {/* Progress bar */}
        <div className="relative h-3 rounded-full bg-muted overflow-hidden">
          <div
            className={`absolute inset-y-0 left-0 rounded-full transition-all duration-700 ${getProgressColor(completionRate)}`}
            style={{ width: `${Math.min(completionRate, 100)}%` }}
          />
        </div>

        {/* Inline stats */}
        <div className="flex items-center justify-center gap-4 text-sm">
          <span className="flex items-center gap-1.5 text-success">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {completedToday} completed
          </span>
          <span className="text-muted-foreground">|</span>
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Clock className="w-3.5 h-3.5" />
            {pendingTasks} pending
          </span>
          <span className="text-muted-foreground">|</span>
          <span className="flex items-center gap-1.5 text-destructive">
            <AlertCircle className="w-3.5 h-3.5" />
            {overdueTasks} overdue
          </span>
        </div>

        {/* 7-day sparkline */}
        <div>
          <p className="text-xs text-muted-foreground mb-2">Last 7 days</p>
          <ResponsiveContainer width="100%" height={64}>
            <BarChart data={sparkline} barCategoryGap="20%">
              <XAxis
                dataKey="day"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              />
              <Tooltip
                formatter={(value: number) => [`${value}%`, 'Completion']}
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px',
                  fontSize: '12px',
                }}
              />
              <Bar
                dataKey="rate"
                radius={[3, 3, 0, 0]}
                fill="hsl(var(--primary))"
                opacity={0.8}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
