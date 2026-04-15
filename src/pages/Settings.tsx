import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useUserRole } from '@/hooks/useUserRole';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Zap } from 'lucide-react';
import { ScheduleMigrationTool } from '@/components/ScheduleMigrationTool';

export default function Settings() {
  const navigate = useNavigate();
  const { primaryRole, loading: roleLoading } = useUserRole();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [orgName, setOrgName] = useState('');
  const [timezone, setTimezone] = useState('');

  // Fetch organization data
  const { data: organization, isLoading } = useQuery({
    queryKey: ['organization'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profile } = await supabase
        .from('profiles')
        .select('org_id')
        .eq('id', user.id)
        .single();

      if (!profile) throw new Error('Profile not found');

      const { data: org, error } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', profile.org_id)
        .single();

      if (error) throw error;
      
      setOrgName(org.name);
      setTimezone(org.timezone);
      
      return org;
    },
  });

  const updateOrgMutation = useMutation({
    mutationFn: async (updates: { name?: string; timezone?: string }) => {
      if (!organization) throw new Error('No organization');

      const { error } = await supabase
        .from('organizations')
        .update(updates)
        .eq('id', organization.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization'] });
      toast({
        title: 'Settings updated',
        description: 'Organization settings have been saved.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Redirect if not admin
  useEffect(() => {
    if (!roleLoading && primaryRole !== 'org_admin') {
      navigate('/dashboard');
    }
  }, [roleLoading, primaryRole, navigate]);

  if (isLoading || roleLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const handleSave = () => {
    updateOrgMutation.mutate({
      name: orgName,
      timezone: timezone,
    });
  };

  const timezones = [
    'UTC',
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'America/Phoenix',
    'America/Anchorage',
    'Pacific/Honolulu',
    'Europe/London',
    'Europe/Paris',
    'Asia/Tokyo',
    'Asia/Shanghai',
    'Australia/Sydney',
  ];

  return (
    <div className="container mx-auto p-6 max-w-4xl space-y-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your organization settings</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Organization Settings</CardTitle>
          <CardDescription>
            Update your organization name and timezone
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="org-name">Organization Name</Label>
            <Input
              id="org-name"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="Enter organization name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="timezone">Timezone</Label>
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger id="timezone">
                <SelectValue placeholder="Select timezone" />
              </SelectTrigger>
              <SelectContent>
                {timezones.map((tz) => (
                  <SelectItem key={tz} value={tz}>
                    {tz}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={handleSave}
            disabled={updateOrgMutation.isPending}
            className="w-full sm:w-auto"
          >
            {updateOrgMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Save Changes
          </Button>
        </CardContent>
      </Card>

      {/* Generate Tasks Now */}
      <GenerateTasksCard orgId={organization?.id} toast={toast} />

      <ScheduleMigrationTool />
    </div>
  );
}

function GenerateTasksCard({ orgId, toast }: { orgId?: string; toast: ReturnType<typeof useToast>['toast'] }) {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    if (!orgId) return;
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('materialize-tasks-v2', {
        body: { org_id: orgId },
      });

      if (error) throw error;

      toast({
        title: 'Tasks generated',
        description: `${data.created} task instances created, ${data.skipped} duplicates skipped.${data.errors > 0 ? ` ${data.errors} errors occurred.` : ''}`,
      });
    } catch (err: any) {
      toast({
        title: 'Generation failed',
        description: err.message || 'An unexpected error occurred.',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-primary" />
          Generate Tasks
        </CardTitle>
        <CardDescription>
          Manually generate task instances from your active routines. Use this after creating new routines or to populate tasks for testing.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={handleGenerate} disabled={isGenerating}>
          {isGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Generate Tasks Now
        </Button>
      </CardContent>
    </Card>
  );
}
