-- Add template linking and flag to shifts table
ALTER TABLE shifts 
ADD COLUMN template_shift_id UUID REFERENCES shifts(id) ON DELETE SET NULL,
ADD COLUMN is_template BOOLEAN DEFAULT false;

-- Create index for template queries
CREATE INDEX idx_shifts_template ON shifts(is_template, archived_at) WHERE is_template = true;
CREATE INDEX idx_shifts_template_id ON shifts(template_shift_id) WHERE template_shift_id IS NOT NULL;

-- Mark existing shifts with start_time but no start_at as templates
UPDATE shifts 
SET is_template = true 
WHERE start_time IS NOT NULL 
  AND end_time IS NOT NULL 
  AND start_at IS NULL 
  AND end_at IS NULL;