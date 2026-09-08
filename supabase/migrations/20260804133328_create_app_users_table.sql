/*
# Create app_users table for staff management

1. New Tables
   - `app_users` — stores staff accounts managed by the owner/admin.
     - `id` (uuid, PK)
     - `email` (text, unique)
     - `password` (text)
     - `full_name` (text)
     - `role` (text: 'owner' | 'assistant' | 'kasir', default 'kasir')
     - `is_active` (boolean, default true)
     - `created_at` (timestamptz)

2. Security
   - RLS enabled on `app_users`.
   - CRUD allowed for anon + authenticated.

3. Seed Data
   - Three default accounts: owner, assistant, kasir.
*/

CREATE TABLE IF NOT EXISTS public.app_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  password text NOT NULL,
  full_name text NOT NULL,
  role text NOT NULL DEFAULT 'kasir' CHECK (role IN ('owner', 'assistant', 'kasir')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_app_users" ON public.app_users;
CREATE POLICY "anon_select_app_users" ON public.app_users FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_app_users" ON public.app_users;
CREATE POLICY "anon_insert_app_users" ON public.app_users FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_app_users" ON public.app_users;
CREATE POLICY "anon_update_app_users" ON public.app_users FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_app_users" ON public.app_users;
CREATE POLICY "anon_delete_app_users" ON public.app_users FOR DELETE
  TO anon, authenticated USING (true);

-- Seed default accounts
INSERT INTO public.app_users (email, password, full_name, role, is_active) VALUES
  ('owner@apotek.id', 'owner123', 'Owner Apotek', 'owner', true),
  ('assistant@apotek.id', 'assistant123', 'Assistant Apotek', 'assistant', true),
  ('kasir@apotek.id', 'kasir123', 'Kasir Apotek', 'kasir', true)
ON CONFLICT (email) DO NOTHING;