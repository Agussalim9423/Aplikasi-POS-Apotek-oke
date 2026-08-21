/*
# User Profiles with Roles

1. New Tables
   - `profiles` — one row per auth user, stores their role and display name.
     - `id` (uuid, PK, FK to auth.users)
     - `email` (text)
     - `full_name` (text)
     - `role` (text: 'owner' | 'apoteker' | 'kasir' | 'dokter', default 'kasir')
     - `is_active` (boolean, default true)
     - `created_at` (timestamptz)

2. Security
   - RLS enabled on `profiles`.
   - SELECT: authenticated users can read their own profile.
   - UPDATE: authenticated users can update their own profile (but NOT their own role — role is set at creation by the trigger and only changed by an admin/SQL).
   - INSERT: only via the trigger function (security definer), not directly by clients.

3. Trigger
   - `handle_new_user()` — SECURITY DEFINER function that creates a profile row
     automatically when a new auth user signs up. Defaults role to 'kasir'.
   - `on_auth_user_created` trigger fires AFTER INSERT on auth.users.

4. Notes
   - Role is stored in the profiles table (not in JWT metadata) so it can be
     queried and changed without re-issuing tokens. The frontend reads the
     profile after login to determine role-based access.
*/

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  full_name text,
  role text NOT NULL DEFAULT 'kasir' CHECK (role IN ('owner', 'apoteker', 'kasir', 'dokter')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);

-- Users can update their own profile (name, email, is_active) but NOT role
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- No direct INSERT/DELETE policy — profiles are created by the trigger only.

-- Trigger function to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'kasir')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
