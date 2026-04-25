
-- Drop FK constraints to auth.users so we can insert demo employee data
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_user_id_fkey;
ALTER TABLE public.submissions DROP CONSTRAINT IF EXISTS submissions_user_id_fkey;
ALTER TABLE public.risk_assessments DROP CONSTRAINT IF EXISTS risk_assessments_user_id_fkey;
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_fkey;

-- Recreate the trigger to clean up profiles when an auth user is deleted
CREATE OR REPLACE FUNCTION public.handle_user_deleted()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.profiles WHERE user_id = OLD.id;
  DELETE FROM public.submissions WHERE user_id = OLD.id;
  DELETE FROM public.risk_assessments WHERE user_id = OLD.id;
  DELETE FROM public.user_roles WHERE user_id = OLD.id;
  RETURN OLD;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_deleted ON auth.users;
CREATE TRIGGER on_auth_user_deleted AFTER DELETE ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_user_deleted();
