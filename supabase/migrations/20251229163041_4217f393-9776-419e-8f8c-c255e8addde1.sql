-- Create encryption_history table
CREATE TABLE public.encryption_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cover_image_url TEXT,
  stego_image_url TEXT,
  message TEXT,
  operation_type TEXT NOT NULL CHECK (operation_type IN ('encode', 'decode')),
  status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'error')),
  filename TEXT,
  psnr_value DECIMAL(10,2),
  ssim_score DECIMAL(10,4),
  encoding_time_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.encryption_history ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own history" 
ON public.encryption_history 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own history" 
ON public.encryption_history 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own history" 
ON public.encryption_history 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_encryption_history_updated_at
BEFORE UPDATE ON public.encryption_history
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster user queries
CREATE INDEX idx_encryption_history_user_id ON public.encryption_history(user_id);
CREATE INDEX idx_encryption_history_created_at ON public.encryption_history(created_at DESC);