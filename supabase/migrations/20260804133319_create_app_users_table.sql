/*
# Create app_users table for staff management

1. New Tables
   - `app_users` — stores staff accounts managed by the owner/admin.
     - `id` (uuid, PK)
     - `email` (text, unique)
     - `password` (text — stored in plain text for this demo app; in production this would be hashed)
     - `full_name` (text)
     - `role` (text: 'owner' | 'assistant' | 'kasir', default 'kasir')
     - `is_active` (boolean, default true)
     - `created_at` (timestamptz)

2. Security
   - RLS enabled on `app_users`.
   - CRUD allowed for anon + authenticated (the app uses anon-key client with localStorage-based auth).

3. Seed Data
   - Three default accounts: owner, assistant, kasir (matching the existing demo accounts).

4. Notes
   - This table replaces the hardcoded DEMO_USERS array in auth.tsx.
   - The frontend reads from this table to authenticate and to manage users.
*/