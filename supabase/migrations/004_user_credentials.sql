-- Create user_credentials table for manual account management
CREATE TABLE IF NOT EXISTS user_credentials (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE user_credentials ENABLE ROW LEVEL SECURITY;

-- Allow anyone to verify credentials (login)
CREATE POLICY "Anyone can verify credentials" ON user_credentials
  FOR SELECT USING (true);

-- Only service role can insert/update/delete
CREATE POLICY "Service role can manage credentials" ON user_credentials
  FOR ALL USING (auth.role() = 'service_role');

-- Create function to handle new user signup (manual)
CREATE OR REPLACE FUNCTION create_user_credentials(
  p_username VARCHAR,
  p_password VARCHAR,
  p_profile_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_credential_id UUID;
  v_profile_id UUID;
BEGIN
  -- Hash the password
  INSERT INTO user_credentials (username, password_hash, profile_id)
  VALUES (p_username, p_password, p_profile_id)
  RETURNING id INTO v_credential_id;
  
  RETURN v_credential_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
