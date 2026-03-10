import pg from 'pg';

const { Pool } = pg;
const dbUrl = "postgresql://postgres.vrashfbyewynwyvnnrwg:cKAMgYWtdSEs7MqT@aws-0-us-west-2.pooler.supabase.com:5432/postgres";

const pool = new Pool({ connectionString: dbUrl });

async function verify() {
    try {
        const res = await pool.query('SELECT email, full_name, role FROM users WHERE email LIKE ''%placeholder.local'' ORDER BY email;');
        console.log("Current Placeholder Users in DB:");
        console.table(res.rows);
    } catch (err) {
        console.error("Verification failed:", err);
    } finally {
        process.exit(0);
    }
}

verify();
