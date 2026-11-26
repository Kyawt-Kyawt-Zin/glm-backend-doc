import mysql from "mysql2/promise";
import config from "../config/config.js";
import fs from "node:fs";
import { log, table } from "node:console";

const pool = mysql.createPool({
  host: config.database.host,
  port: config.database.port,
  user: config.database.user,
  password: config.database.password,
  database: config.database.name,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ssl: {
    ca: fs.readFileSync(new URL("../../certs/ca.pem", import.meta.url)),
    rejectUnauthorized: true,
  },
});

const verifyConnection = async () => {
  let connection;

  try {
    connection = await pool.getConnection();
    await connection.ping();
    const [rows] = await connection.query(
      "SELECT DATABASE() AS db, @@hostname AS server",
    );

    console.log("Connect database:", rows[0].db);
    console.log("Database server:", rows[0].server);

    console.log("MySQL database connected successfully.");
  } catch (error) {
    console.error("Database connection error:", error.message);
    process.exit(1);
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

// Vercel can freeze background work after a response; verify on local startup only.
if (!process.env.VERCEL) {
  verifyConnection();
}

export default pool;
