
-- Disable only user triggers (not system/constraint triggers)
ALTER TABLE task_routines DISABLE TRIGGER USER;

-- Archive all active routines
UPDATE task_routines SET archived_at = now(), active = false WHERE archived_at IS NULL;

-- Re-enable user triggers
ALTER TABLE task_routines ENABLE TRIGGER USER;

-- Delete all pending task instances
DELETE FROM task_instances WHERE status = 'pending';
