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
    await client.query(
      `INSERT INTO admin_users (email) VALUES ($1) ON CONFLICT (email) DO NOTHING`,
      ["sitanim8@gmail.com"]
    );
    console.log("Admin user added");

    await client.query(
      `INSERT INTO profiles (email, is_sponsor, tier) VALUES ($1, $2, $3) ON CONFLICT (email) DO UPDATE SET is_sponsor = $2, tier = $3`,
      ["sitanim8@gmail.com", true, 3]
    );
    console.log("Profile added with sponsor tier 3");
  } finally {
    client.release();
    await pool.end();
  }
}

main();
