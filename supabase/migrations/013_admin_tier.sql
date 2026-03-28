-- Add admin tier support and ensure $Mafi profile is correct

-- Add tier_label column to profiles if it doesn't exist
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tier_label TEXT;

-- Update $Mafi to admin tier
UPDATE profiles
SET
  role = 'admin',
  is_admin = true,
  tier = 99,
  tier_label = 'admin',
  updated_at = NOW()
WHERE username = '$Mafi' OR email IN ('sitanim6@gmail.com', 'sitanim8@gmail.com', 'mafi@admin.com');

-- Add campaigns table for per-user campaign assignments
CREATE TABLE IF NOT EXISTS user_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  campaign_id TEXT NOT NULL,
  name TEXT NOT NULL,
  business TEXT NOT NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('active', 'paused', 'draft', 'completed')),
  thumbnail TEXT DEFAULT 'from-purple-600 to-blue-500',
  budget TEXT DEFAULT '$0',
  platform TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE user_campaigns ENABLE ROW LEVEL SECURITY;

-- Policy: users can only see their own campaigns
CREATE POLICY IF NOT EXISTS "Users can view own campaigns"
  ON user_campaigns FOR SELECT
  USING (profile_id = auth.uid());

-- Policy: admins can see all campaigns
CREATE POLICY IF NOT EXISTS "Admins can view all campaigns"
  ON user_campaigns FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND (is_admin = true OR role = 'admin')
    )
  );

-- Verify $Mafi update
SELECT username, email, role, is_admin, tier, tier_label FROM profiles
WHERE username = '$Mafi' OR email IN ('sitanim6@gmail.com', 'sitanim8@gmail.com', 'mafi@admin.com');
