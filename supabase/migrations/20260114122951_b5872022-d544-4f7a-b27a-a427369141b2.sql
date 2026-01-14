-- Create storage bucket for steganography images
INSERT INTO storage.buckets (id, name, public)
VALUES ('stego-images', 'stego-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload images
CREATE POLICY "Authenticated users can upload stego images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'stego-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow users to view their own images
CREATE POLICY "Users can view their own stego images"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'stego-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow public access to stego images (for download)
CREATE POLICY "Public can view stego images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'stego-images');

-- Allow users to delete their own images
CREATE POLICY "Users can delete their own stego images"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'stego-images' AND auth.uid()::text = (storage.foldername(name))[1]);