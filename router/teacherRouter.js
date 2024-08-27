import express from "express";
import { client } from "../connection/connection.js";
import bcrypt from "bcrypt";
import {
  authenticatedUser,
  authorizeRoles,
} from "../middleware/authenticate.js";

const router = express.Router();

// Mendaftarkan guru
router.post(
  "/create",
  authenticatedUser,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      const { nip, name, subjectIds, classCode, homeroom } = req.body;
      const homebase = req.user.homebase_id;

      const password = "12345678";
      const role = "teacher";

      const userChecking = await client.query(
        "SELECT * FROM teachers WHERE nip = $1",
        [nip]
      );

      if (userChecking.rowCount > 0)
        return res.status(500).json({ message: "NIP have been used" });

      bcrypt.hash(password, 10, async (err, hash) => {
        if (err) {
          return res.status(500).json({ message: err.message });
        }

        const insertionQuery =
          "INSERT INTO teachers " +
          "(nip, homebase_id, name, subject_code, homeroom, classCode, password, role) " +
          "VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *";

        const insertionValues = [
          nip,
          homebase,
          name,
          subjectIds,
          homeroom,
          classCode,
          hash,
          role,
        ];

        try {
          const process = await client.query(insertionQuery, insertionValues);
          const user = process.rows[0];

          return res
            .status(200)
            .json({ message: "Teacher is successfully added", user });
        } catch (error) {
          return res.status(500).json({ message: error.message });
        }
      });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: error.message });
    }
  }
);

// Mengupload guru
router.post(
  "/upload",
  authenticatedUser,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      const data = req.body.data;
      const homebase = req.user.homebase_id;

      const password = "12345678";
      const role = "teacher";

      // Memeriksa apakah data yang diterima memiliki nilai null untuk name
      const teachersData = data.filter(
        (item) => item[0] !== null && item[0] !== undefined
      );

      // Memproses setiap baris data
      for (const teacher of teachersData) {
        // Memeriksa apakah data yang diterima memiliki nilai yang valid
        if (
          teacher.length >= 3 &&
          teacher.every((item) => item !== null && item !== undefined)
        ) {
          bcrypt.hash(password, 10, async (err, hash) => {
            if (err) {
              console.error(err);
              return res.status(500).json({
                message: "There is an error while encrypting the password",
              });
            }
            client.query(
              "INSERT INTO teachers " +
                "(nip, name, subject_code, password, role, homebase_id) " +
                "VALUES ($1, $2, $3, $4, $5, $6)",
              [teacher[0], teacher[1], `{${teacher[2]}}`, hash, role, homebase],
              (err, result) => {
                if (err) {
                  console.error(err);
                  return res.status(500).json({
                    message:
                      "There is an error while adding teachers to database",
                  });
                }
              }
            );
          });
        } else {
          return res
            .status(500)
            .json({ message: `Kesalahan data: ${teacher}` });
        }
      }

      res.status(200).json({
        message: `${teachersData.length} teachers are successfully added`,
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: error.message });
    }
  }
);

// Menampilkan guru
router.get(
  "/get",
  authenticatedUser,
  authorizeRoles("admin", "super-admin"), // Ensure both roles can access this route
  async (req, res) => {
    try {
      const { role, homebase_id } = req.user;

      let query;
      let queryParams = [];

      if (role === "super-admin") {
        // Query for super-admin (no filter on homebase)
        query = `
          SELECT 
            teachers.id, 
            teachers.nip, 
            teachers.name, 
            teachers.email, 
            homebase.name AS homebase_name, 
            teachers.homeroom, 
            classes.name AS class, 
            COALESCE(
              ARRAY_AGG(
                json_build_object('id', subjects.code, 'code', subjects.code, 'subject', subjects.name)
              ) FILTER (WHERE subjects.code IS NOT NULL), 
              '{}'::json[]
            ) AS subjects 
          FROM teachers 
          LEFT JOIN unnest(teachers.subject_code) AS teacher_subject_code ON true
          LEFT JOIN subjects ON subjects.code = teacher_subject_code 
          INNER JOIN homebase ON homebase.id = teachers.homebase_id 
          LEFT JOIN classes ON classes.code = teachers.class_code 
          GROUP BY 
            teachers.id, 
            teachers.nip, 
            teachers.name, 
            teachers.email, 
            homebase.name, 
            teachers.homeroom, 
            classes.name 
          ORDER BY teachers.name ASC
        `;
      } else {
        // Query for admin (filter by homebase_id)
        query = `
          SELECT 
            teachers.id, 
            teachers.nip, 
            teachers.name, 
            teachers.email, 
            homebase.name AS homebase_name, 
            teachers.homeroom, 
            classes.name AS class, 
            COALESCE(
              ARRAY_AGG(
                json_build_object('id', subjects.code, 'code', subjects.code, 'subject', subjects.name)
              ) FILTER (WHERE subjects.code IS NOT NULL), 
              '{}'::json[]
            ) AS subjects 
          FROM teachers 
          LEFT JOIN unnest(teachers.subject_code) AS teacher_subject_code ON true
          LEFT JOIN subjects ON subjects.code = teacher_subject_code 
          INNER JOIN homebase ON homebase.id = teachers.homebase_id 
          LEFT JOIN classes ON classes.code = teachers.class_code 
          WHERE teachers.homebase_id = $1
          GROUP BY 
            teachers.id, 
            teachers.nip, 
            teachers.name, 
            teachers.email, 
            homebase.name, 
            teachers.homeroom, 
            classes.name 
          ORDER BY teachers.name ASC
        `;
        queryParams.push(homebase_id);
      }

      // Execute the query
      const data = await client.query(query, queryParams);
      res.status(200).json(data.rows);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// Detail guru
router.get(
  "/detail/:id",
  authenticatedUser,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      const data = await client.query(
        `SELECT 
          teachers.id, 
          teachers.nip, 
          teachers.name, 
          teachers.email, 
          teachers.subject_code, 
          homebase.name AS homebase, 
          teachers.homeroom, 
          classes.name AS class, 
          teachers.class_code, 
          array_agg(subjects.name) AS subjects
        FROM 
          teachers 
        LEFT JOIN 
          homebase ON homebase.id = teachers.homebase_id 
        LEFT JOIN 
          classes ON classes.code = teachers.class_code 
        LEFT JOIN 
          subjects ON subjects.code = ANY(teachers.subject_code) 
        WHERE 
          teachers.id = $1 
        GROUP BY 
          teachers.id, teachers.nip, teachers.name, teachers.email, homebase.name, teachers.homeroom, classes.name, teachers.class_code`,
        [req.params.id]
      );

      res.status(200).json(data.rows[0]);
    } catch (error) {
      console.log(error);
      res.status(500).json({ message: error.message });
    }
  }
);

// Memperbarui guru
router.put(
  "/update/:id",
  authenticatedUser,
  authorizeRoles("admin", "guru"),
  async (req, res) => {
    try {
      const { id } = req.params;

      const { nip, name, homeroom, classCode, subjectIds, email, avatar } =
        req.body;

      const updatedTeacher = await client.query(
        "UPDATE teachers SET name = $1, email = $2, subject_code = $3, nip = $4, homeroom = $5, " +
          "class_code = $6, avatar = $7 WHERE id = $8 RETURNING *",
        [name, email, subjectIds, nip, homeroom, classCode, avatar, id]
      );

      if (updatedTeacher.rowCount > 0) {
        res.status(200).json({
          message: "Teacher is successfully updated",
          data: updatedTeacher.rows[0],
        });
      } else {
        res.status(404).json({ message: "Teacher not found" });
      }
    } catch (error) {
      console.error("Error updating teacher:", error);
      res.status(500).json({ message: error.message });
    }
  }
);

// Menghapus guru
router.delete(
  "/delete/:id",
  authenticatedUser,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      const id = req.params.id;

      const data = await client.query(
        "DELETE FROM teachers WHERE id = $1 RETURNING *",
        [id]
      );

      if (data.rowCount === 0) {
        return res.status(404).json({ message: "Teacher not found" });
      }

      res.status(200).json({
        message: "Teacher is successfully deleted",
        deletedTeacher: data.rows[0],
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

// Menghapus data guru
router.delete(
  "/clear-data",
  authenticatedUser,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      const homebase = req.user.homebase_id;
      await client.query("DELETE FROM teachers WHERE homebase_id = $1", [
        homebase,
      ]);

      res.status(200).json({ message: "Teachers are successfully deleted" });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

export default router;
