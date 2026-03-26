-- Add tier column to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tier INTEGER DEFAULT 0;
