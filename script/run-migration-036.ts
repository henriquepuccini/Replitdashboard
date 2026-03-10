import pg from "pg";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config();

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
});

async function run() {
    console.log("Running migration 036 via direct pg driver...");
    try {
        const sql = fs.readFileSync(path.join(process.cwd(), "migrations", "036_financial_schema_refactoring.sql"), "utf-8");
        await pool.query(sql);
        console.log("Migration 036 applied successfully.");
    } catch (err) {
        console.error("Failed to apply migration:");
        console.error(err);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

run();
