import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { MapPin, ArrowRight, ArrowLeft } from "lucide-react";
import { Industry, INDUSTRY_DEFAULTS } from "@/lib/industryTemplates";

const DAY_LABELS = [
  { value: 0, short: "S", label: "Sun" },
  { value: 1, short: "M", label: "Mon" },
  { value: 2, short: "T", label: "Tue" },
  { value: 3, short: "W", label: "Wed" },
  { value: 4, short: "T", label: "Thu" },
  { value: 5, short: "F", label: "Fri" },
  { value: 6, short: "S", label: "Sat" },
];

export interface Step2Data {
  locationName: string;
  departmentName: string;
  shiftName: string;
  shiftStart: string;
  shiftEnd: string;
  shiftDays: number[];
}

interface Props {
  data: Step2Data;
  industry: Industry;
  onChange: (data: Step2Data) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function OnboardingStep2({ data, industry, onChange, onNext, onBack }: Props) {
  const [attempted, setAttempted] = useState(false);
  const hasUserEdited = useRef(false);

  useEffect(() => {
    if (hasUserEdited.current) return;
    const defaults = INDUSTRY_DEFAULTS[industry];
    if (defaults) {
      onChange({
        ...data,
        departmentName: defaults.department,
        shiftName: defaults.shiftName,
        shiftStart: defaults.shiftStart,
        shiftEnd: defaults.shiftEnd,
        shiftDays: defaults.shiftDays,
      });
    }
  }, [industry]);

  const handleFieldChange = (field: keyof Step2Data, value: string) => {
    if (field === "departmentName" || field === "shiftName") {
      hasUserEdited.current = true;
    }
    onChange({ ...data, [field]: value });
  };

  const toggleDay = (day: number) => {
    const next = data.shiftDays.includes(day)
      ? data.shiftDays.filter((d) => d !== day)
      : [...data.shiftDays, day].sort();
    onChange({ ...data, shiftDays: next });
  };

  const isValid =
    data.locationName.trim().length > 0 &&
    data.departmentName.trim().length > 0 &&
    data.shiftName.trim().length > 0 &&
    data.shiftStart &&
    data.shiftEnd &&
    data.shiftDays.length > 0;

  const handleContinue = () => {
    setAttempted(true);
    if (isValid) onNext();
  };

  return (
    <div className="space-y-8">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl gradient-teal shadow-ocean">
          <MapPin className="w-7 h-7 text-accent-foreground" />
        </div>
        <h2 className="text-2xl font-bold">Your Structure</h2>
        <p className="text-muted-foreground text-sm">
          Set up your first location, department, and shift.
        </p>
      </div>

      <div className="max-w-md mx-auto space-y-5">
        {/* Location */}
        <div className="space-y-2">
          <Label htmlFor="locationName">Your first location or branch</Label>
          <Input
            id="locationName"
            placeholder="e.g. Downtown Branch"
            value={data.locationName}
            onChange={(e) => handleFieldChange("locationName", e.target.value)}
            maxLength={100}
          />
          {attempted && !data.locationName.trim() && (
            <p className="text-xs text-destructive">This field is required</p>
          )}
        </div>

        {/* Department */}
        <div className="space-y-2">
          <Label htmlFor="departmentName">Department</Label>
          <Input
            id="departmentName"
            placeholder="e.g. Kitchen, Front of House"
            value={data.departmentName}
            onChange={(e) => handleFieldChange("departmentName", e.target.value)}
            maxLength={100}
          />
          {attempted && !data.departmentName.trim() && (
            <p className="text-xs text-destructive">This field is required</p>
          )}
        </div>

        {/* Shift */}
        <div className="p-4 rounded-xl border bg-card space-y-4">
          <Label className="text-base font-semibold">First Shift</Label>

          <div className="space-y-2">
            <Label htmlFor="shiftName" className="text-sm">Shift Name</Label>
            <Input
              id="shiftName"
              placeholder="e.g. Morning Shift"
              value={data.shiftName}
              onChange={(e) => handleFieldChange("shiftName", e.target.value)}
              maxLength={60}
            />
            {attempted && !data.shiftName.trim() && (
              <p className="text-xs text-destructive">This field is required</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="shiftStart" className="text-sm">Start Time</Label>
              <Input
                id="shiftStart"
                type="time"
                value={data.shiftStart}
                onChange={(e) => handleFieldChange("shiftStart", e.target.value)}
              />
              {attempted && !data.shiftStart && (
                <p className="text-xs text-destructive">This field is required</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="shiftEnd" className="text-sm">End Time</Label>
              <Input
                id="shiftEnd"
                type="time"
                value={data.shiftEnd}
                onChange={(e) => handleFieldChange("shiftEnd", e.target.value)}
              />
              {attempted && !data.shiftEnd && (
                <p className="text-xs text-destructive">This field is required</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm">Days of Week</Label>
            <div className="flex gap-1.5">
              {DAY_LABELS.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => toggleDay(d.value)}
                  className={`w-9 h-9 rounded-lg text-xs font-semibold transition-base ${
                    data.shiftDays.includes(d.value)
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                  title={d.label}
                >
                  {d.short}
                </button>
              ))}
            </div>
            {attempted && data.shiftDays.length === 0 && (
              <p className="text-xs text-destructive">Select at least one day</p>
            )}
          </div>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Don't worry — you can add more locations, departments and shifts after setup.
        </p>

        <div className="flex gap-3">
          <Button variant="outline" onClick={onBack} className="flex-1" size="lg">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <Button onClick={handleContinue} disabled={false} className="flex-1" size="lg">
            Continue
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
}
