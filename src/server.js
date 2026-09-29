import app from "./app.js";
import config from "./config/config.js";
import "./helper/db_helper.js";

app.listen(config.port, () => {
  console.log(`Server is running on http://localhost:${config.port}`);
});
