import pkg from "pg";

const { Client } = pkg;

const config = {
  user: process.env.USER,
  password: process.env.PASS,
  host: process.env.LOCATION,
  database: process.env.DATABASE,
  port: 5432,
};

const client = new Client(config);

const connectToDatabase = async () => {
  try {
    await client.connect();
    const result = await client.query("SELECT NOW() as current_time");

    console.log(
      `Connected to PostgreSQL database: ${result.rows[0].current_time}`
    );
  } catch (err) {
    console.error("Error connecting to PostgreSQL:", err);
  }
};

export { client, connectToDatabase };
