-- Fix storage policies - drop with IF EXISTS to handle already existing
DROP POLICY IF EXISTS "Users can update their own task photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own task photos" ON storage.objects;

-- Recreate update policy
CREATE POLICY "Users can update their own task photos"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'task-photos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Recreate delete policy
CREATE POLICY "Users can delete their own task photos"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'task-photos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);