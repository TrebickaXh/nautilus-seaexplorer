-- Enable pg_cron and pg_net extensions for background job scheduling
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule task materialization job - runs every 6 hours
-- This generates task instances for the next 7 days based on active schedules
SELECT cron.schedule(
  'materialize-tasks-6hr',
  '0 */6 * * *',
  $$
  SELECT net.http_post(
    url:='https://pmkhyxlpaclserfbkxka.supabase.co/functions/v1/materialize-tasks',
    headers:='{"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBta2h5eGxwYWNsc2VyZmJreGthIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0MzY3NDcsImV4cCI6MjA3NTAxMjc0N30.0o_qG3TZa3pzDeJ3aHvcSpuSO13hk9IDTWvQjigTyxg", "Content-Type": "application/json"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);

-- Schedule urgency update job - runs every 5 minutes
-- This recalculates urgency scores for pending tasks based on current time
SELECT cron.schedule(
  'update-urgency-5min',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url:='https://pmkhyxlpaclserfbkxka.supabase.co/functions/v1/update-urgency',
    headers:='{"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBta2h5eGxwYWNsc2VyZmJreGthIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0MzY3NDcsImV4cCI6MjA3NTAxMjc0N30.0o_qG3TZa3pzDeJ3aHvcSpuSO13hk9IDTWvQjigTyxg", "Content-Type": "application/json"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);