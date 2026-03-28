-- Add CRM fields to profiles for smart list functionality

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS crm_status TEXT DEFAULT 'lead' CHECK (crm_status IN ('lead', 'prospect', 'client', 'churned'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS lead_score TEXT DEFAULT 'cold' CHECK (lead_score IN ('hot', 'warm', 'cold'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS satisfaction_score INTEGER DEFAULT NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_contacted TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS crm_notes TEXT DEFAULT NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS newsletter_subscribed BOOLEAN DEFAULT false;

-- Update existing known clients/sponsors to 'client' status
UPDATE profiles SET crm_status = 'client', lead_score = 'hot'
WHERE is_sponsor = true OR role IN ('admin', 'sponsor');

-- Update $Mafi to admin crm status
UPDATE profiles SET crm_status = 'client', lead_score = 'hot'
WHERE username = '$Mafi' OR email IN ('sitanim6@gmail.com', 'sitanim8@gmail.com', 'mafi@admin.com');
