import express from "express";
import { client } from "../connection/connection.js";
import {
  authenticatedUser,
  authorizeRoles,
} from "../middleware/authenticate.js";

const router = express.Router();

// Menambahkan bank soal
router.post(
  "/create",
  authenticatedUser,
  authorizeRoles("admin", "teacher"),
  async (req, res) => {
    try {
      const { teacherId, gradeId, quizName, shuffle, mc, essay } = req.body;

      // Normalisasi nama bank soal dengan menghilangkan spasi dan mengubah menjadi huruf kecil
      const normalized_name = quizName.toLowerCase().replace(/\s+/g, "");

      // Pencarian bank soal dengan nama yang sudah dinormalisasi
      const checking = await client.query(
        "SELECT * FROM quizzes WHERE REPLACE(LOWER(quiz_name), ' ', '') = $1",
        [normalized_name]
      );

      if (checking.rowCount > 0) {
        return res.status(500).json({ message: "Quiz Name has been used" });
      } else {
        const data = await client.query(
          "INSERT INTO quizzes (teacher_id, grade_id, quiz_name, shuffle, mc_weight, essay_weight) " +
            "VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
          [teacherId, gradeId, quizName, shuffle, mc, essay]
        );

        const exam = data.rows[0];

        res.status(200).json({ message: "Quiz is successfully added", exam });
      }
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  }
);

// Memperbarui bank soal
router.put(
  `/update/:id`,
  authenticatedUser,
  authorizeRoles("admin", "teacher"),
  async (req, res) => {
    try {
      const { teacherId, gradeId, quizName, shuffle, mc, essay } = req.body;

      const process = await client.query(
        "UPDATE quizzes SET teacher_id = $1, grade_id = $2, " +
          "quiz_name = $3, shuffle = $4, " +
          "mc_weight = $5, essay_weight = $6 " +
          "WHERE id = $7 RETURNING *",
        [teacherId, gradeId, quizName, shuffle, mc, essay, req.params.id]
      );

      await client.query(
        "UPDATE schedules SET teacher_id = $1, grade_id = $2 WHERE quiz_id = $3",
        [teacherId, gradeId, req.params.id]
      );

      if (process.rowCount > 0) {
        res.status(200).json({ message: "Quiz is successfully updated" });
      } else {
        res.status(404).json({ message: "Quiz not found" });
      }
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  }
);

// Menampilkan bank soal
router.get(
  "/get",
  authenticatedUser,
  authorizeRoles("admin", "teacher"),
  async (req, res) => {
    try {
      let query =
        "SELECT quizzes.id, quizzes.quiz_name, quizzes.teacher_id, teachers.name AS teacher, " +
        "grades.grade, " +
        "(SELECT COUNT(*) FROM questions WHERE questions.quiz_id = quizzes.id AND questions.type = 1) AS mc, " +
        "(SELECT COUNT(*) FROM questions WHERE questions.quiz_id = quizzes.id AND questions.type = 2) AS essay " +
        "FROM quizzes " +
        "INNER JOIN teachers ON quizzes.teacher_id = teachers.id " +
        "INNER JOIN grades ON quizzes.grade_id = grades.id ";

      let queryParams = [];

      if (req.user.role !== "admin") {
        query += "WHERE quizzes.teacher_id = $1 ";
        queryParams.push(req.user.id);
      }

      query += "ORDER BY CAST(quizzes.grade_id AS INTEGER) ASC";

      const data = await client.query(query, queryParams);

      res.status(200).json(data.rows);
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: error.message });
    }
  }
);

// Menampilkan bank soal berdasarkan guru
router.get(
  "/get-by-teacher/:teacherId",
  authenticatedUser,
  authorizeRoles("teachers"),
  async (req, res) => {
    try {
      const { teacherId } = req.params;

      const data = await client.query(
        "SELECT quizzes.id, quizzes.quiz_name, quizzes.teacher_id, teachers.name, " +
          "quizzes.grade_id, " +
          "(SELECT COUNT(*) FROM questions WHERE questions.quiz_id = quizzes.id AND questions.type = 1) AS type1, " +
          "(SELECT COUNT(*) FROM questions WHERE questions.quiz_id = quizzes.id AND questions.type = 2) AS type2 " +
          "FROM quizzes " +
          "INNER JOIN teachers ON quizzes.teacher_id = teachers.id " +
          "WHERE quizzes.teacher_id = $1",
        [teacherId]
      );

      res.status(200).json(data.rows);
    } catch (error) {
      console.log(error);
      res.status(500).json({ error: error.message });
    }
  }
);

// Menampilkan ujian berdasarkan tingkat
router.get(
  "/get-by-grade/:grade",
  authenticatedUser,
  authorizeRoles("admin", "student"),
  async (req, res) => {
    try {
      const data = await client.query(
        "SELECT quizzes.id, quizzes.quiz_name, teachers.name, schedules.time_start, schedules.time_end, " +
          "grades.grade, schedules.token FROM quizzes  " +
          "INNER JOIN teachers ON quizzes.teacher_id = teachers.id " +
          "INNER JOIN grades ON quizzes.grade_id = grades.id " +
          "INNER JOIN schedules ON schedules.quiz_id = quizzes.id " +
          "WHERE quizzes.grade_id = $1  ORDER BY quizzes.quiz_name ASC",
        [req.params.grade]
      );

      const exams = data.rows;

      res.status(200).json(exams);
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  }
);

// Menampilkan bank soal berikut pertanyaanya
router.get(
  "/:id",
  authenticatedUser,
  authorizeRoles("admin", "teachers"),
  async (req, res) => {
    try {
      const data = await client.query(
        "SELECT quizzes.quiz_name, bank.pg, bank.uraian, " +
          "pertanyaan.id, pertanyaan.bank_id, pertanyaan.jenis, pertanyaan.soal, " +
          "pertanyaan.a, pertanyaan.b, pertanyaan.c, pertanyaan.d, pertanyaan.e, pertanyaan.kunci, pertanyaan.poin " +
          "FROM bank LEFT JOIN pertanyaan ON bank.id = pertanyaan.bank_id WHERE bank.id = $1",
        [req.params.id]
      );

      const exam = {
        exam_name: data.rows[0].nama,
        time: data.rows[0].durasi,
        pg: data.rows[0].pg,
        essay: data.rows[0].uraian,
        questions: data.rows.map((row) => ({
          _id: row.id,
          exam_id: row.bank_id,
          quiz_type: row.jenis,
          quiz: row.soal,
          answer_1: row.a,
          answer_2: row.b,
          answer_3: row.c,
          answer_4: row.d,
          answer_5: row.e,
          key: row.kunci,
          poin: row.poin,
        })),
      };

      res.status(200).json(exam);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }
);

// Menampilkan detail bank soal
router.get(
  "/detail/:id",
  authenticatedUser,
  authorizeRoles("admin", "teacher"),
  async (req, res) => {
    try {
      const data = await client.query("SELECT * FROM quizzes where id = $1", [
        req.params.id,
      ]);

      if (data.rowCount === 0) {
        return res.status(404).json({ message: "Quizzes not found" });
      }

      res.status(200).json(data.rows[0]);
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: error.message });
    }
  }
);

// Menghapus bank soal
router.delete(
  "/delete/:id",
  authenticatedUser,
  authorizeRoles("admin", "teacher"),
  async (req, res) => {
    try {
      const data = await client.query(
        "DELETE FROM quizzes WHERE id = $1 RETURNING *",
        [req.params.id]
      );

      await client.query("DELETE FROM schedules WHERE quiz_id = $1", [
        req.params.id,
      ]);

      await client.query("DELETE FROM answers WHERE quiz_id = $1", [
        req.params.id,
      ]);

      const delQuestion = await client.query(
        "DELETE FROM questions WHERE quiz_id = $1 RETURNING *",
        [req.params.id]
      );

      if (data.rowCount === 0) {
        return res.status(404).json({ message: "Quiz not found" });
      }

      res.status(200).json({
        message: `Quiz and ${delQuestion.rowCount} questions are successfully deleted`,
      });
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  }
);

// Clear data
router.delete(
  "/clear-data",
  authenticatedUser,
  authorizeRoles("admin", "teacher"),
  async (req, res) => {
    const role = req.user.role;
    const id = req.user.id;

    try {
      if (role === "admin") {
        await client.query("DELETE FROM quizzes");

        await client.query("DELETE FROM questions");

        await client.query("DELETE FROM answers");

        await client.query("DELETE FROM schedules");

        await client.query("DELETE FROM log");

        res.status(200).json({ message: "Data has been cleared" });
      } else {
        const quiz = await client.query(
          `SELECT * FROM quizzes WHERE teacher_id = $1`,
          [id]
        );

        await client.query("DELETE FROM quizzes WHERE teacher_id = $1", [id]);

        await client.query("DELETE FROM questions WHERE quiz_id = $1", [
          quiz.rows[0].quiz_id,
        ]);

        await client.query("DELETE FROM answers WHERE quiz_id = $1", [
          quiz.rows[0].quiz_id,
        ]);

        await client.query("DELETE FROM schedules WHERE quiz_id = $1", [
          quiz.rows[0].quiz_id,
        ]);

        await client.query("DELETE FROM log WHERE quiz_id = $1", [
          quiz.rows[0].quiz_id,
        ]);

        res.status(200).json({ message: "Data has been cleared" });
      }
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  }
);

export default router;
