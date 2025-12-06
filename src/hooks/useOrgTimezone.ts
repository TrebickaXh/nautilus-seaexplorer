import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface OrgTimezoneResult {
  timezone: string;
  loading: boolean;
  error: Error | null;
}

/**
 * Hook to fetch and cache the organization's timezone
 * Returns 'UTC' as default if not found
 */
export function useOrgTimezone(): OrgTimezoneResult {
  const [timezone, setTimezone] = useState<string>('UTC');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchTimezone = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setTimezone('UTC');
          setLoading(false);
          return;
        }

        // Get user's org_id from profile
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('org_id')
          .eq('id', user.id)
          .single();

        if (profileError || !profile?.org_id) {
          console.error('Failed to get org_id:', profileError);
          setTimezone('UTC');
          setLoading(false);
          return;
        }

        // Get organization's timezone
        const { data: org, error: orgError } = await supabase
          .from('organizations')
          .select('timezone')
          .eq('id', profile.org_id)
          .single();

        if (orgError) {
          console.error('Failed to get org timezone:', orgError);
          setTimezone('UTC');
        } else {
          setTimezone(org?.timezone || 'UTC');
        }
      } catch (err: any) {
        console.error('Error fetching timezone:', err);
        setError(err);
        setTimezone('UTC');
      } finally {
        setLoading(false);
      }
    };

    fetchTimezone();
  }, []);

  return { timezone, loading, error };
}

/**
 * Get the start of day in a specific timezone
 */
export function getStartOfDayInTimezone(date: Date, timezone: string): Date {
  // Format the date in the target timezone to get the local date
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const localDateStr = formatter.format(date);
  
  // Create a date string for midnight in that timezone
  const midnightStr = `${localDateStr}T00:00:00`;
  
  // Convert back to UTC by accounting for the timezone offset
  const tempDate = new Date(midnightStr);
  const targetOffset = getTimezoneOffset(timezone, tempDate);
  
  // Return the UTC timestamp that represents midnight in the target timezone
  return new Date(tempDate.getTime() + targetOffset);
}

/**
 * Get the end of day in a specific timezone
 */
export function getEndOfDayInTimezone(date: Date, timezone: string): Date {
  // Format the date in the target timezone to get the local date
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const localDateStr = formatter.format(date);
  
  // Create a date string for end of day in that timezone
  const endOfDayStr = `${localDateStr}T23:59:59.999`;
  
  // Convert back to UTC by accounting for the timezone offset
  const tempDate = new Date(endOfDayStr);
  const targetOffset = getTimezoneOffset(timezone, tempDate);
  
  return new Date(tempDate.getTime() + targetOffset);
}

/**
 * Get timezone offset in milliseconds
 */
function getTimezoneOffset(timezone: string, date: Date): number {
  // Get the offset by comparing UTC and local times
  const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
  const tzDate = new Date(date.toLocaleString('en-US', { timeZone: timezone }));
  return utcDate.getTime() - tzDate.getTime();
}

/**
 * Get today's date string (YYYY-MM-DD) in a specific timezone
 */
export function getTodayInTimezone(timezone: string): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(new Date());
}

/**
 * Check if a date is overdue based on org timezone
 */
export function isOverdueInTimezone(dueAt: Date | string, timezone: string): boolean {
  const dueDate = typeof dueAt === 'string' ? new Date(dueAt) : dueAt;
  const now = new Date();
  return dueDate < now;
}

/**
 * Get current time formatted in a specific timezone
 */
export function getCurrentTimeInTimezone(timezone: string): string {
  return new Date().toLocaleTimeString('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/**
 * Get day of week in a specific timezone (0 = Sunday, 6 = Saturday)
 */
export function getDayOfWeekInTimezone(date: Date, timezone: string): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
  });
  const dayStr = formatter.format(date);
  const dayMap: Record<string, number> = {
    'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6
  };
  return dayMap[dayStr] ?? date.getDay();
}
