import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Building2, ArrowRight, Check, ChevronsUpDown } from "lucide-react";
import { Industry, INDUSTRY_OPTIONS, TIMEZONE_OPTIONS } from "@/lib/industryTemplates";
import { cn } from "@/lib/utils";

interface Step1Data {
  orgName: string;
  timezone: string;
  industry: Industry;
}

interface Props {
  data: Step1Data;
  onChange: (data: Step1Data) => void;
  onNext: () => void;
}

export default function OnboardingStep1({ data, onChange, onNext }: Props) {
  const [attempted, setAttempted] = useState(false);
  const [tzOpen, setTzOpen] = useState(false);

  const isValid = data.orgName.trim().length > 0 && data.timezone && data.industry;

  const handleContinue = () => {
    setAttempted(true);
    if (isValid) onNext();
  };

  const selectedTzLabel = TIMEZONE_OPTIONS.find((tz) => tz.value === data.timezone)?.label;

  return (
    <div className="space-y-8">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl gradient-ocean shadow-ocean">
          <Building2 className="w-7 h-7 text-primary-foreground" />
        </div>
        <h2 className="text-2xl font-bold">Company Basics</h2>
        <p className="text-muted-foreground text-sm">Tell us about your organization to get started.</p>
      </div>

      <div className="max-w-md mx-auto space-y-5">
        <div className="space-y-2">
          <Label htmlFor="orgName">Organization Name</Label>
          <Input
            id="orgName"
            placeholder="e.g. Blue Harbor Restaurant"
            value={data.orgName}
            onChange={(e) => onChange({ ...data, orgName: e.target.value })}
            maxLength={100}
            autoFocus
          />
          {attempted && !data.orgName.trim() && (
            <p className="text-xs text-destructive">This field is required</p>
          )}
        </div>

        <div className="space-y-2">
          <Label>Timezone</Label>
          <Popover open={tzOpen} onOpenChange={setTzOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={tzOpen}
                className="w-full justify-between font-normal"
              >
                {selectedTzLabel || "Select timezone…"}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
              <Command>
                <CommandInput placeholder="Search timezone…" />
                <CommandList>
                  <CommandEmpty>No timezone found.</CommandEmpty>
                  <CommandGroup>
                    {TIMEZONE_OPTIONS.map((tz) => (
                      <CommandItem
                        key={tz.value}
                        value={tz.label}
                        onSelect={() => {
                          onChange({ ...data, timezone: tz.value });
                          setTzOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            data.timezone === tz.value ? "opacity-100" : "opacity-0"
                          )}
                        />
                        {tz.label}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          {attempted && !data.timezone && (
            <p className="text-xs text-destructive">This field is required</p>
          )}
        </div>

        <div className="space-y-2">
          <Label>Industry</Label>
          <Select value={data.industry} onValueChange={(v) => onChange({ ...data, industry: v as Industry })}>
            <SelectTrigger>
              <SelectValue placeholder="Select industry…" />
            </SelectTrigger>
            <SelectContent>
              {INDUSTRY_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {attempted && !data.industry && (
            <p className="text-xs text-destructive">This field is required</p>
          )}
        </div>

        <Button onClick={handleContinue} disabled={false} className="w-full mt-4" size="lg">
          Continue
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
