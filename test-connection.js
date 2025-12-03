import pool from "./db.js";

async function test() {
  try {
    const result = await pool.query("SELECT NOW()");
    console.log("Connected to PostgreSQL:", result.rows);
  } catch (err) {
    console.error("Connection error:", err);
  }
}

test();
