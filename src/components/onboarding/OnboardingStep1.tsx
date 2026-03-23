import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, ArrowRight } from "lucide-react";
import { Industry, INDUSTRY_OPTIONS, TIMEZONE_OPTIONS } from "@/lib/industryTemplates";

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
  const isValid = data.orgName.trim().length > 0 && data.timezone && data.industry;

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
        </div>

        <div className="space-y-2">
          <Label>Timezone</Label>
          <Select value={data.timezone} onValueChange={(v) => onChange({ ...data, timezone: v })}>
            <SelectTrigger>
              <SelectValue placeholder="Select timezone…" />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              {TIMEZONE_OPTIONS.map((tz) => (
                <SelectItem key={tz.value} value={tz.value}>
                  {tz.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
        </div>

        <Button onClick={onNext} disabled={!isValid} className="w-full mt-4" size="lg">
          Continue
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
