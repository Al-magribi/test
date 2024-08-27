import express from "express";
import { client } from "../connection/connection.js";
import {
  authenticatedUser,
  authorizeRoles,
} from "../middleware/authenticate.js";

const router = express.Router();

function countAnswerByStudentId(questions, answers, quiz) {
  let studentScores = [];

  // Mendapatkan bobot untuk setiap jenis soal
  const maxScore = 100;
  const mcqWeight = (quiz.mc_weight / 100) * maxScore; // Bobot untuk pilihan ganda
  const questionsCount = questions.filter((item) => item.type === 1).length;

  // Iterasi melalui setiap jawaban dalam array answers
  answers.forEach((answer) => {
    // Temukan pertanyaan (quiz) yang sesuai dengan id quiz_id pada jawaban
    const correspondingQuiz = questions.find(
      (question) => question.id === answer.question_id
    );

    // Jika ada pertanyaan yang sesuai
    if (correspondingQuiz) {
      const studentId = answer.nis;
      // Temukan indeks siswa jika sudah ada dalam array studentScores
      const studentIndex = studentScores.findIndex(
        (student) => student.nis === studentId
      );

      // Jika studentId belum ada dalam array studentScores, tambahkan
      if (studentIndex === -1) {
        studentScores.push({
          nis: studentId,
          correct: 0,
          wrong: 0,
          mcScore: 0,
          essayScore: 0,
          totalScore: 0,
        });
      }

      const student = studentScores.find(
        (student) => student.nis === studentId
      );

      // Periksa jenis soal
      if (correspondingQuiz.type === 1) {
        // Multiple Choice
        // Periksa apakah jawaban siswa sama dengan kunci jawaban
        if (answer.mc === correspondingQuiz.key) {
          // Jika sama, tambahkan ke jumlah jawaban benar
          student.correct++;
        } else {
          // Jika tidak, tambahkan ke jumlah jawaban salah
          student.wrong++;
        }
      } else if (correspondingQuiz.type === 2) {
        // Essay
        // Tambahkan skor Essay
        student.essayScore += (answer.poin || 0) * (quiz.essay_weight / 100);
      }

      // Menghitung mcScore
      // Jumlah jawaban benar pada pilihan ganda
      const correctMCQ = student.correct;
      // Menghitung persentase jawaban benar dari total soal pilihan ganda dan dikalikan dengan bobot
      student.mcScore = (correctMCQ / questionsCount) * mcqWeight;

      // Hitung total skor
      student.totalScore = student.mcScore + student.essayScore;
    }
  });

  return studentScores;
}

// Menampilkan jawaban dengan score
router.get(
  "/get/:quizId",
  authenticatedUser,
  authorizeRoles("admin", "teacher", "student"),
  async (req, res) => {
    try {
      const answer_data = await client.query(
        `SELECT * FROM answers WHERE quiz_id = $1`,
        [req.params.quizId]
      );

      const answers = answer_data.rows;

      const question_data = await client.query(
        "SELECT * FROM questions WHERE quiz_id = $1",
        [req.params.quizId]
      );

      const questions = question_data.rows;

      const find_quiz = await client.query(
        "SELECT * FROM quizzes WHERE id = $1",
        [req.params.quizId]
      );

      const quiz = find_quiz.rows[0];

      const studentScores = countAnswerByStudentId(questions, answers, quiz);

      res.status(200).json(studentScores);
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  }
);

// Create Answer
router.post(
  "/create",
  authenticatedUser,
  authorizeRoles("student"),
  async (req, res) => {
    try {
      const { quizId, questionId, type, mc, essay, poin } = req.body;

      const existingAnswer = await client.query(
        "SELECT * FROM answers WHERE quiz_id = $1 AND question_id = $2 AND nis = $3",
        [quizId, questionId, req.user.nis]
      );

      if (existingAnswer.rowCount > 0) {
        await client.query(
          "DELETE FROM answers WHERE quiz_id = $1 AND question_id = $2 AND nis = $3",
          [quizId, questionId, req.user.nis]
        );
      }

      await client.query(
        "INSERT INTO answers(quiz_id, question_id, type, nis, mc, essay, poin) " +
          "VALUES($1, $2, $3, $4, $5, $6, $7) RETURNING *",
        [quizId, questionId, type, req.user.nis, mc, essay, poin]
      );

      return res.status(200).json({ message: "Saved" });
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  }
);

// jawaban ragu
router.put(
  "/doubt",
  authenticatedUser,
  authorizeRoles("student"),
  async (req, res) => {
    try {
      const { quizId, questionId } = req.body;

      if (
        questionId === undefined ||
        questionId === null ||
        questionId === ""
      ) {
        return null;
      }

      const data = await client.query(
        "SELECT * FROM answers WHERE quiz_id = $1 AND question_id = $2 AND nis = $3",
        [quizId, questionId, req.user.nis]
      );

      if (!data) {
        return res.status(404).json({ message: "Answer not found" });
      }

      const yes = true;
      const no = false;

      if (data.rows[0].doubt) {
        await client.query(
          `UPDATE answers SET doubt = $1
            WHERE quiz_id = $2 AND question_id = $3 AND nis = $4`,
          [no, quizId, questionId, req.user.nis]
        );

        return res.status(200).json({ message: "Saved" });
      } else {
        await client.query(
          `UPDATE answers SET doubt = $1
            WHERE quiz_id = $2 AND question_id = $3 AND nis = $4`,
          [yes, quizId, questionId, req.user.nis]
        );

        return res.status(200).json({ message: "Saved" });
      }
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }
);

// Menampilkan jawaban berdasarkan Bank soal dan nis
router.get(
  "/get-my-answer/:exam_id",
  authenticatedUser,
  authorizeRoles("student"),
  async (req, res) => {
    try {
      const data = await client.query(
        "SELECT * FROM answers WHERE quiz_id = $1 AND nis = $2",
        [req.params.exam_id, req.user.nis]
      );

      const answers = data.rows;

      res.status(200).json(answers);
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  }
);

// Menampilkan jawaban pilihan ganda dan essay
router.get(
  "/get-students-answer/:quizId/:gradeId",
  authenticatedUser,
  authorizeRoles("admin", "teacher"),
  async (req, res) => {
    try {
      // Query for student info
      const { rows: studentsData } = await client.query(
        `SELECT students_class.nis, students.name, classes.name AS class, grades.grade
   FROM students_class
   INNER JOIN students ON students.nis = students_class.nis
   INNER JOIN grades ON grades.id = students_class.grade_id
   INNER JOIN classes ON classes.code = students_class.class_code
   WHERE students_class.grade_id = $1
   ORDER BY classes.name, students.name`,
        [req.params.gradeId]
      );

      // Query for answers from the answers table where the quiz ID matches
      const { rows: answersData } = await client.query(
        `SELECT DISTINCT ON (quiz_id, question_id, nis) *
         FROM answers 
         WHERE quiz_id = $1
         ORDER BY quiz_id, question_id, nis, createdAt DESC`,
        [req.params.quizId]
      );

      // Query for questions associated with the quiz
      const { rows: questionsData } = await client.query(
        `SELECT * FROM questions WHERE quiz_id = $1`,
        [req.params.quizId]
      );

      // Query for quiz weights
      const { rows: quizData } = await client.query(
        "SELECT * FROM quizzes WHERE id = $1",
        [req.params.quizId]
      );

      // Extract mcWeight and essayWeight as percentages
      const mcWeight = quizData[0].mc_weight / 100;
      const essayWeight = quizData[0].essay_weight / 100;

      // Array to hold student answers
      const result = studentsData.map((student) => {
        // Initialize counters for each student
        let essayPoin = 0;
        let mcPoin = 0;
        let correct = 0;
        let wrong = 0;

        // Create the studentAnswer object
        const studentAnswer = {
          nis: student.nis,
          name: student.name,
          grade: student.grade,
          class: student.class,
          essayPoin: 0,
          mcPoin: 0,
          totalPoin: 0,
          correct: 0,
          wrong: 0,
          answers: [],
        };

        // Filter answers by student
        const studentAnswers = answersData.filter(
          (answer) => answer.nis === student.nis
        );

        // Populate the answers array
        studentAnswers.forEach((answer) => {
          const matchingQuestion = questionsData.find(
            (question) => question.id === answer.question_id
          );

          if (matchingQuestion) {
            const isCorrect = answer.mc === matchingQuestion.key;

            // Calculate points and correctness
            if (matchingQuestion.type === 1) {
              // Multiple-choice question
              if (isCorrect) {
                correct++;
                mcPoin += answer.poin;
              } else {
                wrong++;
              }
            } else if (matchingQuestion.type === 2) {
              // Essay question
              essayPoin += answer.poin;
            }

            studentAnswer.answers.push({
              questionId: answer.question_id,
              key: matchingQuestion.key, // Add the key from the question
              mc: answer.mc,
              essay: answer.essay,
              poin: isCorrect ? answer.poin : 0, // Display answer.poin if correct, otherwise 0
            });
          }
        });

        // Apply weights to mcPoin and essayPoin
        studentAnswer.mcPoin = (mcPoin * mcWeight).toFixed(2);
        studentAnswer.essayPoin = (essayPoin * essayWeight).toFixed(2);

        // Calculate total points
        studentAnswer.totalPoin = (
          parseFloat(studentAnswer.mcPoin) + parseFloat(studentAnswer.essayPoin)
        ).toFixed(2);
        studentAnswer.correct = correct;
        studentAnswer.wrong = wrong;

        return studentAnswer;
      });

      // Send the result array as JSON
      res.status(200).json(result);
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  }
);

// Memberikan nilai uraian
router.put(
  "/give-score-essay/:questionId",
  authenticatedUser,
  authorizeRoles("admin", "teacher"),
  async (req, res) => {
    try {
      const answer = await client.query(
        "SELECT * FROM answers WHERE question_id = $1",
        [req.params.questionId]
      );

      if (answer.rowCount === 0) {
        return res.status(404).json({ error: "Data not found" });
      }

      await client.query(
        "UPDATE answers SET poin = $1 WHERE question_id = $2 AND nis = $3",
        [req.body.poin, req.params.questionId, req.body.nis]
      );

      // Kembalikan respons berhasil
      return res.status(200).json({ message: "Saved" });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: error.message });
    }
  }
);

// reset siswa
router.put(
  "/reset/:nis/:bankid",
  authenticatedUser,
  authorizeRoles("admin", "guru"),
  async (req, res) => {
    try {
      const { nis, bankid } = req.params;

      // menemukan pertanyaan berdarkan bank
      const dataQuestions = await client.query(
        "SELECT * FROM pertanyaan WHERE bank_id = $1",
        [bankid]
      );

      // menemukan jawaban berdasarkan nis
      const dataAnswers = await client.query(
        "SELECT * FROM jawaban WHERE nis = $1 AND bank_id = $2",
        [nis, bankid]
      );
    } catch (error) {
      console.log(error);
      return res.status(500).json({ error: error.message });
    }
  }
);

export default router;
