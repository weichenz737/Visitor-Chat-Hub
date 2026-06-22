import pg from "pg";
import bcrypt from "bcryptjs";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const USERNAME = process.env.SEED_USERNAME ?? "admin123";
const PASSWORD = process.env.SEED_PASSWORD ?? "123456";
const DISPLAY_NAME = process.env.SEED_DISPLAY_NAME ?? "管理員";

const pool = new pg.Pool({ connectionString: DATABASE_URL });

try {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const existing = await pool.query(
    "SELECT id FROM agents WHERE username = $1",
    [USERNAME],
  );

  if (existing.rows.length > 0) {
    await pool.query(
      `UPDATE agents
       SET password_hash = $1, role = 'super_admin', display_name = $2,
           introduction = '系統管理員帳號', is_active = true
       WHERE username = $3`,
      [passwordHash, DISPLAY_NAME, USERNAME],
    );
    console.log(`Updated super_admin: ${USERNAME}`);
  } else {
    await pool.query(
      `INSERT INTO agents (username, password_hash, role, display_name, introduction, is_active)
       VALUES ($1, $2, 'super_admin', $3, '系統管理員帳號', true)`,
      [USERNAME, passwordHash, DISPLAY_NAME],
    );
    console.log(`Created super_admin: ${USERNAME}`);
  }
} finally {
  await pool.end();
}
