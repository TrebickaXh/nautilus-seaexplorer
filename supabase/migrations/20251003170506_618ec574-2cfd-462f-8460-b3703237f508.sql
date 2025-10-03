-- First, create a default "General" department for each org that has templates without departments
DO $$
DECLARE
  org_record RECORD;
  default_dept_id UUID;
BEGIN
  FOR org_record IN 
    SELECT DISTINCT org_id 
    FROM task_templates 
    WHERE department_id IS NULL
  LOOP
    -- Check if a "General" department already exists
    SELECT id INTO default_dept_id
    FROM departments
    WHERE org_id = org_record.org_id 
    AND name = 'General'
    LIMIT 1;
    
    -- If not, create it
    IF default_dept_id IS NULL THEN
      INSERT INTO departments (org_id, name, description)
      VALUES (org_record.org_id, 'General', 'Default department for uncategorized tasks')
      RETURNING id INTO default_dept_id;
    END IF;
    
    -- Update templates to use this department
    UPDATE task_templates
    SET department_id = default_dept_id
    WHERE org_id = org_record.org_id 
    AND department_id IS NULL;
  END LOOP;
END $$;

-- Now make department_id required
ALTER TABLE public.task_templates 
ALTER COLUMN department_id SET NOT NULL;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_task_instances_department ON public.task_instances(department_id);
CREATE INDEX IF NOT EXISTS idx_task_instances_shift ON public.task_instances(shift_id);
CREATE INDEX IF NOT EXISTS idx_user_departments_primary ON public.user_departments(user_id, is_primary);
CREATE INDEX IF NOT EXISTS idx_user_shifts_user ON public.user_shifts(user_id);