import fs from "fs";
import pg from "pg";
import path from "path";
import { fileURLToPath } from "url";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const sqlPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "migrations/001_p0_permissions_admin.sql");
const sql = fs.readFileSync(sqlPath, "utf8");

const pool = new pg.Pool({ connectionString: DATABASE_URL });
try {
  await pool.query(sql);
  console.log("Applied P0 migration: 001_p0_permissions_admin.sql");
} finally {
  await pool.end();
}
