import express from "express";
import { client } from "../connection/connection.js";
import bcrypt from "bcrypt";
import {
  authenticatedUser,
  authorizeRoles,
} from "../middleware/authenticate.js";

const router = express.Router();

// Mendaftartkan admin
// super admin
router.post(
  "/create",
  authenticatedUser,
  authorizeRoles("super-admin"),
  async (req, res) => {
    try {
      const { name, email, password, homebase_id } = req.body;

      bcrypt.hash(password, 10, async (err, hash) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        } else {
          const role = "admin";
          const data = await client.query(
            "INSERT INTO admin (name, email, password, role, homebase_id) VALUES($1, $2, $3, $4, $5) RETURNING *",
            [name, email, hash, role, homebase_id]
          );
          const admin = data.rows[0];

          if (admin) {
            return res
              .status(200)
              .json({ message: "admin successfully added", admin });
          } else {
            return res.status(500).json({ message: "admin failed to add" });
          }
        }
      });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }
);

router.get(
  "/profile",
  authenticatedUser,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      const user = req.user;

      if (user && user.role === "admin") {
        const data = await client.query(
          "SELECT admin.name, admin.role, homebase.name FROM admin " +
            "INNER JOIN homebase ON homebase.id = admin.homebase_id " +
            "WHERE admin.id = $1",
          [user.id]
        );
        const adminData = data.rows[0];

        res.status(200).json(adminData);
      } else {
        return null;
      }
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }
);

export default router;
