import { pool } from "./server/db";
import fs from "fs";

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
