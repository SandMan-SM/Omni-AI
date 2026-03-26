import pg from "pg";

const pool = new pg.Pool({
  host: "db.odvxtychuxxsudfpcqqs.supabase.co",
  port: 5432,
  database: "postgres",
  user: "postgres",
  password: "N3ukKz4A2k%2CC%23TV",
});

async function main() {
  const client = await pool.connect();
  try {
    // Check if $Mafi profile exists
    const existingProfile = await client.query(
      `SELECT id FROM profiles WHERE username = '$Mafi'`
    );
    
    let profileId;
    if (existingProfile.rows.length > 0) {
      profileId = existingProfile.rows[0].id;
      console.log(`$Mafi profile exists with id: ${profileId}`);
      // Update to ensure admin
      await client.query(
        `UPDATE profiles SET is_admin = true, role = 'admin' WHERE id = $1`,
        [profileId]
      );
      console.log("$Mafi profile updated to admin");
    } else {
      // Create new profile
      profileId = crypto.randomUUID();
      await client.query(
        `INSERT INTO profiles (id, username, email, tier, role, is_admin, is_sponsor, created_at, updated_at)
         VALUES ($1, '$Mafi', 'mafi@admin.com', 0, 'admin', true, false, NOW(), NOW())`,
        [profileId]
      );
      console.log(`$Mafi profile created with id: ${profileId}`);
    }

    // Add or update credentials
    await client.query(
      `INSERT INTO user_credentials (username, password_hash, profile_id)
       VALUES ('$Mafi', 'NHAT88!', $1)
       ON CONFLICT (username) DO UPDATE SET password_hash = 'NHAT88!', profile_id = $1`,
      [profileId]
    );
    console.log("$Mafi credentials added/updated: username=$Mafi, password=NHAT88!");

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
