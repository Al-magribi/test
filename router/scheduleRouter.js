import express from "express";
import { client } from "../connection/connection.js";
import {
  authenticatedUser,
  authorizeRoles,
} from "../middleware/authenticate.js";

const router = express.Router();

// Membuat token
function generateCode() {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const numbers = "0123456789";
  let code = "";

  // Menambahkan 2 huruf pertama
  for (let i = 0; i < 2; i++) {
    code += letters.charAt(Math.floor(Math.random() * letters.length));
  }

  // Menambahkan 2 angka
  for (let i = 0; i < 2; i++) {
    code += numbers.charAt(Math.floor(Math.random() * numbers.length));
  }

  // Menambahkan 2 huruf terakhir
  for (let i = 0; i < 2; i++) {
    code += letters.charAt(Math.floor(Math.random() * letters.length));
  }

  return code;
}

// Membuat jadwal ujian
router.post(
  "/create",
  authenticatedUser,
  authorizeRoles("admin", "teacher"),
  async (req, res) => {
    try {
      const { name, desc, teacherId, quizId, start, end, gradeId } = req.body;

      const normalized_name = name.toLowerCase().replace(/\s+/g, "");

      const checking = await client.query(
        "SELECT * FROM schedules WHERE REPLACE(LOWER(name), ' ', '') = $1",
        [normalized_name]
      );

      const code = generateCode();

      if (checking.rowCount > 0) {
        return res.status(500).json({ message: "Schedule has been used" });
      } else {
        await client.query(
          `INSERT INTO schedules(name, description, token, teacher_id, quiz_id, start, "end", grade_id) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
          [name, desc, code, teacherId, quizId, start, end, gradeId]
        );

        res.status(200).json({ message: "Schedule is successfully added" });
      }
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: error.message });
    }
  }
);

// Menampilkan seluruh jadwal ujian
router.get(
  "/get",
  authenticatedUser,
  authorizeRoles("admin", "teacher"),
  async (req, res) => {
    try {
      const admin = req.user.role === "admin";
      if (admin) {
        const data = await client.query(
          "SELECT schedules.id, schedules.name, schedules.quiz_id, schedules.description, schedules.token, grades.grade, " +
            "teachers.name AS teacher, quizzes.quiz_name AS quiz, " +
            "schedules.status, schedules.start, schedules.end, schedules.grade_id " +
            "FROM schedules " +
            "INNER JOIN teachers ON schedules.teacher_id = teachers.id " +
            "INNER JOIN quizzes ON schedules.quiz_id = quizzes.id " +
            "INNER JOIN grades ON schedules.grade_id = grades.id " +
            "ORDER BY teachers.name ASC"
        );

        const rooms = data.rows;

        return res.status(200).json(rooms);
      } else {
        const data = await client.query(
          "SELECT schedules.id, schedules.name, schedules.quiz_id, schedules.description, schedules.token, grades.grade, " +
            "teachers.name AS teacher, quizzes.quiz_name AS quiz, " +
            "schedules.status, schedules.start, schedules.end, schedules.grade_id " +
            "FROM schedules " +
            "INNER JOIN teachers ON schedules.teacher_id = teachers.id " +
            "INNER JOIN quizzes ON schedules.quiz_id = quizzes.id " +
            "INNER JOIN grades ON schedules.grade_id = grades.id " +
            "WHERE schedules.teacher_id = $1 ORDER BY schedules.name ASC",
          [req.user.id]
        );

        const rooms = data.rows;
        return res.status(200).json(rooms);
      }
    } catch (error) {
      console.log(error);

      return res.status(500).json({ error: error.message });
    }
  }
);

// jadwal berdasarkan tingkat
router.get(
  "/get-by-grade/:grade",
  authenticatedUser,
  authorizeRoles("student", "admin"),
  async (req, res) => {
    try {
      const grade = await client.query(
        `SELECT grade_id FROM students_class
        WHERE nis = $1`,
        [req.user.nis]
      );

      const data = await client.query(
        "SELECT schedules.id, schedules.name, schedules.quiz_id, schedules.status, schedules.description, schedules.token, grades.grade, " +
          "teachers.name AS teacher, quizzes.quiz_name AS quiz, " +
          "schedules.status, schedules.start, schedules.end " +
          "FROM schedules " +
          "INNER JOIN teachers ON schedules.teacher_id = teachers.id " +
          "INNER JOIN quizzes ON schedules.quiz_id = quizzes.id " +
          "INNER JOIN grades ON schedules.grade_id = grades.id " +
          "WHERE schedules.grade_id = $1 ORDER BY schedules.name ASC",
        [req.params.grade]
      );

      const schedules = data.rows;

      res.status(200).json(schedules);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }
);

// Detail Schedule
router.get(
  "/detail/:id",
  authenticatedUser,
  authorizeRoles("admin", "teacher"),
  async (req, res) => {
    try {
      const data = await client.query(
        "SELECT schedules.id, schedules.name AS schedule, schedules.quiz_id, schedules.description, " +
          "schedules.token, schedules.grade_id, schedules.grade_id, " +
          "schedules.teacher_id, schedules.status, schedules.start, schedules.end FROM schedules " +
          "WHERE schedules.id = $1",
        [req.params.id]
      );

      const room = data.rows[0];

      res.status(200).json(room);
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  }
);

// Memperbarui jadwal ujian ujian
router.put(
  "/update/:id",
  authenticatedUser,
  authorizeRoles("admin", "teacher"),
  async (req, res) => {
    try {
      const { name, desc, teacherId, quizId, start, end, gradeId } = req.body;

      await client.query(
        `UPDATE schedules SET name = $1, description = $2, teacher_id = $3, 
          quiz_id = $4, start = $5, "end" = $6, grade_id = $7 
          WHERE id = $8 RETURNING *`,
        [name, desc, teacherId, quizId, start, end, gradeId, req.params.id]
      );

      res.status(200).json({ message: "Schedule is updated successfully" });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: error.message });
    }
  }
);

// Update status
router.put(
  "/update-status/:id",
  authenticatedUser,
  authorizeRoles("admin", "teacher"),
  async (req, res) => {
    try {
      const { id } = req.params;

      const room = await client.query("SELECT * FROM schedules WHERE id = $1", [
        id,
      ]);

      const data = room.rows[0];

      const active = true;
      const inactive = false;

      if (data.status) {
        await client.query("UPDATE schedules SET status = $1 WHERE id = $2", [
          inactive,
          id,
        ]);

        res.status(200).json({ message: "Status sets to inactive" });
      } else {
        await client.query("UPDATE schedules SET status = $1 WHERE id = $2", [
          active,
          id,
        ]);

        res.status(200).json({ message: "Status sets to active" });
      }
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: error.message });
    }
  }
);

// Menghapus Jadwal ujian
router.delete(
  "/delete/:id",
  authenticatedUser,
  authorizeRoles("admin", "teacher"),
  async (req, res) => {
    try {
      await client.query("DELETE FROM schedules where id = $1", [
        req.params.id,
      ]);

      res.status(200).json({ message: "Schedule have been deleted" });
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  }
);

// Menghapus seluruh ruang
router.delete(
  "/clear-data",
  authenticatedUser,
  authorizeRoles("admin", "guru"),
  async (req, res) => {
    try {
      const role = req.user.role;
      const ids = req.body.ids;

      if (role === "admin") {
        await client.query("DELETE FROM ruang");

        await client.query(
          "DELETE FROM jawaban WHERE bank_id = ANY($1::int[])",
          [ids]
        );

        return res
          .status(200)
          .json({ message: "Seluruh jadwal berhasil dihapus" });
      } else {
        await client.query("DELETE FROM ruang WHERE guru = $1", [req.user.id]);

        await client.query(
          "DELETE FROM jawaban WHERE bank_id = ANY($1::int[])",
          [ids]
        );

        return res
          .status(200)
          .json({ message: "Seluruh jadwal berhasil dihapus" });
      }
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: error.message });
    }
  }
);

export default router;
