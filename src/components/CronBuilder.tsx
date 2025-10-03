import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';

interface CronConfig {
  frequency: 'daily' | 'weekly' | 'monthly';
  hour: string;
  minute: string;
  daysOfWeek?: number[];
  dayOfMonth?: string;
}

interface CronBuilderProps {
  value: string;
  onChange: (cronExpression: string) => void;
}

export function CronBuilder({ value, onChange }: CronBuilderProps) {
  const [config, setConfig] = useState<CronConfig>(() => parseCronExpression(value));

  const updateConfig = (updates: Partial<CronConfig>) => {
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);
    onChange(buildCronExpression(newConfig));
  };

  const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
  const minutes = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));
  const daysOfMonth = Array.from({ length: 31 }, (_, i) => (i + 1).toString());

  const daysOfWeekLabels = [
    { label: 'Sunday', value: 0 },
    { label: 'Monday', value: 1 },
    { label: 'Tuesday', value: 2 },
    { label: 'Wednesday', value: 3 },
    { label: 'Thursday', value: 4 },
    { label: 'Friday', value: 5 },
    { label: 'Saturday', value: 6 },
  ];

  const toggleDay = (day: number) => {
    const days = config.daysOfWeek || [];
    const newDays = days.includes(day)
      ? days.filter(d => d !== day)
      : [...days, day].sort();
    updateConfig({ daysOfWeek: newDays });
  };

  const getHumanReadable = () => {
    const time = `${config.hour}:${config.minute}`;
    if (config.frequency === 'daily') {
      return `Every day at ${time}`;
    } else if (config.frequency === 'weekly') {
      if (!config.daysOfWeek || config.daysOfWeek.length === 0) {
        return `Weekly at ${time} (select days)`;
      }
      const dayNames = config.daysOfWeek.map(d => daysOfWeekLabels[d].label.slice(0, 3)).join(', ');
      return `Every ${dayNames} at ${time}`;
    } else {
      const day = config.dayOfMonth || '1';
      return `Monthly on day ${day} at ${time}`;
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <Label>Frequency</Label>
        <Select value={config.frequency} onValueChange={(v) => updateConfig({ frequency: v as CronConfig['frequency'] })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="daily">Daily</SelectItem>
            <SelectItem value="weekly">Weekly</SelectItem>
            <SelectItem value="monthly">Monthly</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Hour</Label>
          <Select value={config.hour} onValueChange={(v) => updateConfig({ hour: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-48">
              {hours.map(h => (
                <SelectItem key={h} value={h}>{h}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Minute</Label>
          <Select value={config.minute} onValueChange={(v) => updateConfig({ minute: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-48">
              {minutes.map(m => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {config.frequency === 'weekly' && (
        <div>
          <Label>Days of Week</Label>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {daysOfWeekLabels.map(({ label, value }) => (
              <div key={value} className="flex items-center space-x-2">
                <Checkbox
                  checked={config.daysOfWeek?.includes(value) || false}
                  onCheckedChange={() => toggleDay(value)}
                />
                <label className="text-sm">{label}</label>
              </div>
            ))}
          </div>
        </div>
      )}

      {config.frequency === 'monthly' && (
        <div>
          <Label>Day of Month</Label>
          <Select value={config.dayOfMonth || '1'} onValueChange={(v) => updateConfig({ dayOfMonth: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-48">
              {daysOfMonth.map(d => (
                <SelectItem key={d} value={d}>{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="p-3 bg-muted rounded-md">
        <p className="text-sm font-medium">{getHumanReadable()}</p>
      </div>
    </div>
  );
}

function parseCronExpression(cron: string): CronConfig {
  const parts = cron.split(' ');
  if (parts.length < 5) {
    return { frequency: 'daily', hour: '09', minute: '00' };
  }

  const [minute, hour, dayOfMonth, , dayOfWeek] = parts;

  if (dayOfWeek !== '*') {
    const days = dayOfWeek.split(',').map(Number);
    return { frequency: 'weekly', hour, minute, daysOfWeek: days };
  }

  if (dayOfMonth !== '*') {
    return { frequency: 'monthly', hour, minute, dayOfMonth };
  }

  return { frequency: 'daily', hour, minute };
}

function buildCronExpression(config: CronConfig): string {
  const { hour, minute } = config;

  if (config.frequency === 'daily') {
    return `${minute} ${hour} * * *`;
  }

  if (config.frequency === 'weekly') {
    const days = config.daysOfWeek && config.daysOfWeek.length > 0
      ? config.daysOfWeek.join(',')
      : '*';
    return `${minute} ${hour} * * ${days}`;
  }

  if (config.frequency === 'monthly') {
    const day = config.dayOfMonth || '1';
    return `${minute} ${hour} ${day} * *`;
  }

  return `${minute} ${hour} * * *`;
}
