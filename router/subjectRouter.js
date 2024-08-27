import express from "express";
import { client } from "../connection/connection.js";
import {
  authenticatedUser,
  authorizeRoles,
} from "../middleware/authenticate.js";

const router = express.Router();

// Menampilkan mapel
router.get(
  "/get",
  authenticatedUser,
  authorizeRoles("admin", "guru"),
  async (req, res) => {
    try {
      const homebase = req.user.homebase_id;

      const data = await client.query(
        "SELECT subjects.id, subjects.name, homebase.name AS homebase, subjects.code FROM subjects " +
          "INNER JOIN homebase ON subjects.homebase_id = homebase.id " +
          "WHERE subjects.homebase_id = $1 " +
          "ORDER BY subjects.name ASC",
        [homebase]
      );

      const subejcts = data.rows;

      res.status(200).json(subejcts);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }
);

// Menambahkan mapel
router.post(
  "/create",
  authenticatedUser,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      const homebase = req.user.homebase_id;

      const checking = await client.query(
        "SELECT * FROM subjects WHERE homebase_id = $1 AND code = $2",
        [homebase, req.body.code]
      );

      if (checking.rowCount > 0) {
        return res.status(400).json({ message: "Code has been used" });
      } else {
        const data = await client.query(
          "INSERT INTO subjects(name, homebase_id, code) VALUES($1, $2, $3) RETURNING *",
          [req.body.subject, homebase, req.body.code]
        );

        const newSubject = data.rows[0];

        res.status(200).json({
          message: "Subject is successfully added",
          newSubject,
        });
      }
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  }
);

// Upload mapel
router.post(
  "/upload",
  authenticatedUser,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      const { data } = req.body;
      const homebase = req.user.homebase_id;

      const subjects = data.filter(
        (item) => item[0] !== null && item[0] !== undefined
      );

      let addedCount = 0;

      await Promise.all(
        subjects.map(async (item) => {
          const [code, subject] = item;
          const checking = await client.query(
            "SELECT * FROM subjects WHERE homebase_id = $1 AND code = $2",
            [homebase, code]
          );

          if (checking.rowCount === 0) {
            await client.query(
              "INSERT INTO subjects (homebase_id, code, name) VALUES ($1, $2, $3)",
              [homebase, code, subject]
            );
            addedCount++;
          }
        })
      );

      res.status(200).json({
        message: `${addedCount} subjects successfully added`,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: error.message });
    }
  }
);

// Detail mapel
router.get(
  "/detail/:id",
  authenticatedUser,
  authorizeRoles("admin", "teacher"),
  async (req, res) => {
    try {
      const subject = await client.query(
        "SELECT * FROM subjects WHERE id = $1",
        [req.params.id]
      );

      if (!subject) {
        return res.status(404).json({ message: "Subject not found" });
      }

      res.status(200).json(subject.rows[0]);
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: error.message });
    }
  }
);

// Memperbarui mapel
router.put(
  "/update/:id",
  authenticatedUser,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      const homebase = req.user.homebase_id;

      const subject = await client.query(
        "SELECT * FROM subjects WHERE id = $1",
        [req.params.id]
      );

      if (!subject) {
        return res.status(404).json({ message: "Subject not found" });
      }

      await client.query(
        "UPDATE mapel SET homebase_id = $1, name = $2, code = $3 WHERE id = $3 RETURNING *",
        [homebase, req.body.subject, req.body.code, req.params.id]
      );

      res.status(200).json({ message: "Subject is successfully updated" });
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  }
);

// Menghapus mapel
router.delete(
  "/delete/:id",
  authenticatedUser,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      await client.query("DELETE FROM subjects WHERE id = $1", [req.params.id]);

      res.status(200).json({ message: "Subject is successfully deleted" });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: error.message });
    }
  }
);

// Menghapus semua mapel
router.delete(
  "/delete-data",
  authenticatedUser,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      const homebase = req.user.homebase_id;

      await client.query("DELETE FROM subjects WHERE homebase_id = $1", [
        homebase,
      ]);

      res.status(200).json({ message: `Subjects are successfully deleted` });
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  }
);

export default router;
