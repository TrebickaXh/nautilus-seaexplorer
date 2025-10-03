import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { Download, TrendingUp, Clock, AlertCircle, Calendar } from "lucide-react";
import { format, subDays } from "date-fns";

export default function Reports() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('7');
  const [groupBy, setGroupBy] = useState<'template' | 'location' | 'role'>('template');
  
  const [onTimeData, setOnTimeData] = useState<any[]>([]);
  const [mtcData, setMtcData] = useState<any[]>([]);
  const [coverageData, setCoverageData] = useState<any[]>([]);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    loadReportData();
  }, [dateRange, groupBy]);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
      return;
    }
  };

  const loadReportData = async () => {
    try {
      setLoading(true);
      const startDate = subDays(new Date(), parseInt(dateRange));

      // Fetch task instances with completions
      const { data: tasks, error } = await supabase
        .from('task_instances')
        .select(`
          *,
          task_templates(title, criticality),
          locations(name),
          completions(created_at, user_id)
        `)
        .gte('due_at', startDate.toISOString())
        .in('status', ['done', 'skipped']);

      if (error) throw error;

      // Calculate on-time rate by grouping
      const groupedOnTime = new Map<string, { total: number; onTime: number; name: string }>();
      
      tasks?.forEach(task => {
        let key = '';
        let name = '';
        
        if (groupBy === 'template') {
          key = task.template_id;
          name = task.task_templates?.title || 'Unknown';
        } else if (groupBy === 'location') {
          key = task.location_id;
          name = task.locations?.name || 'Unknown';
        } else {
          key = task.assigned_role || 'unassigned';
          name = task.assigned_role || 'Unassigned';
        }

        if (!groupedOnTime.has(key)) {
          groupedOnTime.set(key, { total: 0, onTime: 0, name });
        }

        const group = groupedOnTime.get(key)!;
        group.total++;

        if (task.status === 'done' && task.completed_at && new Date(task.completed_at) <= new Date(task.due_at)) {
          group.onTime++;
        }
      });

      const onTimeChartData = Array.from(groupedOnTime.entries())
        .map(([key, data]) => ({
          name: data.name,
          rate: data.total > 0 ? Math.round((data.onTime / data.total) * 100) : 0,
          total: data.total,
          onTime: data.onTime
        }))
        .sort((a, b) => b.rate - a.rate);

      setOnTimeData(onTimeChartData);

      // Calculate Mean Time to Complete
      const mtcMap = new Map<string, { times: number[]; name: string }>();
      
      tasks?.forEach(task => {
        if (task.status === 'done' && task.completed_at && task.completions?.[0]?.created_at) {
          let key = '';
          let name = '';
          
          if (groupBy === 'template') {
            key = task.template_id;
            name = task.task_templates?.title || 'Unknown';
          } else if (groupBy === 'location') {
            key = task.location_id;
            name = task.locations?.name || 'Unknown';
          } else {
            key = task.assigned_role || 'unassigned';
            name = task.assigned_role || 'Unassigned';
          }

          if (!mtcMap.has(key)) {
            mtcMap.set(key, { times: [], name });
          }

          const dueTime = new Date(task.due_at).getTime();
          const completeTime = new Date(task.completions[0].created_at).getTime();
          const minutes = (completeTime - dueTime) / (1000 * 60);
          
          mtcMap.get(key)!.times.push(minutes);
        }
      });

      const mtcChartData = Array.from(mtcMap.entries())
        .map(([key, data]) => ({
          name: data.name,
          avgMinutes: data.times.length > 0 
            ? Math.round(data.times.reduce((a, b) => a + b, 0) / data.times.length)
            : 0,
          count: data.times.length
        }))
        .filter(item => item.count > 0)
        .sort((a, b) => a.avgMinutes - b.avgMinutes);

      setMtcData(mtcChartData);

      // Calculate coverage by hour
      const hourCoverage = Array.from({ length: 24 }, (_, i) => ({
        hour: i,
        count: 0
      }));

      tasks?.forEach(task => {
        if (task.completed_at) {
          const hour = new Date(task.completed_at).getHours();
          hourCoverage[hour].count++;
        }
      });

      setCoverageData(hourCoverage);

    } catch (error: any) {
      console.error('Error loading report data:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to load report data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    const csvData = onTimeData.map(item => ({
      Name: item.name,
      'On-Time Rate': `${item.rate}%`,
      'Total Tasks': item.total,
      'On-Time Tasks': item.onTime
    }));

    const headers = Object.keys(csvData[0]);
    const csvContent = [
      headers.join(','),
      ...csvData.map(row => headers.map(h => row[h as keyof typeof row]).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `on-time-report-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    toast({
      title: "Export Complete",
      description: "Report downloaded as CSV",
    });
  };

  const getBarColor = (rate: number) => {
    if (rate >= 90) return 'hsl(var(--success))';
    if (rate >= 70) return 'hsl(var(--warning))';
    return 'hsl(var(--destructive))';
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading reports...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Reports & Analytics</h1>
            <p className="text-muted-foreground">Task completion metrics and insights</p>
          </div>
          <Button onClick={exportToCSV} variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>

        {/* Filters */}
        <Card className="mb-6 shadow-ocean">
          <CardHeader>
            <CardTitle>Report Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="text-sm font-medium mb-2 block">Date Range</label>
                <Select value={dateRange} onValueChange={setDateRange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">Last 7 days</SelectItem>
                    <SelectItem value="30">Last 30 days</SelectItem>
                    <SelectItem value="90">Last 90 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <label className="text-sm font-medium mb-2 block">Group By</label>
                <Select value={groupBy} onValueChange={(v) => setGroupBy(v as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="template">Task Template</SelectItem>
                    <SelectItem value="location">Location</SelectItem>
                    <SelectItem value="role">Role</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* On-Time Completion Rate */}
        <Card className="mb-6 shadow-ocean">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-success" />
              On-Time Completion Rate
            </CardTitle>
            <CardDescription>Percentage of tasks completed by their due date</CardDescription>
          </CardHeader>
          <CardContent>
            {onTimeData.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No data available for selected filters</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={onTimeData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="name" 
                    stroke="hsl(var(--muted-foreground))"
                    tick={{ fontSize: 12 }}
                    angle={-45}
                    textAnchor="end"
                    height={100}
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))"
                    label={{ value: 'On-Time Rate (%)', angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Bar dataKey="rate" radius={[8, 8, 0, 0]}>
                    {onTimeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={getBarColor(entry.rate)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Mean Time to Complete */}
        <Card className="mb-6 shadow-ocean">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              Mean Time to Complete
            </CardTitle>
            <CardDescription>Average time from task availability to completion (minutes)</CardDescription>
          </CardHeader>
          <CardContent>
            {mtcData.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No completion data available</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={mtcData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="name" 
                    stroke="hsl(var(--muted-foreground))"
                    tick={{ fontSize: 12 }}
                    angle={-45}
                    textAnchor="end"
                    height={100}
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))"
                    label={{ value: 'Avg Minutes', angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Bar dataKey="avgMinutes" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Coverage Heatmap */}
        <Card className="shadow-ocean">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-accent" />
              Coverage by Hour
            </CardTitle>
            <CardDescription>Task completion distribution throughout the day</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={coverageData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="hour" 
                  stroke="hsl(var(--muted-foreground))"
                  tickFormatter={(hour) => `${hour}:00`}
                />
                <YAxis stroke="hsl(var(--muted-foreground))" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                  labelFormatter={(hour) => `${hour}:00 - ${hour + 1}:00`}
                />
                <Bar dataKey="count" fill="hsl(var(--accent))" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
