-- Add sponsor_tier column to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS sponsor_tier TEXT DEFAULT NULL;
