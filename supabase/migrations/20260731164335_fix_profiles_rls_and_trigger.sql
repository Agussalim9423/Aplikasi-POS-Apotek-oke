/*
# Fix profiles RLS and trigger function

1. Changes
   - Recreate `handle_new_user()` trigger function with empty search_path and
     fully-qualified table references to avoid search_path hijacking issues.
     Add exception handling so a trigger failure never blocks auth operations.
   - Add an INSERT policy on `profiles` for authenticated users (so the trigger
     can insert even if SECURITY DEFINER is removed in the future).
   - Drop and recreate the `on_auth_user_created` trigger.

2. Security
   - RLS already enabled on `profiles`.
   - New INSERT policy: authenticated users can insert their own profile
     (auth.uid() = id). The trigger uses SECURITY DEFINER so it bypasses RLS,
     but having the policy is good defense-in-depth.
   - The trigger function now catches exceptions and returns NEW anyway,
     so a profile creation failure never blocks user signup/login.
*/

-- Recreate the trigger function with robust settings
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  BEGIN
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
      COALESCE(NEW.raw_user_meta_data->>'role', 'kasir')
    )
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    -- Never block user creation if profile insert fails
    RAISE WARNING 'Failed to create profile for user %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

-- Drop and recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Add INSERT policy on profiles (defense-in-depth)
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
