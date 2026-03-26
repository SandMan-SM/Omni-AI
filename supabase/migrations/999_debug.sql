-- Check all users in user_credentials
SELECT username, password_hash, profile_id FROM user_credentials;

-- Check all profiles
SELECT id, username, email, tier, role FROM profiles;
