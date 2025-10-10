-- Enable required extensions for cron jobs (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Create a cron job to update urgency scores every 5 minutes
SELECT cron.schedule(
  'update-urgency-every-5-minutes',
  '*/5 * * * *',
  $$
  SELECT
    net.http_post(
      url:='https://pmkhyxlpaclserfbkxka.supabase.co/functions/v1/update-urgency',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBta2h5eGxwYWNsc2VyZmJreGthIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0MzY3NDcsImV4cCI6MjA3NTAxMjc0N30.0o_qG3TZa3pzDeJ3aHvcSpuSO13hk9IDTWvQjigTyxg"}'::jsonb,
      body:='{}'::jsonb
    ) as request_id;
  $$
);