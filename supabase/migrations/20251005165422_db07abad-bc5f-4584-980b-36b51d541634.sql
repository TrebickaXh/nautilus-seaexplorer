-- Enable pg_cron extension for scheduled tasks
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable pg_net extension for HTTP requests from cron jobs
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule materialize-tasks-v2 to run every 5 minutes
-- This generates upcoming task instances from task_routines.recurrence_v2
SELECT cron.schedule(
  'materialize-tasks-v2',
  '*/5 * * * *',
  $$
  SELECT
    net.http_post(
      url:='https://pmkhyxlpaclserfbkxka.supabase.co/functions/v1/materialize-tasks-v2',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBta2h5eGxwYWNsc2VyZmJreGthIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0MzY3NDcsImV4cCI6MjA3NTAxMjc0N30.0o_qG3TZa3pzDeJ3aHvcSpuSO13hk9IDTWvQjigTyxg"}'::jsonb,
      body:='{}'::jsonb
    ) as request_id;
  $$
);

-- Schedule defer-tasks to run every hour
-- This automatically defers incomplete tasks to the next shift
SELECT cron.schedule(
  'defer-tasks',
  '0 * * * *',
  $$
  SELECT
    net.http_post(
      url:='https://pmkhyxlpaclserfbkxka.supabase.co/functions/v1/defer-tasks',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBta2h5eGxwYWNsc2VyZmJreGthIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0MzY3NDcsImV4cCI6MjA3NTAxMjc0N30.0o_qG3TZa3pzDeJ3aHvcSpuSO13hk9IDTWvQjigTyxg"}'::jsonb,
      body:='{}'::jsonb
    ) as request_id;
  $$
);

-- Schedule update-urgency to run every 15 minutes
-- This recalculates urgency scores for pending tasks
SELECT cron.schedule(
  'update-urgency',
  '*/15 * * * *',
  $$
  SELECT
    net.http_post(
      url:='https://pmkhyxlpaclserfbkxka.supabase.co/functions/v1/update-urgency',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBta2h5eGxwYWNsc2VyZmJreGthIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0MzY3NDcsImV4cCI6MjA3NTAxMjc0N30.0o_qG3TZa3pzDeJ3aHvcSpuSO13hk9IDTWvQjigTyxg"}'::jsonb,
      body:='{}'::jsonb
    ) as request_id;
  $$
);