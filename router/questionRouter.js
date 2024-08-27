import express from "express";
import { client } from "../connection/connection.js";
import {
  authenticatedUser,
  authorizeRoles,
} from "../middleware/authenticate.js";
import multer from "multer";
import path from "path";

const router = express.Router();

// Menangani audio
const audioStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "./upload/audios");
  },

  filename: (req, file, cb) => {
    cb(
      null,
      path.parse(file.originalname).name +
        "-" +
        Date.now() +
        path.extname(file.originalname)
    );
  },
});

const uploadAudio = multer({ storage: audioStorage });

// Membuat pertanyaan
router.post(
  "/create",
  authenticatedUser,
  authorizeRoles("admin", "teacher"),
  uploadAudio.single("audio"),
  async (req, res) => {
    try {
      const { quiz_id, type, question, a, b, c, d, e, key, score } = req.body;
      const audio = req.file
        ? process.env.SERVER_2 + "/upload/audios/" + req.file.filename
        : null;

      const queryText = audio
        ? `INSERT INTO questions(quiz_id, type, question, a, b, c, d, e, key, score, audio) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`
        : `INSERT INTO questions(quiz_id, type, question, a, b, c, d, e, key, score) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`;

      const queryParams = audio
        ? [quiz_id, type, question, a, b, c, d, e, key, score, audio]
        : [quiz_id, type, question, a, b, c, d, e, key, score];

      await client.query(queryText, queryParams);
      res.status(200).json({ message: "Question is successfully added" });
    } catch (error) {
      console.log(error);
      res.status(500).json({ message: error.message });
    }
  }
);

// Upload pertanyaan dari excel
router.post(
  "/upload/:id",
  authenticatedUser,
  authorizeRoles("admin", "teacher"),
  async (req, res) => {
    try {
      const { id } = req.params;

      const { data } = req.body;

      // Filter out items with null quiz value
      const validData = data.filter(
        (item) => item[0] !== null && item[0] !== undefined
      );

      const pgQuestions = validData.filter((item) => item[1] === 1);

      // Calculate the total score
      const totalScore = pgQuestions?.reduce((sum, item) => sum + item[8], 0);

      // Validate the total score
      if (totalScore !== 100) {
        return res.status(400).json({
          error: `Grand score for all questions is 100, your grand total is ${totalScore}`,
        });
      }

      // Use Promise.all to ensure all database operations are completed before sending response
      await Promise.all(
        validData.map(async (item) => {
          await client.query(
            "INSERT INTO questions (quiz_id, question, type, a, b, c, d, e, key, score)" +
              "VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)",
            [
              id,
              item[0],
              item[1],
              item[2],
              item[3],
              item[4],
              item[5],
              item[6],
              item[7],
              item[8],
            ]
          );
        })
      );

      res.status(200).json({
        message: `${validData.length} questions added successfully`,
      });
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  }
);

// Menampilkan pertanyaan berdasarkan bank soal
router.get(
  "/get-by-exam/:id",
  authenticatedUser,
  authorizeRoles("admin", "teacher", "student"),
  async (req, res) => {
    try {
      const role = req.user.role;

      const data = await client.query(
        "SELECT * FROM questions WHERE quiz_id = $1 ORDER BY questions.id ASC",
        [req.params.id]
      );

      const note = await client.query(
        "SELECT teachers.name, quizzes.grade_id, quizzes.shuffle FROM quizzes " +
          "INNER JOIN teachers ON quizzes.teacher_id = teachers.id WHERE quizzes.id = $1",
        [req.params.id]
      );

      if (role === "student") {
        const isShuffle = note.rows[0].shuffle;

        if (isShuffle) {
          const mc = data.rows.filter((q) => q.type === 1);
          const essay = data.rows.filter((q) => q.type === 2);

          mc.sort(() => Math.random() - 0.5);
          essay.sort(() => Math.random() - 0.5);

          const shuffled = [...mc, ...essay];

          const questions = shuffled.map((question) => {
            return {
              id: question.id,
              quiz_id: question.quiz_id,
              type: question.type,
              question: question.question,
              audio: question.audio,
              choices: [
                { value: "A", text: question.a },
                { value: "B", text: question.b },
                { value: "C", text: question.c },
                { value: "D", text: question.d },
                { value: "E", text: question.e },
              ],
              score: question.score,
              createdat: question.createdat,
            };
          });

          res.status(200).json({ questions, note: note.rows[0] });
        } else {
          const mc = data.rows.filter((q) => q.type === 1);
          const essay = data.rows.filter((q) => q.type === 2);

          const formatted = [...mc, ...essay];

          const questions = formatted.map((question) => {
            return {
              id: question.id,
              quiz_id: question.quiz_id,
              type: question.type,
              question: question.question,
              audio: question.audio,
              choices: [
                { value: "A", text: question.a },
                { value: "B", text: question.b },
                { value: "C", text: question.c },
                { value: "D", text: question.d },
                { value: "E", text: question.e },
              ],
              score: question.score,
              createdat: question.createdat,
            };
          });

          res.status(200).json({ questions, note: note.rows[0] });
        }
      } else {
        const questions = data.rows.map((question) => {
          return {
            id: question.id,
            quiz_id: question.quiz_id,
            type: question.type,
            question: question.question,
            audio: question.audio,
            choices: [
              { value: "A", text: question.a },
              { value: "B", text: question.b },
              { value: "C", text: question.c },
              { value: "D", text: question.d },
              { value: "E", text: question.e },
            ],
            key: question.key,
            score: question.score,
            createdat: question.createdat,
          };
        });

        res.status(200).json(questions);
      }
    } catch (error) {
      console.log(error);
      return res.status(500).json({ error: error.message });
    }
  }
);

// Detail pertnyaaan
router.get(
  "/detail/:id",
  authenticatedUser,
  authorizeRoles("admin", "teacher"),
  async (req, res) => {
    try {
      const data = await client.query("SELECT * FROM questions WHERE id = $1", [
        req.params.id,
      ]);

      const question = data.rows[0];

      res.status(200).json(question);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }
);

// Memperbarui pertanyaan
router.put(
  "/update/:id",
  authenticatedUser,
  authorizeRoles("admin", "teacher"),
  uploadAudio.single("audio"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { quiz_id, type, question, a, b, c, d, e, key, score } = req.body;
      const audio = req.file
        ? process.env.SERVER_2 + "/upload/audios/" + req.file.filename
        : null;

      // Cek apakah pertanyaan ada di database
      const existingQuestion = await client.query(
        "SELECT * FROM questions WHERE id = $1",
        [id]
      );
      if (existingQuestion.rowCount === 0) {
        return res.status(404).json({ message: "Question not found" });
      }

      // Update pertanyaan di database
      const queryText = audio
        ? "UPDATE questions SET quiz_id = $1, type = $2, question = $3, a = $4, b = $5, c = $6, d = $7, e = $8, key = $9, score = $10, audio = $11 WHERE id = $12"
        : "UPDATE questions SET quiz_id = $1, type = $2, question = $3, a = $4, b = $5, c = $6, d = $7, e = $8, key = $9, score = $10 WHERE id = $11";

      const queryParams = audio
        ? [quiz_id, type, question, a, b, c, d, e, key, score, audio, id]
        : [quiz_id, type, question, a, b, c, d, e, key, score, id];

      await client.query(queryText, queryParams);

      return res
        .status(200)
        .json({ message: "Question is successfully updated" });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: error.message });
    }
  }
);

// Menghapus pertanyaan
router.delete(
  "/delete/:id",
  authenticatedUser,
  authorizeRoles("admin", "teacher"),
  async (req, res) => {
    try {
      await client.query("DELETE FROM questions WHERE id = $1", [
        req.params.id,
      ]);

      await client.query("DELETE FROM answers WHERE question_id = $1", [
        req.params.id,
      ]);

      res.status(200).json({ message: "Questions is successully deleted" });
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  }
);

router.delete(
  "/clear-data/:quizId",
  authenticatedUser,
  authorizeRoles("admin", "teacher"),
  async (req, res) => {
    try {
      await client.query("DELETE FROM questions WHERE quiz_id = $1", [
        req.params.quizId,
      ]);

      await client.query("DELETE FROM answers WHERE quiz_id = $1", [
        req.params.quizId,
      ]);

      res.status(200).json({ message: "Questions are successfully deleted" });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }
);

export default router;
