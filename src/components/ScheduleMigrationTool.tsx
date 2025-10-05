import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function ScheduleMigrationTool() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    migrated: number;
    failed: number;
    messages: string[];
  } | null>(null);

  const migrateSchedules = async () => {
    setLoading(true);
    setResult(null);

    try {
      const messages: string[] = [];
      let migrated = 0;
      let failed = 0;

      // Fetch all active schedules
      const { data: schedules, error: schedError } = await supabase
        .from('schedules')
        .select(`
          *,
          task_routines (
            id,
            title,
            location_id,
            department_id,
            shift_id,
            area_ids
          )
        `)
        .not('archived_at', 'is', null);

      if (schedError) throw schedError;

      if (!schedules || schedules.length === 0) {
        messages.push('No schedules found to migrate');
        setResult({ migrated, failed, messages });
        return;
      }

      messages.push(`Found ${schedules.length} schedules to migrate`);

      for (const schedule of schedules) {
        try {
          const routine = schedule.task_routines;
          
          if (!routine) {
            messages.push(`❌ Schedule ${schedule.id}: No associated routine found`);
            failed++;
            continue;
          }

          // Build recurrence object based on schedule type
          let recurrence: any = null;

          if (schedule.type === 'window') {
            // Convert window to weekly with a single time
            const timeOfDay = schedule.window_start || '09:00';
            recurrence = {
              type: 'weekly',
              time_of_day: timeOfDay,
              days_of_week: schedule.days_of_week || [],
            };
            messages.push(`✓ Schedule ${schedule.id}: Converted window to weekly`);
          } else if (schedule.type === 'cron') {
            // Attempt to parse cron expression
            const cronExpr = schedule.cron_expr || '';
            
            // Simple cron parser (this is basic - complex cron may need manual review)
            if (cronExpr === '0 9 * * *') {
              recurrence = {
                type: 'daily',
                time_of_day: '09:00',
              };
              messages.push(`✓ Schedule ${schedule.id}: Converted daily cron`);
            } else if (cronExpr.match(/^0 \d+ \* \* [0-6]$/)) {
              // Weekly pattern
              const parts = cronExpr.split(' ');
              const hour = parts[1];
              const dayOfWeek = parseInt(parts[4]);
              recurrence = {
                type: 'weekly',
                time_of_day: `${hour}:00`,
                days_of_week: [dayOfWeek],
              };
              messages.push(`✓ Schedule ${schedule.id}: Converted weekly cron`);
            } else {
              messages.push(`⚠️ Schedule ${schedule.id}: Complex cron '${cronExpr}' - needs manual review`);
              failed++;
              continue;
            }
          } else if (schedule.type === 'oneoff') {
            messages.push(`ℹ️ Schedule ${schedule.id}: One-off schedule - skipped (create as one-off task instead)`);
            continue;
          }

          if (!recurrence) {
            messages.push(`❌ Schedule ${schedule.id}: Could not determine recurrence`);
            failed++;
            continue;
          }

          // Update the routine with recurrence_v2
          const { error: updateError } = await supabase
            .from('task_routines')
            .update({ recurrence_v2: recurrence })
            .eq('id', routine.id);

          if (updateError) {
            messages.push(`❌ Schedule ${schedule.id}: Update failed - ${updateError.message}`);
            failed++;
            continue;
          }

          migrated++;
        } catch (error: any) {
          messages.push(`❌ Schedule ${schedule.id}: Error - ${error.message}`);
          failed++;
        }
      }

      messages.push(`\n✅ Migration complete: ${migrated} migrated, ${failed} failed/skipped`);
      setResult({ migrated, failed, messages });

      toast({
        title: 'Migration Complete',
        description: `${migrated} schedules migrated successfully`,
      });

    } catch (error: any) {
      toast({
        title: 'Migration Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Schedule Migration Tool</CardTitle>
        <CardDescription>
          Migrate existing schedules to the new recurrence model (task_routines.recurrence_v2)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            This tool will convert your existing schedules into the new recurrence format. 
            Simple patterns (daily, weekly) are converted automatically. Complex cron expressions 
            may require manual review. This is a one-time migration.
          </AlertDescription>
        </Alert>

        <Button 
          onClick={migrateSchedules} 
          disabled={loading}
          className="w-full"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Migrating...
            </>
          ) : (
            'Start Migration'
          )}
        </Button>

        {result && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="font-medium">
                {result.migrated} migrated, {result.failed} failed/skipped
              </span>
            </div>

            <div className="border rounded-md p-4 max-h-96 overflow-y-auto">
              <pre className="text-xs whitespace-pre-wrap">
                {result.messages.join('\n')}
              </pre>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
