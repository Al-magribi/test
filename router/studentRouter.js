import express from "express";
import { client } from "../connection/connection.js";
import bcrypt from "bcrypt";
import {
  authenticatedUser,
  authorizeRoles,
} from "../middleware/authenticate.js";

const router = express.Router();

// ADMIN
// Menambahkan siswa
router.post(
  "/create",
  authenticatedUser,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      const homebase = req.user.homebase_id;
      const { nis, name } = req.body;

      const password = "12345678";
      const role = "student";

      const userChecking = await client.query(
        "SELECT * FROM students WHERE nis = $1",
        [nis]
      );

      if (userChecking.rowCount > 0)
        return res.status(500).json({ message: "NIS has been used" });

      bcrypt.hash(password, 10, async (err, hash) => {
        if (err) {
          return res.status(500).json({ message: err.message });
        }

        const insertionQuery =
          "INSERT INTO students (nis, name, password, role, homebase_id) " +
          "VALUES ($1, $2, $3, $4, $5) RETURNING *";

        const insertionValues = [nis, name, hash, role, homebase];

        try {
          const process = await client.query(insertionQuery, insertionValues);
          const user = process.rows[0];

          return res
            .status(200)
            .json({ message: "Student is successfully added", user });
        } catch (error) {
          return res.status(500).json({ message: error.message });
        }
      });
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  }
);

// Mengupload siswa
router.post(
  "/upload",
  authenticatedUser,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      const homebase = req.user.homebase_id;
      const data = req.body.data;

      const password = "12345678";
      const role = "student";

      // Memeriksa apakah data yang diterima memiliki nilai null untuk name
      const studentsData = data.filter(
        (item) => item[1] !== null && item[1] !== undefined
      );

      // Menggunakan Promise.all untuk menunggu semua operasi hash selesai sebelum memberikan respons
      await Promise.all(
        studentsData.map(async (student) => {
          const hash = await bcrypt.hash(password, 10);

          await client.query(
            "INSERT INTO students (homebase_id, nis, name, password, role) VALUES ($1, $2, $3, $4, $5)",
            [homebase, student[0], student[1], hash, role]
          );
        })
      );

      res.status(200).json({
        message: `${studentsData.length} students are successfully added`,
      });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ error: error.message });
    }
  }
);

// Menampilkan seluruh siswa
router.get(
  "/get",
  authenticatedUser,
  authorizeRoles("admin", "super-admin"),
  async (req, res) => {
    try {
      const data = await client.query(
        "SELECT students.id, students.name, homebase.name AS homebase, students.nis FROM students " +
          "INNER JOIN homebase ON homebase.id = students.homebase_id " +
          "ORDER BY students.name ASC"
      );

      const students = data.rows;

      return res.status(200).json(students);
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: error.message });
    }
  }
);

// Menampilkan siswa berdasarkan homebase
router.get(
  "/get-by-homebase",
  authenticatedUser,
  authorizeRoles("admin", "teacher"),
  async (req, res) => {
    try {
      const homebase = req.user.homebase_id;

      const data = await client.query(
        `SELECT students_class.id, students_class.nis,
        students.name, homebase.name AS homebase FROM students_class
        INNER JOIN students ON students.nis = students_class.nis
        INNER JOIN homebase ON homebase.id = students_class.homebase_id
        WHERE students_class.homebase_id = $1 
        ORDER BY students.name`,
        [homebase]
      );

      const students = data.rows;

      return res.status(200).json(students);
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: error.message });
    }
  }
);

// Detail siswa
router.get(
  "/detail/:id",
  authenticatedUser,
  authorizeRoles("admin", "siswa", "guru"),
  async (req, res) => {
    try {
      const { id } = req.params;

      const data = await client.query(
        "SELECT * FROM students " + "WHERE students.id = $1",
        [id]
      );

      const student = data.rows[0];

      res.status(200).json(student);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

// Profile
router.get(
  "/student-profile",
  authenticatedUser,
  authorizeRoles("student"),
  async (req, res) => {
    try {
      const nis = req.user.nis;

      const data = await client.query(
        `SELECT * FROM db_students WHERE nis = $1`,
        [nis]
      );

      const profile = data.rows[0];

      res.status(200).json(profile);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

// Memperbarui siswa
router.put(
  "/update/:id",
  authenticatedUser,
  authorizeRoles("admin", "student", "teacher"),
  async (req, res) => {
    try {
      const { id } = req.params;

      const { nis, name } = req.body;

      await client.query(
        "UPDATE students SET nis = $1, name = $2 WHERE id = $3 RETURNING *",
        [nis, name, id]
      );

      res.status(200).json({
        message: "Student is updated successfully",
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

// Menghapus siswa
router.delete(
  "/delete/:id",
  authenticatedUser,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      const id = req.params.id;

      const data = await client.query(
        "DELETE FROM students WHERE id = $1 RETURNING *",
        [id]
      );

      if (data.rows.length === 0) {
        return res.status(404).json({ message: "Student not found" });
      }

      res.status(200).json({
        message: "Students is successfully deleted",
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

// ADMIN SATUAN
// Menambahkan siswa ke dalam kelas
router.post(
  "/add-student-to-class",
  authenticatedUser,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      const homebase = req.user.homebase_id;
      const { nis, gradeId, code } = req.body;

      // Check if student exists in the 'students' table
      const studentCheck = await client.query(
        "SELECT * FROM students WHERE nis = $1",
        [nis]
      );

      if (studentCheck.rowCount === 0) {
        return res.status(404).json({ message: "Student not found" });
      }

      const student = studentCheck.rows[0];

      // Check if student is already in the 'students_class' table
      const classCheck = await client.query(
        "SELECT * FROM students_class WHERE nis = $1",
        [nis]
      );

      if (classCheck.rowCount > 0) {
        return res
          .status(400)
          .json({ message: "Student is already in this class" });
      }

      // Add student to the 'students_class' table
      await client.query(
        "INSERT INTO students_class(homebase_id, nis, grade_id, class_code) " +
          "VALUES($1, $2, $3, $4)",
        [homebase, student.nis, gradeId, code]
      );

      res
        .status(200)
        .json({ message: "Student successfully added to the class" });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: error.message });
    }
  }
);

// Mengupload siswa
router.post(
  "/upload-to-class/:gradeId/:classCode",
  authenticatedUser,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      const homebase = req.user.homebase_id;
      const data = req.body.data;
      const { gradeId, classCode } = req.params;

      // Memeriksa apakah data yang diterima memiliki nilai null untuk name
      const studentsData = data.filter(
        (item) => item[1] !== null && item[1] !== undefined
      );

      // Memeriksa apakah semua nis ada di tabel students
      for (let i = 0; i < studentsData.length; i++) {
        const student = studentsData[i];
        const nis = student[0];
        const result = await client.query(
          "SELECT COUNT(*) FROM students WHERE nis = $1",
          [nis]
        );

        // Jika nis tidak ditemukan, kirim pesan kesalahan
        if (result.rows[0].count === "0") {
          return res
            .status(400)
            .json({ message: `NIS ${nis} not found in students database` });
        }
      }

      // Menggunakan Promise.all untuk menunggu semua operasi insert selesai
      await Promise.all(
        studentsData.map(async (student) => {
          await client.query(
            "INSERT INTO students_class(homebase_id, nis, grade_id, class_code) VALUES ($1, $2, $3, $4)",
            [homebase, student[0], gradeId, classCode]
          );
        })
      );

      res.status(200).json({
        message: `${studentsData.length} students are successfully added`,
      });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ error: error.message });
    }
  }
);

// Menampilkan siswa berdasarkan tingkat
router.get(
  "/get-by-grade/:gradeId",
  authenticatedUser,
  authorizeRoles("admin", "teacher"),
  async (req, res) => {
    try {
      const data = await client.query(
        `SELECT students_class.id, students_class.nis, students.name, grades.grade,
        classes.name AS class FROM students_class
        INNER JOIN students ON students.nis = students_class.nis
        INNER JOIN grades ON grades.id = students_class.grade_id
        INNER JOIN classes ON classes.code = students_class.class_code
        WHERE students_class.grade_id = $1
        ORDER BY classes.name, students.name`,
        [req.params.gradeId]
      );

      const students = data.rows;
      res.status(200).json(students);
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  }
);

// Menampilkan siswa berdasarkan kelas
router.get(
  "/get-by-class/:class",
  authenticatedUser,
  authorizeRoles("admin", "teacher"),
  async (req, res) => {
    try {
      const students = await client.query(
        "SELECT students_class.id, students_class.nis, grades.grade, students.name, " +
          "classes.name AS class FROM students_class " +
          "INNER JOIN classes ON students_class.class_code = classes.code " +
          "INNER JOIN grades ON students_class.grade_id = grades.id " +
          "INNER JOIN students on students_class.nis = students.nis " +
          "WHERE students_class.class_code = $1 " +
          "ORDER BY classes.name ASC, students.name ASC",
        [req.params.class]
      );

      res.status(200).json(students.rows);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }
);

// Menghapus siswa dari kelas
router.delete(
  "/remove-from-class/:id",
  authenticatedUser,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      const id = req.params.id;

      const data = await client.query(
        "DELETE FROM students_class WHERE id = $1 RETURNING *",
        [id]
      );

      if (data.rowCount === 0) {
        return res.status(404).json({ message: "Student not found" });
      }

      res.status(200).json({
        message: "Students is successfully removed from this class",
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

// Menghapus data siswa
router.delete(
  "/clear-data",
  authenticatedUser,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      const homebase = req.user.homebase_id;

      await client.query("DELETE FROM students WHERE homebase_id = $1", [
        homebase,
      ]);

      res.status(200).json({ message: "Students are successfully deleted" });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

export default router;
