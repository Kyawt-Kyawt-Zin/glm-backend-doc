import express from "express";
import cors from "cors";
import indexController from "./controllers/index.controller.js";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();

app.use(cors());
app.use(express.json());

app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

app.use("/api", indexController);

app.get("/", (req, res) => {
  res.status(200).json({
    message: "Golden Loom Myanmar API is running",
  });
});

export default app;
