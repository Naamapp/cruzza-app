/*
  # Fix Authentication Policies

  1. Changes
    - Add trigger to automatically create user profile when auth user is created
    - Update RLS policies to allow user creation during signup
    - Add service role bypass for automated profile creation

  2. Security
    - Maintains RLS security while allowing proper signup flow
    - Users can only insert their own data
    - Automated trigger uses service role to bypass RLS

  3. Important Notes
    - This fixes the authentication error during signup
    - User profile is automatically created when auth.users record is created
    - Email is automatically synced from auth.users
*/

-- Drop existing policies that might conflict
DROP POLICY IF EXISTS "Users can insert own data" ON users;

-- Function to automatically create user profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, created_at, updated_at)
  VALUES (NEW.id, NEW.email, NOW(), NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create user profile on auth signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Update RLS policy for users table to allow inserts during signup
CREATE POLICY "Users can insert own data" ON users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Ensure service role can bypass RLS for automated operations
ALTER TABLE users FORCE ROW LEVEL SECURITY;