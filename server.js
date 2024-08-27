import "dotenv/config";
import app from "./app.js";
import { client, connectToDatabase } from "./connection/connection.js";

app.get("/", (req, res) => {
  res.send("active");
});

app.listen(process.env.PORT, async (req, res) => {
  try {
    await connectToDatabase();

    console.log("Connection on Port: " + process.env.PORT);
  } catch (error) {
    console.log("error: " + error);
  }
});
