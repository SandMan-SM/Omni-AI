-- Add $Mafi as Admin user

-- Check if profile exists and update or insert
DO $$
DECLARE
  profile_id uuid;
BEGIN
  SELECT id INTO profile_id FROM profiles WHERE username = '$Mafi';
  
  IF profile_id IS NULL THEN
    INSERT INTO profiles (id, username, email, tier, role, is_admin, is_sponsor, created_at, updated_at)
    VALUES (
      gen_random_uuid(),
      '$Mafi',
      'mafi@admin.com',
      0,
      'admin',
      true,
      false,
      NOW(),
      NOW()
    );
    SELECT id INTO profile_id FROM profiles WHERE username = '$Mafi';
  ELSE
    UPDATE profiles SET is_admin = true, role = 'admin', updated_at = NOW() WHERE id = profile_id;
  END IF;

  -- Insert or update credentials
  IF NOT EXISTS (SELECT 1 FROM user_credentials WHERE username = '$Mafi') THEN
    INSERT INTO user_credentials (username, password_hash, profile_id)
    VALUES ('$Mafi', 'NHAT88!', profile_id);
  ELSE
    UPDATE user_credentials SET password_hash = 'NHAT88!', profile_id = profile_id WHERE username = '$Mafi';
  END IF;
END $$;

-- Verify
SELECT 'Profile:' as type, username, email, role, is_admin FROM profiles WHERE username = '$Mafi'
UNION ALL
SELECT 'Credentials:' as type, username, '***' as email, '***' as role, false as is_admin FROM user_credentials WHERE username = '$Mafi';
