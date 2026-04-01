
CREATE OR REPLACE FUNCTION public.admin_get_operations_over_time()
RETURNS JSON
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result JSON;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT json_agg(row_to_json(t)) INTO result
  FROM (
    SELECT
      to_char(d.day, 'YYYY-MM-DD') AS date,
      COALESCE(enc.cnt, 0) AS encodes,
      COALESCE(dec.cnt, 0) AS decodes,
      COALESCE(enc.cnt, 0) + COALESCE(dec.cnt, 0) AS total
    FROM generate_series(
      CURRENT_DATE - INTERVAL '29 days',
      CURRENT_DATE,
      '1 day'
    ) AS d(day)
    LEFT JOIN (
      SELECT DATE(created_at) AS day, COUNT(*) AS cnt
      FROM public.encryption_history
      WHERE operation_type = 'encode'
        AND created_at >= CURRENT_DATE - INTERVAL '29 days'
      GROUP BY DATE(created_at)
    ) enc ON enc.day = d.day
    LEFT JOIN (
      SELECT DATE(created_at) AS day, COUNT(*) AS cnt
      FROM public.encryption_history
      WHERE operation_type = 'decode'
        AND created_at >= CURRENT_DATE - INTERVAL '29 days'
      GROUP BY DATE(created_at)
    ) dec ON dec.day = d.day
    ORDER BY d.day
  ) t;

  RETURN COALESCE(result, '[]'::json);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_get_quality_over_time()
RETURNS JSON
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result JSON;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT json_agg(row_to_json(t)) INTO result
  FROM (
    SELECT
      to_char(d.day, 'YYYY-MM-DD') AS date,
      ROUND(AVG(eh.psnr_value)::numeric, 2) AS avg_psnr,
      ROUND(AVG(eh.ssim_score)::numeric, 4) AS avg_ssim
    FROM generate_series(
      CURRENT_DATE - INTERVAL '29 days',
      CURRENT_DATE,
      '1 day'
    ) AS d(day)
    LEFT JOIN public.encryption_history eh
      ON DATE(eh.created_at) = d.day
      AND eh.psnr_value IS NOT NULL
    GROUP BY d.day
    ORDER BY d.day
  ) t;

  RETURN COALESCE(result, '[]'::json);
END;
$$;
