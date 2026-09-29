import "dotenv/config";

const config = {
  port: Number(process.env.PORT) || 5000,
  database: {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    name: process.env.DB_NAME,
  },
};

export default config;
