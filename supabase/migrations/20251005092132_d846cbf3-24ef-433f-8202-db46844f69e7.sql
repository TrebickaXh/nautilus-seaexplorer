-- Migration: Consolidate task_instances to use only routine_id
-- This migration safely removes the template_id column after copying any remaining data

-- Step 1: Copy any data from template_id to routine_id if routine_id is null
UPDATE task_instances 
SET routine_id = template_id 
WHERE routine_id IS NULL AND template_id IS NOT NULL;

-- Step 2: Drop the foreign key constraint on template_id
ALTER TABLE task_instances 
DROP CONSTRAINT IF EXISTS task_instances_template_id_fkey;

-- Step 3: Drop the template_id column
ALTER TABLE task_instances 
DROP COLUMN IF EXISTS template_id;

-- Step 4: Ensure routine_id is NOT NULL (it should have data now)
ALTER TABLE task_instances 
ALTER COLUMN routine_id SET NOT NULL;