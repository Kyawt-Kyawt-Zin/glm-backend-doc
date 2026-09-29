import mysql from "mysql2/promise";
import config from "../config/config.js";

const pool = mysql.createPool({
  host: config.database.host,
  port: config.database.port,
  user: config.database.user,
  password: config.database.password,
  database: config.database.name,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

const verifyConnection = async () => {
  let connection;

  try {
    connection = await pool.getConnection();
    await connection.ping();

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

verifyConnection();

export default pool;
