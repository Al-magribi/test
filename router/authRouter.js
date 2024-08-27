import express from "express";
import { client } from "../connection/connection.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import {
  authenticatedUser,
  authorizeRoles,
} from "../middleware/authenticate.js";

const router = express.Router();

router.post("/super-admin/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const data = await client.query("SELECT * FROM admin WHERE email = $1", [
      email,
    ]);

    const user = data.rows[0];

    bcrypt.compare(password, user.password, (err, result) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (!result) {
        return res
          .status(401)
          .json({ message: "You have entered wrong password" });
      }

      const token = jwt.sign(
        { id: user.id, type: user.role },
        process.env.JWT,
        {
          expiresIn: "8h",
        }
      );

      res.cookie("token", token, { httpOnly: true, maxAge: 28800000 });
      res.status(200).json({ message: "Login success", user });
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { nis, nip, email, password } = req.body;
    let query, userType;

    if (nis) {
      query = { text: "SELECT * FROM students WHERE nis = $1", values: [nis] };
      userType = "student";
    } else if (nip) {
      query = { text: "SELECT * FROM teachers WHERE nip = $1", values: [nip] };
      userType = "teacher";
    } else if (email) {
      query = { text: "SELECT * FROM admin WHERE email = $1", values: [email] };
      userType = "admin";
    } else {
      return res
        .status(400)
        .json({ message: "Please provide valid credentials" });
    }

    const data = await client.query(query);
    if (data.rowCount === 0) {
      return res.status(401).json({ message: "User not found" });
    }

    const user = data.rows[0];
    bcrypt.compare(password, user.password, (err, result) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (!result) {
        return res
          .status(401)
          .json({ message: "You have entered wrong password" });
      }

      const token = jwt.sign({ id: user.id, type: userType }, process.env.JWT, {
        expiresIn: "8h",
      });

      res.cookie("token", token, { httpOnly: true, maxAge: 28800000 });
      res.status(200).json({ message: "Login success", user });
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.post("/logout", (req, res) => {
  try {
    res.cookie("token", null, {
      httpOnly: true,
      maxAge: new Date(Date.now()),
    });

    res.status(200).json({ message: "Logout success" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.get("/load", authenticatedUser, async (req, res) => {
  try {
    const user = req.user;

    if (user && user.role === "admin") {
      const data = await client.query(
        "SELECT admin.name, admin.role, homebase.name AS homebase " +
          "FROM admin " +
          "INNER JOIN homebase ON homebase.id = admin.homebase_id " +
          "WHERE admin.id = $1",
        [user.id]
      );
      const adminData = data.rows[0];

      res.status(200).json(adminData);
    } else if (user && user.role === "student") {
      const data = await client.query(
        "SELECT students.name, students.role, students.nis " +
          "FROM students " +
          "WHERE students.id = $1",
        [user.id]
      );

      const data1 = data.rows[0];

      const detail = await client.query(
        `SELECT students_class.grade_id, grades.grade, classes.name AS class, homebase.name AS homebase
        FROM students_class 
        INNER JOIN grades ON students_class.grade_id = grades.id
        INNER JOIN classes ON students_class.class_code = classes.code
        INNER JOIN homebase ON students_class.homebase_id = homebase.id
        WHERE students_class.nis = $1`,
        [data1.nis]
      );

      const data2 = detail.rows[0];

      const student = {
        name: data1.name,
        nis: data1.nis,
        homebase: data2.homebase,
        grade_id: data2.grade_id,
        grade: data2.grade,
        class: data2.class,
        role: data1.role,
      };

      res.status(200).json(student);
    } else if (user && user.role === "teacher") {
      const data = await client.query(
        `SELECT 
          teachers.id,
          teachers.role, 
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
        [req.user.id]
      );

      const teacher = data.rows[0];

      res.status(200).json(teacher);
    }
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: error.message });
  }
});

export default router;
