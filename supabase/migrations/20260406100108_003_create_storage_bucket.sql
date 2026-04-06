/*
  # Create Storage Bucket for Driver Documents

  1. Storage
    - Create `driver-documents` bucket
    - Set public access for uploaded documents
    - Add RLS policies for secure uploads

  2. Security
    - Only drivers can upload to their own folder
    - Documents are publicly readable (for admin review)
*/

-- Create storage bucket for driver documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('driver-documents', 'driver-documents', true)
ON CONFLICT (id) DO NOTHING;

-- Allow drivers to upload documents to their own folder
CREATE POLICY "Drivers can upload own documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'driver-documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow drivers to read own documents
CREATE POLICY "Drivers can read own documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'driver-documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow public read access for admin review
CREATE POLICY "Public can read driver documents"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'driver-documents');

-- Allow drivers to update own documents
CREATE POLICY "Drivers can update own documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'driver-documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow drivers to delete own documents
CREATE POLICY "Drivers can delete own documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'driver-documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
