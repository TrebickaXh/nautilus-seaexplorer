-- Make routine_id nullable for one-off tasks
-- This allows task_instances to be created without a routine (for one-time tasks)
ALTER TABLE task_instances 
ALTER COLUMN routine_id DROP NOT NULL;