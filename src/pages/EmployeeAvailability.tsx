import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AvailabilityDialog } from "@/components/schedules/AvailabilityDialog";
import { Calendar, Search, Settings } from "lucide-react";

export default function EmployeeAvailability() {
  const [search, setSearch] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ["employees-availability"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select(`
          *,
          user_departments!inner(department_id, is_primary, departments(id, name)),
          positions(name)
        `)
        .eq("active", true)
        .order("display_name", { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  const filteredEmployees = employees.filter((emp: any) =>
    emp.display_name?.toLowerCase().includes(search.toLowerCase())
  );

  const getAvailabilitySummary = (availability: any) => {
    if (!availability) return "Not set";

    const days = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
    const availableDays = days.filter((day) => availability[day]?.length > 0);

    if (availableDays.length === 0) return "Not available";
    if (availableDays.length === 7) return "Available all week";
    return `${availableDays.length} days available`;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold">Employee Availability</h1>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search employees..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredEmployees.map((employee: any) => (
            <Card key={employee.id}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center justify-between">
                  <span>{employee.display_name}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setSelectedEmployee(employee)}
                  >
                    <Settings className="w-4 h-4" />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {employee.positions?.name && (
                  <Badge variant="outline">{employee.positions.name}</Badge>
                )}
                
                {employee.user_departments?.[0]?.departments && (
                  <div className="text-sm text-muted-foreground">
                    {employee.user_departments[0].departments.name}
                  </div>
                )}

                <div className="text-sm">
                  <span className="font-medium">Availability: </span>
                  <span className="text-muted-foreground">
                    {getAvailabilitySummary(employee.availability_rules)}
                  </span>
                </div>

                {employee.skills?.length > 0 && (
                  <div className="flex gap-1 flex-wrap">
                    {employee.skills.slice(0, 3).map((skill: string) => (
                      <Badge key={skill} variant="secondary" className="text-xs">
                        {skill}
                      </Badge>
                    ))}
                    {employee.skills.length > 3 && (
                      <Badge variant="secondary" className="text-xs">
                        +{employee.skills.length - 3}
                      </Badge>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {selectedEmployee && (
        <AvailabilityDialog
          employeeId={selectedEmployee.id}
          employeeName={selectedEmployee.display_name}
          currentAvailability={selectedEmployee.availability_rules}
          open={!!selectedEmployee}
          onOpenChange={(open) => !open && setSelectedEmployee(null)}
        />
      )}
    </div>
  );
}
