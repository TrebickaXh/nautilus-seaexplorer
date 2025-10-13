import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { X, Filter } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";

interface ScheduleFiltersProps {
  departments: any[];
  positions: any[];
  selectedDepartment: string;
  onDepartmentChange: (value: string) => void;
  selectedPosition?: string;
  onPositionChange?: (value: string) => void;
  showUnassigned?: boolean;
  onShowUnassignedChange?: (value: boolean) => void;
  showConflicts?: boolean;
  onShowConflictsChange?: (value: boolean) => void;
  searchQuery?: string;
  onSearchChange?: (value: string) => void;
}

export function ScheduleFilters({
  departments,
  positions,
  selectedDepartment,
  onDepartmentChange,
  selectedPosition,
  onPositionChange,
  showUnassigned,
  onShowUnassignedChange,
  showConflicts,
  onShowConflictsChange,
  searchQuery,
  onSearchChange,
}: ScheduleFiltersProps) {
  const activeFiltersCount = [
    selectedDepartment !== "all",
    selectedPosition && selectedPosition !== "all",
    showUnassigned,
    showConflicts,
    searchQuery,
  ].filter(Boolean).length;

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          <Filter className="w-4 h-4 mr-2" />
          Filters
          {activeFiltersCount > 0 && (
            <Badge variant="secondary" className="ml-2 text-xs">
              {activeFiltersCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>

      <SheetContent>
        <SheetHeader>
          <SheetTitle>Schedule Filters</SheetTitle>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {/* Search */}
          {onSearchChange && (
            <div>
              <Label>Search Employee</Label>
              <Input
                value={searchQuery || ""}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Type to search..."
                className="mt-2"
              />
            </div>
          )}

          {/* Department */}
          <div>
            <Label>Department</Label>
            <Select value={selectedDepartment} onValueChange={onDepartmentChange}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="All Departments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {departments.map((dept: any) => (
                  <SelectItem key={dept.id} value={dept.id}>
                    {dept.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Position */}
          {onPositionChange && (
            <div>
              <Label>Position</Label>
              <Select 
                value={selectedPosition || "all"} 
                onValueChange={onPositionChange}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="All Positions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Positions</SelectItem>
                  {positions.map((pos: any) => (
                    <SelectItem key={pos.id} value={pos.id}>
                      {pos.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Checkboxes */}
          <div className="space-y-3">
            {onShowUnassignedChange && (
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="unassigned"
                  checked={showUnassigned}
                  onCheckedChange={(checked) => onShowUnassignedChange(checked === true)}
                />
                <Label htmlFor="unassigned" className="cursor-pointer">
                  Show only unassigned shifts
                </Label>
              </div>
            )}

            {onShowConflictsChange && (
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="conflicts"
                  checked={showConflicts}
                  onCheckedChange={(checked) => onShowConflictsChange(checked === true)}
                />
                <Label htmlFor="conflicts" className="cursor-pointer">
                  Show only shifts with conflicts
                </Label>
              </div>
            )}
          </div>

          {/* Clear Filters */}
          {activeFiltersCount > 0 && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                onDepartmentChange("all");
                onPositionChange?.("all");
                onShowUnassignedChange?.(false);
                onShowConflictsChange?.(false);
                onSearchChange?.("");
              }}
            >
              <X className="w-4 h-4 mr-2" />
              Clear All Filters
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
