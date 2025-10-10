-- Mark duplicate task routines as inactive instead of deleting (keeps foreign key integrity)
WITH duplicates AS (
  SELECT 
    id,
    title,
    org_id,
    created_at,
    ROW_NUMBER() OVER (PARTITION BY org_id, title ORDER BY created_at ASC) as rn
  FROM task_routines
  WHERE active = true
)
UPDATE task_routines
SET active = false,
    archived_at = NOW()
WHERE id IN (
  SELECT id 
  FROM duplicates 
  WHERE rn > 1
);