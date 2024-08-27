import express from "express";
import { client } from "../connection/connection.js";
import {
  authenticatedUser,
  authorizeRoles,
} from "../middleware/authenticate.js";

const router = express.Router();

// Membuat satuan
// super-admin
router.post(
  "/create",
  authenticatedUser,
  authorizeRoles("super-admin"),
  async (req, res) => {
    try {
      const checking = await client.query(
        "SELECT * FROM homebase WHERE name = $1",
        [req.body.homebase]
      );

      if (checking.rowCount > 0) {
        return res.status(500).json({ message: "homebase is already exsited" });
      } else {
        const data = await client.query(
          "INSERT INTO homebase(name) VALUES($1) RETURNING *",
          [req.body.homebase]
        );

        const homebase = data.rows[0];

        res
          .status(200)
          .json({ message: "Homebase is successfully added", homebase });
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// Menampilkan satuan
router.get(
  "/get",
  authenticatedUser,
  authorizeRoles("admin", "super-admin"),
  async (req, res) => {
    try {
      const data = await client.query("SELECT * FROM homebase ORDER BY id ASC");

      const homebases = data.rows;

      res.status(200).json(homebases);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }
);

// Menghapus satuan
// super-admin
router.delete(
  "/delete/:id",
  authenticatedUser,
  authorizeRoles("super-admin"),
  async (req, res) => {
    try {
      await client.query("DELETE FROM homebase WHERE id = $1", [req.params.id]);

      res.status(200).json({ message: "Homebase is successfully deleted" });
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  }
);

export default router;
