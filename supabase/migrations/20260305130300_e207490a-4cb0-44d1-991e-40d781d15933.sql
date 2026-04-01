
-- Create app_role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

-- Create user_roles table
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    UNIQUE (user_id, role)
);

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- RLS: users can view their own roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- RLS: admins can view all roles
CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- RLS: admins can manage roles
CREATE POLICY "Admins can insert roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Admin functions to read all profiles
CREATE OR REPLACE FUNCTION public.admin_get_all_profiles()
RETURNS SETOF public.profiles
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.profiles ORDER BY created_at DESC
$$;

-- Admin function to get all encryption history
CREATE OR REPLACE FUNCTION public.admin_get_all_history()
RETURNS SETOF public.encryption_history
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.encryption_history ORDER BY created_at DESC
$$;

-- Admin function to get stats
CREATE OR REPLACE FUNCTION public.admin_get_stats()
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  
  SELECT json_build_object(
    'total_users', (SELECT COUNT(*) FROM public.profiles),
    'total_operations', (SELECT COUNT(*) FROM public.encryption_history),
    'total_encodes', (SELECT COUNT(*) FROM public.encryption_history WHERE operation_type = 'encode'),
    'total_decodes', (SELECT COUNT(*) FROM public.encryption_history WHERE operation_type = 'decode'),
    'operations_today', (SELECT COUNT(*) FROM public.encryption_history WHERE created_at >= CURRENT_DATE),
    'avg_psnr', (SELECT ROUND(AVG(psnr_value)::numeric, 2) FROM public.encryption_history WHERE psnr_value IS NOT NULL),
    'avg_ssim', (SELECT ROUND(AVG(ssim_score)::numeric, 4) FROM public.encryption_history WHERE ssim_score IS NOT NULL)
  ) INTO result;
  
  RETURN result;
END;
$$;

-- Admin function to list storage files
CREATE OR REPLACE FUNCTION public.admin_list_storage_files(bucket TEXT)
RETURNS TABLE (
  id UUID,
  name TEXT,
  bucket_id TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  metadata JSONB
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, storage
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  
  RETURN QUERY
  SELECT o.id, o.name, o.bucket_id, o.created_at, o.updated_at, o.metadata
  FROM storage.objects o
  WHERE o.bucket_id = bucket
  ORDER BY o.created_at DESC
  LIMIT 100;
END;
$$;
