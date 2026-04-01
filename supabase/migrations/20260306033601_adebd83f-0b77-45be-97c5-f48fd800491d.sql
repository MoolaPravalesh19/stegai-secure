
CREATE OR REPLACE FUNCTION public.admin_delete_user(target_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_history_count int;
  deleted_files_count int;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- Prevent deleting yourself
  IF target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot delete your own account';
  END IF;

  -- Delete encryption history
  DELETE FROM public.encryption_history WHERE user_id = target_user_id;
  GET DIAGNOSTICS deleted_history_count = ROW_COUNT;

  -- Delete user roles
  DELETE FROM public.user_roles WHERE user_id = target_user_id;

  -- Delete profile
  DELETE FROM public.profiles WHERE user_id = target_user_id;

  -- Delete from auth.users (cascades)
  DELETE FROM auth.users WHERE id = target_user_id;

  RETURN json_build_object(
    'success', true,
    'deleted_history', deleted_history_count
  );
END;
$$;
