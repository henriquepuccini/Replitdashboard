import pg from 'pg';
import fs from 'fs';

const { Pool } = pg;
const dbUrl = "postgresql://postgres.vrashfbyewynwyvnnrwg:cKAMgYWtdSEs7MqT@aws-0-us-west-2.pooler.supabase.com:5432/postgres";

const pool = new Pool({ connectionString: dbUrl });

async function run() {
    try {
        const sql = fs.readFileSync("./migrations/029_kpi_goals_user_id.sql", "utf-8");
        await pool.query(sql);
        console.log("Migration applied successfully.");
    } catch (err) {
        console.error("Migration failed:", err);
    } finally {
        process.exit(0);
    }
}

run();
