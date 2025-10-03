-- Create storage bucket for task completion photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('task-photos', 'task-photos', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for task photos bucket
CREATE POLICY "Users can view task photos"
ON storage.objects
FOR SELECT
USING (bucket_id = 'task-photos');

CREATE POLICY "Users can upload task photos"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'task-photos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own task photos"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'task-photos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own task photos"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'task-photos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);