ALTER TABLE profiles ADD COLUMN IF NOT EXISTS sponsor_activated BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS sponsor_insights_paid BOOLEAN DEFAULT false;
