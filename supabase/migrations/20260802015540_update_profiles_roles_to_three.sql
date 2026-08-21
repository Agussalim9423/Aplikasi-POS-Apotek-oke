-- Drop old constraint first
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

-- Migrate existing roles to the new 3-role system
UPDATE public.profiles SET role = 'assistant' WHERE role IN ('apoteker', 'dokter');

-- Add new constraint with only 3 roles
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check CHECK (role IN ('owner', 'assistant', 'kasir'));
