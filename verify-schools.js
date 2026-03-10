import pg from 'pg';

const { Pool } = pg;
const dbUrl = "postgresql://postgres.vrashfbyewynwyvnnrwg:cKAMgYWtdSEs7MqT@aws-0-us-west-2.pooler.supabase.com:5432/postgres";

const pool = new Pool({ connectionString: dbUrl });

async function verify() {
    try {
        const res = await pool.query('SELECT code, name FROM schools ORDER BY code;');
        console.log("Current Schools in DB:");
        console.table(res.rows);
    } catch (err) {
        console.error("Verification failed:", err);
    } finally {
        process.exit(0);
    }
}

verify();
