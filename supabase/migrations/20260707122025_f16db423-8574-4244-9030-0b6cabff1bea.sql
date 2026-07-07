
CREATE TABLE public.evaluation_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  image_a_name TEXT,
  image_b_name TEXT,
  psnr NUMERIC,
  mse NUMERIC,
  ssim NUMERIC,
  max_error NUMERIC,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.evaluation_metrics TO authenticated;
GRANT ALL ON public.evaluation_metrics TO service_role;

ALTER TABLE public.evaluation_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own metrics"
  ON public.evaluation_metrics FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own metrics"
  ON public.evaluation_metrics FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own metrics"
  ON public.evaluation_metrics FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own metrics"
  ON public.evaluation_metrics FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all metrics"
  ON public.evaluation_metrics FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_evaluation_metrics_user_id ON public.evaluation_metrics(user_id);
CREATE INDEX idx_evaluation_metrics_created_at ON public.evaluation_metrics(created_at DESC);

CREATE TRIGGER update_evaluation_metrics_updated_at
  BEFORE UPDATE ON public.evaluation_metrics
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
