import express from "express";
import { client } from "../connection/connection.js";
import {
  authenticatedUser,
  authorizeRoles,
} from "../middleware/authenticate.js";

const router = express.Router();

// Membuat kelas
router.post(
  "/create",
  authenticatedUser,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      const homebase = req.user.homebase_id;
      const checking = await client.query(
        "SELECT * FROM classes WHERE name = $1 AND code = $2",
        [req.body.name, req.body.code]
      );

      if (checking.rowCount > 0)
        return res.status(500).json({ message: "Class name has been used" });

      const data = await client.query(
        "INSERT INTO classes(name, code, homebase_id, grade_id) VALUES($1, $2, $3, $4) RETURNING *",
        [req.body.name, req.body.code, homebase, req.body.gradeId]
      );

      res.status(200).json({ message: "Class is successfully added" });
    } catch (error) {
      console.log(error);
      res.status(500).json({ message: error.message });
    }
  }
);

// Menampilkan kelas
router.get(
  "/get",
  authenticatedUser,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      const homebase = req.user.homebase_id;
      const data = await client.query(
        `SELECT grades.grade, classes.code, classes.grade_id, classes.name, 
                homebase.name AS homebase, classes.id 
         FROM classes 
         INNER JOIN homebase ON homebase.id = classes.homebase_id 
         INNER JOIN grades ON grades.id = classes.grade_id 
         WHERE classes.homebase_id = $1 
         ORDER BY classes.createdat ASC`,
        [homebase]
      );

      const classes = data.rows;

      // Fetch students count for each class based on class_code
      for (let i = 0; i < classes.length; i++) {
        const classData = classes[i];
        const studentsCount = await client.query(
          "SELECT COUNT(*) FROM students_class WHERE class_code = $1",
          [classData.code]
        );

        classes[i].students = parseInt(studentsCount.rows[0].count, 10);
      }

      res.status(200).json(classes);
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  }
);

// detail kelas
router.get(
  "/detail/:id",
  authenticatedUser,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      const kelas = await client.query("SELECT * FROM classes WHERE id = $1", [
        req.params.id,
      ]);

      if (!kelas) {
        return res.status(404).json({ error: "Class not found" });
      }

      res.status(200).json(kelas.rows[0]);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }
);

// Mengedit kelas
router.put(
  "/update/:id",
  authenticatedUser,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      const homebase = req.user.homebase_id;

      const classCheck = await client.query(
        "SELECT * FROM classes WHERE id = $1",
        [req.params.id]
      );

      if (classCheck.rowCount === 0) {
        return res.status(404).json({ error: "Class not found" });
      }

      const { name, gradeId, code } = req.body;

      await client.query(
        "UPDATE classes SET homebase_id = $1, grade_id = $2, code = $3, name = $4 WHERE id = $5 RETURNING *",
        [homebase, gradeId, code, name, req.params.id]
      );

      res.status(200).json({ message: "Class is successfully updated" });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ error: error.message });
    }
  }
);

// Menghapus kelas
router.delete(
  "/delete/:id",
  authenticatedUser,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      const checking = await client.query(
        "SELECT * FROM classes WHERE id = $1",
        [req.params.id]
      );

      if (checking.rowCount === 0) {
        return res.status(404).json({ message: "Class is not found" });
      }

      await client.query("DELETE FROM classes WHERE id = $1", [req.params.id]);

      res.status(200).json({ message: "Class is successfully deleted" });
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  }
);

// Menghapus data kelas
router.delete(
  "/clear-data",
  authenticatedUser,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      await client.query("DELETE FROM classes WHERE homebase_id = $1", [
        req.user.homebase_id,
      ]);

      res.status(200).json({ message: "Classes are successfully deleted" });
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  }
);

export default router;
