import pg from 'pg';

const { Pool } = pg;

async function setupAuth() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:N3ukKz4A2k%2CC%23TV@db.odvxtychuxxsudfpcqqs.supabase.co:5432/postgres',
  });

  try {
    console.log('Connected to database');

    // Create profiles table if not exists (drop and recreate for clean setup)
    await pool.query(`
      DROP TABLE IF EXISTS profiles CASCADE;
      CREATE TABLE profiles (
        id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
        email TEXT,
        role TEXT DEFAULT 'user',
        is_admin BOOLEAN DEFAULT FALSE,
        is_sponsor BOOLEAN DEFAULT FALSE,
        tier INTEGER DEFAULT 0,
        name TEXT,
        phone TEXT,
        business_owner BOOLEAN DEFAULT FALSE,
        business_name TEXT,
        business_niche TEXT,
        business_details TEXT,
        activated_platforms TEXT[] DEFAULT '{}',
        onboarding_completed BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    console.log('Profiles table created/verified');

    // Enable RLS
    await pool.query(`ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;`);
    console.log('RLS enabled');

    // Create policies for profiles
    await pool.query(`
      DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
      CREATE POLICY "Users can view own profile" ON profiles
        FOR SELECT USING (auth.uid() = id);
    `);

    await pool.query(`
      DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
      CREATE POLICY "Users can update own profile" ON profiles
        FOR UPDATE USING (auth.uid() = id);
    `);

    await pool.query(`
      DROP POLICY IF EXISTS "Service role can do anything" ON profiles;
      CREATE POLICY "Service role can do anything" ON profiles
        FOR ALL USING (auth.jwt()->>'role' = 'service_role');
    `);
    console.log('RLS policies created');

    // Check if users exist in auth.users
    const usersResult = await pool.query(`
      SELECT id, email FROM auth.users WHERE email = 'sitanim8@gmail.com';
    `);
    
    const users = usersResult.rows;
    console.log(`Found ${users.length} users in auth.users`);

    for (const user of users) {
      console.log(`Processing user: ${user.email} (${user.id})`);
      
      // Upsert profile
      if (user.email === 'sitanim8@gmail.com') {
        // Admin with empire tier
        await pool.query(`
          INSERT INTO profiles (id, email, role, is_admin, is_sponsor, tier, name, onboarding_completed)
          VALUES ($1, $2, 'admin', true, true, 3, '$Mafi', true)
          ON CONFLICT (id) DO UPDATE SET
            role = 'admin',
            is_admin = true,
            is_sponsor = true,
            tier = 3,
            updated_at = NOW();
        `, [user.id, user.email]);
        console.log(`  ✓ Set as admin with empire tier (tier 3)`);
      }
    }

    // Verify profiles
    const profilesResult = await pool.query(`
      SELECT email, role, is_admin, is_sponsor, tier FROM profiles
      WHERE email = 'sitanim8@gmail.com';
    `);
    
    console.log('\n--- Profile Verification ---');
    for (const profile of profilesResult.rows) {
      console.log(`${profile.email}:`);
      console.log(`  Role: ${profile.role}`);
      console.log(`  is_admin: ${profile.is_admin}`);
      console.log(`  is_sponsor: ${profile.is_sponsor}`);
      console.log(`  tier: ${profile.tier} (${tierName(profile.tier)})`);
    }

    console.log('\n✅ Auth setup complete!');
  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

function tierName(tier) {
  const tiers = {
    0: 'free (apprentice)',
    1: 'knight (master)',
    2: 'royal',
    3: 'empire'
  };
  return tiers[tier] || 'unknown';
}

setupAuth().catch(console.error);
