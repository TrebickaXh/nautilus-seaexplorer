import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend } from 'recharts';
import { Download, TrendingUp, Clock, AlertCircle, Calendar } from "lucide-react";
import { format } from "date-fns";
import { useReportData, useShifts, useDepartments } from "@/hooks/useReportData";
import {
  calculateOnTimeMetrics,
  calculateCompletionMetrics,
  calculateTeamMemberMetrics,
  calculateCoverageMetrics,
  exportMetricsToCSV,
  type GroupByType,
} from "@/lib/reportUtils";

export default function Reports() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [dateRange, setDateRange] = useState('7');
  const [groupBy, setGroupBy] = useState<GroupByType>('template');
  const [selectedShiftId, setSelectedShiftId] = useState<string>('all');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('all');

  // Fetch data with caching
  const { data: tasks = [], isLoading, error } = useReportData({
    dateRange,
    shiftId: selectedShiftId,
    departmentId: selectedDepartmentId,
  });

  const { data: shifts = [] } = useShifts();
  const { data: departments = [] } = useDepartments();

  // Filter shifts based on selected department
  const availableShifts = useMemo(() => {
    console.log('🔍 Filtering shifts:', {
      selectedDepartmentId,
      totalShifts: shifts.length,
      shiftsWithDeptId: shifts.filter((s: any) => s.department_id).length,
      shiftsWithoutDeptId: shifts.filter((s: any) => !s.department_id).length,
      sampleShift: shifts[0]
    });
    
    if (selectedDepartmentId === 'all') {
      return shifts;
    }
    
    const filtered = shifts.filter((shift: any) => 
      shift.department_id === selectedDepartmentId || shift.department_id === null
    );
    
    console.log('📊 Filtered result:', {
      availableCount: filtered.length,
      filtered: filtered.map((s: any) => ({ name: s.name, dept_id: s.department_id }))
    });
    
    return filtered;
  }, [shifts, selectedDepartmentId]);

  // Reset shift selection when department changes if current shift is not available
  useEffect(() => {
    if (selectedShiftId !== 'all') {
      const isShiftAvailable = availableShifts.some((shift: any) => shift.id === selectedShiftId);
      if (!isShiftAvailable) {
        setSelectedShiftId('all');
      }
    }
  }, [selectedDepartmentId, availableShifts, selectedShiftId]);

  // Calculate metrics - memoized to avoid recalculation on every render
  const onTimeData = useMemo(
    () => calculateOnTimeMetrics(tasks, groupBy),
    [tasks, groupBy]
  );

  const completionData = useMemo(
    () => calculateCompletionMetrics(tasks, groupBy),
    [tasks, groupBy]
  );

  const teamMemberData = useMemo(
    () => calculateTeamMemberMetrics(tasks),
    [tasks]
  );

  // Department-specific metrics
  const departmentData = useMemo(
    () => calculateCompletionMetrics(tasks, 'department'),
    [tasks]
  );

  // Shift-specific metrics
  const shiftData = useMemo(
    () => calculateCompletionMetrics(tasks, 'shift'),
    [tasks]
  );

  const coverageData = useMemo(
    () => calculateCoverageMetrics(tasks),
    [tasks]
  );

  // Check authentication
  useMemo(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
      }
    };
    checkAuth();
  }, [navigate]);

  // Handle errors
  if (error) {
    toast({
      title: "Error",
      description: error instanceof Error ? error.message : "Failed to load report data",
      variant: "destructive",
    });
  }

  const exportToCSV = () => {
    exportMetricsToCSV(
      onTimeData,
      `on-time-report-${format(new Date(), 'yyyy-MM-dd')}.csv`
    );
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

  if (isLoading) {
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
          <Button onClick={exportToCSV} variant="outline" disabled={onTimeData.length === 0}>
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
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

              <div>
                <label className="text-sm font-medium mb-2 block">Department</label>
                <Select value={selectedDepartmentId} onValueChange={setSelectedDepartmentId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Departments</SelectItem>
                    {departments.map((dept: any) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name} {dept.locations?.name && `(${dept.locations.name})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="text-sm font-medium mb-2 block">Shift</label>
                <Select value={selectedShiftId} onValueChange={setSelectedShiftId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Shifts</SelectItem>
                    {availableShifts.map((shift: any) => (
                      <SelectItem key={shift.id} value={shift.id}>
                        {shift.name} {shift.locations?.name && `(${shift.locations.name})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Group By</label>
                <Select value={groupBy} onValueChange={(v) => setGroupBy(v as GroupByType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="template">Routines</SelectItem>
                    <SelectItem value="department">Department</SelectItem>
                    <SelectItem value="shift">Shift</SelectItem>
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

        {/* Tasks by Department */}
        <Card className="mb-6 shadow-ocean">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Tasks by Department
            </CardTitle>
            <CardDescription>Completed and overdue tasks grouped by department</CardDescription>
          </CardHeader>
          <CardContent>
            {departmentData.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No department data available</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={departmentData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="name" 
                    stroke="hsl(var(--muted-foreground))"
                    tick={{ fontSize: 12 }}
                    angle={-45}
                    textAnchor="end"
                    height={100}
                  />
                  <YAxis stroke="hsl(var(--muted-foreground))" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Legend />
                  <Bar dataKey="completed" fill="hsl(var(--success))" radius={[8, 8, 0, 0]} name="Completed" />
                  <Bar dataKey="overdue" fill="hsl(var(--destructive))" radius={[8, 8, 0, 0]} name="Overdue" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Tasks by Shift */}
        <Card className="mb-6 shadow-ocean">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              Tasks by Shift
            </CardTitle>
            <CardDescription>Completed and overdue tasks grouped by shift</CardDescription>
          </CardHeader>
          <CardContent>
            {shiftData.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No shift data available</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={shiftData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="name" 
                    stroke="hsl(var(--muted-foreground))"
                    tick={{ fontSize: 12 }}
                    angle={-45}
                    textAnchor="end"
                    height={100}
                  />
                  <YAxis stroke="hsl(var(--muted-foreground))" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Legend />
                  <Bar dataKey="completed" fill="hsl(var(--success))" radius={[8, 8, 0, 0]} name="Completed" />
                  <Bar dataKey="overdue" fill="hsl(var(--destructive))" radius={[8, 8, 0, 0]} name="Overdue" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Tasks by Team Member */}
        <Card className="mb-6 shadow-ocean">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-accent" />
              Tasks Completed by Team Member
            </CardTitle>
            <CardDescription>Number of tasks completed by each team member</CardDescription>
          </CardHeader>
          <CardContent>
            {teamMemberData.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No team member completion data available</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={teamMemberData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="name" 
                    stroke="hsl(var(--muted-foreground))"
                    tick={{ fontSize: 12 }}
                    angle={-45}
                    textAnchor="end"
                    height={100}
                  />
                  <YAxis stroke="hsl(var(--muted-foreground))" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Bar dataKey="completed" fill="hsl(var(--accent))" radius={[8, 8, 0, 0]} />
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
