import express from "express";
import { client } from "../connection/connection.js";
import {
  authenticatedUser,
  authorizeRoles,
} from "../middleware/authenticate.js";

const router = express.Router();

// Membuat log siswa
router.post(
  "/create",
  authenticatedUser,
  authorizeRoles("student"),
  async (req, res) => {
    try {
      const { nis, quizId } = req.body;
      const date = new Date().toISOString();
      let ipAddress = req.socket.remoteAddress;
      const browser = req.useragent.browser + " " + req.useragent.version;

      // Jika alamat IP adalah IPv6, potong bagian IPv6 dan simpan hanya IPv4
      if (ipAddress.includes("::ffff:")) {
        ipAddress = ipAddress.split("::ffff:")[1];
      }

      // Periksa apakah ada nis dan bank_id yang sama dalam log
      const existingLog = await client.query(
        "SELECT * FROM log WHERE nis = $1 AND quiz_id = $2",
        [nis, quizId]
      );

      if (existingLog.rowCount > 0) {
        // Jika ada nis yang sama, hapus entri log yang terkait
        await client.query("DELETE FROM log WHERE nis = $1 AND quiz_id = $2", [
          nis,
          quizId,
        ]);
      }

      // Simpan data log baru
      await client.query(
        "INSERT INTO log (log_in, ip, browser, nis, quiz_id) VALUES ($1, $2, $3, $4, $5) RETURNING *",
        [date, ipAddress, browser, nis, quizId]
      );

      res.status(200).json({ message: "Joining Exam" });
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  }
);

// Menampilkan log siswa berdasarkan bank soal
router.get(
  "/get/:quizId",
  authenticatedUser,
  authorizeRoles("admin", "teacher"),
  async (req, res) => {
    try {
      const data = await client.query("SELECT * FROM log WHERE quiz_id = $1", [
        req.params.quizId,
      ]);

      res.status(200).json(data.rows);
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  }
);

// Menampilkan log berdasarkan nis
router.get(
  "/detail/:nis",
  authenticatedUser,
  authorizeRoles("student"),
  async (req, res) => {
    try {
      const { nis } = req.params;

      const data = await client.query("SELECT * FROM log WHERE nis = $1", [
        nis,
      ]);

      res.status(200).json(data.rows[0]);
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  }
);

// Selesaikan ujian
router.put(
  "/finished/:quizId",
  authenticatedUser,
  authorizeRoles("student"),
  async (req, res) => {
    try {
      const quizId = req.params.quizId;

      const isActive = false;
      const isDone = true;

      const questions = await client.query(
        "SELECT * FROM questions WHERE quiz_id = $1",
        [quizId]
      );

      const myAnswersResult = await client.query(
        `SELECT DISTINCT ON (quiz_id, question_id, nis) *
         FROM answers 
         WHERE quiz_id = $1 AND nis = $2
         ORDER BY quiz_id, question_id, nis, createdAt DESC`,
        [quizId, req.user.nis]
      );

      const left = questions.rowCount - myAnswersResult.rowCount;

      if (left === 0) {
        await client.query(
          `UPDATE log SET "isActive" = $1, "isDone" = $2 WHERE quiz_id = $3 AND nis = $4 `,
          [isActive, isDone, quizId, req.user.nis]
        );

        res.status(200).json({ message: "Your answers successfully saved" });
      } else {
        return res
          .status(500)
          .json({ message: `You didn't answer ${left} questions` });
      }
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  }
);

// Reset status
router.put(
  "/change-status-log",
  authenticatedUser,
  authorizeRoles("admin", "teacher"),
  async (req, res) => {
    try {
      const { nis, quizId, logId } = req.body;

      const isActive = false;

      const result = await client.query(
        `UPDATE log SET "isActive" = $1 WHERE id = $2 AND nis = $3 AND quiz_id = $4`,
        [isActive, logId, nis, quizId]
      );

      if (result.rowCount === 0) {
        return res
          .status(404)
          .json({ message: "No matching record found to update" });
      }

      res.status(200).json({ message: "Log successfully reseted" });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: error.message });
    }
  }
);

// Mengulang ujian siswa
router.delete(
  "/clear-log-answers",
  authenticatedUser,
  authorizeRoles("admin", "teacher"),
  async (req, res) => {
    try {
      const { nis, quizId, logid } = req.body;

      await client.query(
        "DELETE FROM log WHERE id = $1 AND nis = $2 AND quiz_id = $3",
        [logid, nis, quizId]
      );

      await client.query(
        "DELETE FROM jawaban WHERE nis = $1 AND quiz_id = $2",
        [nis, quizId]
      );

      res.status(200).json({ message: "Log and answers cleared" });
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  }
);

// Pelanggaran
router.put("/penalty/:nis", async (req, res) => {
  try {
    const penalty = 2;

    const data = await client.query(
      "UPDATE log SET pelanggaran = $1 WHERE nis = $2",
      [penalty, req.params.nis]
    );

    if (data.rowCount > 0) {
      res.status(200).json({ message: "kamu melanggar aturan" });
    } else {
      res.status(404).json({ message: "Data tidak ditemukan" });
    }
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Membatalkan pelanggaran
router.put("/unlock/:nis", async (req, res) => {
  try {
    const penalty = 1;

    const data = await client.query(
      "UPDATE log SET pelanggaran = $1 WHERE nis = $2",
      [penalty, req.params.nis]
    );

    if (data.rowCount > 0) {
      res.status(200).json({ message: "Berhasil dibuka" });
    } else {
      res.status(404).json({ message: "Data tidak ditemukan" });
    }
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Menghapus pelanggaran
router.delete(
  "/remove/:nis/:exam",
  authenticatedUser,
  authorizeRoles("admin", "guru"),
  async (req, res) => {
    try {
      const data = await client.query(
        "DELETE FROM log WHERE nis = $1 AND bank_id = $2",
        [req.params.nis, req.params.exam]
      );

      const result = await client.query(
        "DELETE FROM jawaban WHERE nis = $1 AND bank_id = $2",
        [req.params.nis, req.params.exam]
      );

      res.status(200).json({ message: "Berhasil dihapus" });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ error: error.message });
    }
  }
);

export default router;
