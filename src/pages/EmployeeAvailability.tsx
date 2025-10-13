import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AvailabilityDialog } from "@/components/schedules/AvailabilityDialog";
import { Calendar, Search, UserCheck } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";

export default function EmployeeAvailability() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [availabilityDialogOpen, setAvailabilityDialogOpen] = useState(false);
  const { isAdmin } = useUserRole();

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ["employees-with-availability"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select(`
          *,
          position:positions(name)
        `)
        .eq("active", true)
        .order("display_name");

      if (error) throw error;
      return data;
    },
  });

  const filteredEmployees = employees.filter((emp: any) =>
    emp.display_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatAvailability = (availability: any) => {
    if (!availability) return "Not set";

    const days = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
    const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    
    const availableDays = days
      .map((day, idx) => (availability[day]?.length > 0 ? dayNames[idx] : null))
      .filter(Boolean);

    return availableDays.length > 0 ? availableDays.join(", ") : "No availability";
  };

  const openAvailabilityDialog = (employee: any) => {
    setSelectedEmployee(employee);
    setAvailabilityDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading employees...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Employee Availability</h1>
          <p className="text-muted-foreground mt-1">
            Manage when employees are available to work
          </p>
        </div>
        <Calendar className="w-8 h-8 text-primary" />
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
        <Input
          placeholder="Search employees..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredEmployees.map((employee: any) => (
          <Card key={employee.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{employee.display_name}</CardTitle>
                {employee.availability_rules && (
                  <Badge variant="secondary">
                    <UserCheck className="w-3 h-3 mr-1" />
                    Set
                  </Badge>
                )}
              </div>
              {employee.position?.name && (
                <p className="text-sm text-muted-foreground">{employee.position.name}</p>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm font-medium mb-1">Available Days:</p>
                <p className="text-sm text-muted-foreground">
                  {formatAvailability(employee.availability_rules)}
                </p>
              </div>

              <Button
                variant="outline"
                className="w-full"
                onClick={() => openAvailabilityDialog(employee)}
                disabled={!isAdmin}
              >
                <Calendar className="w-4 h-4 mr-2" />
                {employee.availability_rules ? "Edit Availability" : "Set Availability"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredEmployees.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          No employees found
        </div>
      )}

      {selectedEmployee && (
        <AvailabilityDialog
          employeeId={selectedEmployee.id}
          employeeName={selectedEmployee.display_name}
          currentAvailability={selectedEmployee.availability_rules}
          open={availabilityDialogOpen}
          onOpenChange={setAvailabilityDialogOpen}
        />
      )}
    </div>
  );
}
