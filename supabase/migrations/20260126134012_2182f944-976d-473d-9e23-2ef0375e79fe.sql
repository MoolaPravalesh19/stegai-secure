-- Create storage bucket for ONNX models
INSERT INTO storage.buckets (id, name, public)
VALUES ('onnx-models', 'onnx-models', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to read models (public access for inference)
CREATE POLICY "Anyone can view models"
ON storage.objects FOR SELECT
USING (bucket_id = 'onnx-models');

-- Only authenticated users can upload/update models (admin feature)
CREATE POLICY "Authenticated users can upload models"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'onnx-models' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update models"
ON storage.objects FOR UPDATE
USING (bucket_id = 'onnx-models' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete models"
ON storage.objects FOR DELETE
USING (bucket_id = 'onnx-models' AND auth.role() = 'authenticated');