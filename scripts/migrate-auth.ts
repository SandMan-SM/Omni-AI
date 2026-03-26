import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  connectionString: 'postgresql://postgres:N3ukKz4A2k%2CC%23TV@db.odvxtychuxxsudfpcqqs.supabase.co:5432/postgres',
});

async function migrate() {
  const client = await pool.connect();
  
  try {
    console.log('Running database migrations...\n');

    // 1. Create newsletter_subscriptions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS newsletter_subscriptions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT NOT NULL UNIQUE,
        subscribed_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✓ Created newsletter_subscriptions table');

    // 2. Enable RLS on newsletter_subscriptions
    await client.query(`ALTER TABLE newsletter_subscriptions ENABLE ROW LEVEL SECURITY;`);
    console.log('✓ Enabled RLS on newsletter_subscriptions');

    // 3. Create public insert policy for newsletter
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'newsletter_subscriptions' AND policyname = 'Allow public insert') THEN
          CREATE POLICY "Allow public insert" 
          ON newsletter_subscriptions FOR INSERT WITH CHECK (true);
        END IF;
      END $$;
    `);
    console.log('✓ Created public insert policy');

    // 4. Create read policy for authenticated users
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'newsletter_subscriptions' AND policyname = 'Allow authenticated read') THEN
          CREATE POLICY "Allow authenticated read" 
          ON newsletter_subscriptions FOR SELECT TO authenticated USING (true);
        END IF;
      END $$;
    `);
    console.log('✓ Created authenticated read policy');

    // 5. Enable RLS on profiles table
    await client.query(`ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;`);
    console.log('✓ Enabled RLS on profiles');

    // 6. Create profile policies
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can view own profile') THEN
          CREATE POLICY "Users can view own profile" 
          ON profiles FOR SELECT USING (auth.uid() = id);
        END IF;
      END $$;
    `);
    console.log('✓ Created own profile view policy');

    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can update own profile') THEN
          CREATE POLICY "Users can update own profile" 
          ON profiles FOR UPDATE USING (auth.uid() = id);
        END IF;
      END $$;
    `);
    console.log('✓ Created own profile update policy');

    // 7. Create insert policy for profiles (service role)
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Service role can insert profiles') THEN
          CREATE POLICY "Service role can insert profiles" 
          ON profiles FOR INSERT TO service_role WITH CHECK (true);
        END IF;
      END $$;
    `);
    console.log('✓ Created service role insert policy');

    // 8. Grant service role full access
    await client.query(`
      GRANT ALL ON newsletter_subscriptions TO service_role;
      GRANT ALL ON profiles TO service_role;
    `);
    console.log('✓ Granted service_role permissions');

    console.log('\n✅ Database setup completed!');
    console.log('\nNote: Auth auto-profile creation needs to be set up via Supabase Dashboard:');
    console.log('1. Go to Database → Functions');
    console.log('2. Create the handle_new_user() function');
    console.log('3. Create trigger on auth.users');

  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(console.error);
