-- Add CPS profile and credentials
INSERT INTO profiles (id, username, email, tier, role, is_sponsor, is_admin, created_at, updated_at)
VALUES (gen_random_uuid(), 'CPS', 'cps@example.com', 2, 'user', false, false, NOW(), NOW());

-- Add CPS credentials (links to CPS profile)
INSERT INTO user_credentials (username, password_hash, profile_id)
VALUES ('CPS', 'Wise411!', (SELECT id FROM profiles WHERE username = 'CPS' ORDER BY created_at DESC LIMIT 1));
