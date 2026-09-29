import express from "express";
import cors from "cors";
import indexController from "./controllers/index.controller.js";

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api", indexController);

app.get("/", (req, res) => {
  res.status(200).json({
    message: "Golden Loom Myanmar API is running",
  });
});

export default app;
