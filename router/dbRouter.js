import express from "express";
import { client } from "../connection/connection.js";
import {
  authenticatedUser,
  authorizeRoles,
} from "../middleware/authenticate.js";

const router = express.Router();

router.get("/get-provinces", authenticatedUser, async (req, res) => {
  try {
    const data = await client.query(
      `SELECT * FROM provinces ORDER BY name ASC`
    );

    res.status(200).json(data.rows);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.get(
  "/get-regencies/:provinceId",
  authenticatedUser,
  async (req, res) => {
    try {
      const data = await client.query(
        `SELECT * FROM regencies WHERE province_id = $1 ORDER BY name ASC`,
        [req.params.provinceId]
      );

      res.status(200).json(data.rows);
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  }
);

router.get("/get-districts/:regencyId", authenticatedUser, async (req, res) => {
  try {
    const data = await client.query(
      `SELECT * FROM districts WHERE regency_id = $1 ORDER BY name ASC`,
      [req.params.regencyId]
    );

    res.status(200).json(data.rows);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.get("/get-villages/:districtId", authenticatedUser, async (req, res) => {
  try {
    const data = await client.query(
      `SELECT * FROM villages WHERE district_id = $1 ORDER BY name ASC`,
      [req.params.districtId]
    );

    res.status(200).json(data.rows);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.post(
  "/add-student-data",
  authenticatedUser,
  authorizeRoles("admin", "teacher"),
  async (req, res) => {
    const {
      name,
      nisn,
      nis,
      birth_place,
      birth_date,
      height,
      weight,
      around_head,
      order_birth,
      siblings,
      province_id,
      province_name,
      regency_id,
      regency_name,
      district_id,
      district_name,
      village_id,
      village_name,
      address,
      postal_code,
    } = req.body;

    try {
      // Pengecekan apakah NIS sudah ada di db_students
      const studentCheck = await client.query(
        `SELECT * FROM db_students WHERE nis = $1`,
        [nis]
      );

      if (studentCheck.rows.length > 0) {
        // Jika NIS ditemukan, update kolom yang sesuai dengan data dari req.body
        await client.query(
          `UPDATE db_students SET
                    name = COALESCE($1, name),
                    birth_place = COALESCE($2, birth_place),
                    birth_date = COALESCE($3, birth_date),
                    height = COALESCE($4, height),
                    weight = COALESCE($5, weight),
                    around_head = COALESCE($6, around_head),
                    order_birth = COALESCE($7, order_birth),
                    siblings = COALESCE($8, siblings),
                    province_id = COALESCE($9, province_id),
                    province_name = COALESCE($10, province_name),
                    regency_id = COALESCE($11, regency_id),
                    regency_name = COALESCE($12, regency_name),
                    district_id = COALESCE($13, district_id),
                    district_name = COALESCE($14, district_name),
                    village_id = COALESCE($15, village_id),
                    village_name = COALESCE($16, village_name),
                    address = COALESCE($17, address),
                    postal_code = COALESCE($18, postal_code),
                    nisn = COALESCE($19,nisn)
                WHERE nis = $20
                RETURNING *`,
          [
            name,
            birth_place,
            birth_date,
            height,
            weight,
            around_head,
            order_birth,
            siblings,
            province_id,
            province_name,
            regency_id,
            regency_name,
            district_id,
            district_name,
            village_id,
            village_name,
            address,
            postal_code,
            nisn,
            nis,
          ]
        );

        return res.status(200).json({ message: "Database updated" });
      } else {
        // Jika NIS tidak ditemukan, tambahkan data baru ke db_students
        await client.query(
          `INSERT INTO db_students (
                    name, nisn, nis, birth_place, birth_date, height, weight, around_head,
                    order_birth, siblings, province_id, province_name, regency_id, 
                    regency_name, district_id, district_name, village_id, village_name, 
                    address, postal_code
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
                RETURNING *`,
          [
            name,
            nisn,
            nis,
            birth_place,
            birth_date,
            height,
            weight,
            around_head,
            order_birth,
            siblings,
            province_id,
            province_name,
            regency_id,
            regency_name,
            district_id,
            district_name,
            village_id,
            village_name,
            address,
            postal_code,
          ]
        );

        return res.status(201).json({ message: "Student added to database" });
      }
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: error.message });
    }
  }
);

router.post(
  "/add-parents-data",
  authenticatedUser,
  authorizeRoles("admin", "teacher"),
  async (req, res) => {
    const {
      nis,
      father_nik,
      father_name,
      father_birth_place,
      father_birth_date,
      father_job,
      father_position,
      father_earning,
      father_phone,
      mother_nik,
      mother_name,
      mother_birth_place,
      mother_birth_date,
      mother_job,
      mother_position,
      mother_earning,
      mother_phone,
    } = req.body;

    try {
      // Check if the student exists in db_students
      const studentCheck = await client.query(
        `SELECT * FROM db_students WHERE nis = $1`,
        [nis]
      );

      if (studentCheck.rowCount > 0) {
        await client.query(
          `UPDATE db_students SET
              father_nik = COALESCE($1, father_nik),
              father_name = COALESCE($2, father_name),
              father_birth_place = COALESCE($3, father_birth_place),
              father_birth_date = COALESCE($4, father_birth_date),
              father_job = COALESCE($5, father_job),
              father_position = COALESCE($6, father_position),
              father_earning = COALESCE($7, father_earning),
              father_phone = COALESCE($8, father_phone),
              mother_nik = COALESCE($9, mother_nik),
              mother_name = COALESCE($10, mother_name),
              mother_birth_place = COALESCE($11, mother_birth_place),
              mother_birth_date = COALESCE($12, mother_birth_date),
              mother_job = COALESCE($13, mother_job),
              mother_position = COALESCE($14, mother_position),
              mother_earning = COALESCE($15, mother_earning),
              mother_phone = COALESCE($16, mother_phone)
            WHERE nis = $17
            RETURNING *`,
          [
            father_nik,
            father_name,
            father_birth_place,
            father_birth_date,
            father_job,
            father_position,
            father_earning,
            father_phone,
            mother_nik,
            mother_name,
            mother_birth_place,
            mother_birth_date,
            mother_job,
            mother_position,
            mother_earning,
            mother_phone,
            nis,
          ]
        );

        return res.status(200).json({ message: "Parent data updated" });
      } else {
        return res.status(404).json({ message: "Student not found." });
      }
    } catch (error) {
      console.error(error.message);
      return res.status(500).json({ message: "Internal server error." });
    }
  }
);

router.post(
  "/add-family-data",
  authenticatedUser,
  authorizeRoles("admin", "teacher"),
  async (req, res) => {
    const { nis, familyData } = req.body;

    try {
      // Pengecekan apakah NIS sudah ada di db_students
      const studentCheck = await client.query(
        `SELECT * FROM db_students WHERE nis = $1`,
        [nis]
      );

      if (studentCheck.rows.length > 0) {
        // Fetch the existing family_info
        const currentFamilyInfo = studentCheck.rows[0].family_info || [];

        // Map existing family_info by ID for quick lookup
        const familyInfoMap = new Map();
        currentFamilyInfo.forEach((item) => familyInfoMap.set(item.id, item));

        // Combine existing family_info with the new data
        familyData.forEach((item) => {
          familyInfoMap.set(item.id, item); // Update or add the item
        });

        // Convert map values back to an array
        const updatedFamilyInfo = Array.from(familyInfoMap.values());

        // Update the family_info in the database
        const updateResult = await client.query(
          `UPDATE db_students SET
                family_info = $1
            WHERE nis = $2
            RETURNING *`,
          [JSON.stringify(updatedFamilyInfo), nis]
        );

        return res.status(200).json({ message: "Family data updated" });
      } else {
        // Jika NIS tidak ditemukan, kembalikan error
        return res.status(404).json({ message: "NIS not found" });
      }
    } catch (error) {
      console.error(error.message);
      return res.status(500).json({ message: error.message });
    }
  }
);

router.delete(
  "/delete-family-data",
  authenticatedUser,
  authorizeRoles("admin", "teacher"),
  async (req, res) => {
    const { nis, familyId } = req.body;

    try {
      // Check if NIS exists in db_students
      const studentCheck = await client.query(
        `SELECT * FROM db_students WHERE nis = $1`,
        [nis]
      );

      if (studentCheck.rows.length > 0) {
        // Get the current family_info
        const currentFamilyInfo = studentCheck.rows[0].family_info || [];

        // Filter out the family data by id
        const updatedFamilyInfo = currentFamilyInfo.filter(
          (item) => item.id !== familyId
        );

        // Update the family_info in the database
        const updateResult = await client.query(
          `UPDATE db_students SET family_info = $1 WHERE nis = $2 RETURNING *`,
          [JSON.stringify(updatedFamilyInfo), nis]
        );

        return res.status(200).json({ message: "Family data deleted" });
      } else {
        return res.status(404).json({ message: "NIS not found" });
      }
    } catch (error) {
      console.error(error.message);
      return res.status(500).json({ message: error.message });
    }
  }
);

router.post(
  "/add-health-data",
  authenticatedUser,
  authorizeRoles("admin", "teacher"),
  async (req, res) => {
    const { nis, healthData } = req.body;

    try {
      const studentCheck = await client.query(
        `SELECT * FROM db_students WHERE nis = $1`,
        [nis]
      );

      if (studentCheck.rows.length > 0) {
        const currentHealthInfo = studentCheck.rows[0].health_records || [];

        const halthInfo = new Map();
        currentHealthInfo.forEach((item) => halthInfo.set(item.id, item));

        healthData.forEach((item) => {
          halthInfo.set(item.id, item);
        });

        const updatedHealthInfo = Array.from(halthInfo.values());

        await client.query(
          `UPDATE db_students SET
                health_records = $1
            WHERE nis = $2
            RETURNING *`,
          [JSON.stringify(updatedHealthInfo), nis]
        );

        return res.status(200).json({ message: "Health records updated" });
      } else {
        return res.status(404).json({ message: "NIS not found" });
      }
    } catch (error) {
      console.error(error.message);
      return res.status(500).json({ message: error.message });
    }
  }
);

router.delete(
  "/delete-health-data",
  authenticatedUser,
  authorizeRoles("admin", "teacher"),
  async (req, res) => {
    const { nis, healthId } = req.body;

    try {
      const studentCheck = await client.query(
        `SELECT * FROM db_students WHERE nis = $1`,
        [nis]
      );

      if (studentCheck.rows.length > 0) {
        const currentHealthData = studentCheck.rows[0].health_records || [];

        const updatedHealthData = currentHealthData.filter(
          (item) => item.id !== healthId
        );

        await client.query(
          `UPDATE db_students SET health_records = $1 WHERE nis = $2 RETURNING *`,
          [JSON.stringify(updatedHealthData), nis]
        );

        return res.status(200).json({ message: "Family data deleted" });
      } else {
        return res.status(404).json({ message: "NIS not found" });
      }
    } catch (error) {
      console.error(error.message);
      return res.status(500).json({ message: error.message });
    }
  }
);

router.get(
  "/get-database",
  authenticatedUser,
  authorizeRoles("super-admin", "admin", "teacher"),
  async (req, res) => {
    try {
      const data = await client.query(`SELECT * FROM db_students`);

      const database = data.rows;

      res.status(200).json(database);
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  }
);

router.get(
  `/get-student/:nis`,
  authenticatedUser,
  authorizeRoles("super-admin", "admin", "teacher", "student"),
  async (req, res) => {
    try {
      const data = await client.query(
        `SELECT * FROM db_students WHERE nis = $1`,
        [req.params.nis]
      );

      res.status(200).json(data.rows[0]);
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  }
);

// demographic
router.get(
  "/get-demographic",
  authenticatedUser,
  authorizeRoles("super-admin", "admin"),
  async (req, res) => {
    try {
      let data;

      if (req.user.role === "admin") {
        // Get the list of NIS for students under the admin's homebase
        const { rows: students } = await client.query(
          `SELECT nis FROM students_class WHERE homebase_id = $1`,
          [req.user.homebase_id]
        );

        // Extract NIS values into an array
        const nisList = students.map((student) => student.nis);

        if (nisList.length > 0) {
          const queryProvince = `
              SELECT province_id, province_name AS name, COUNT(*) AS total 
              FROM db_students 
              WHERE nis = ANY($1)
              GROUP BY province_id, province_name
          `;
          const queryRegency = `
              SELECT regency_id, regency_name AS name, COUNT(*) AS total 
              FROM db_students 
              WHERE nis = ANY($1)
              GROUP BY regency_id, regency_name
          `;
          const queryDistrict = `
              SELECT district_id, district_name AS name, COUNT(*) AS total 
              FROM db_students 
              WHERE nis = ANY($1)
              GROUP BY district_id, district_name
          `;
          const queryVillage = `
              SELECT village_id, village_name AS name, COUNT(*) AS total 
              FROM db_students 
              WHERE nis = ANY($1)
              GROUP BY village_id, village_name
          `;

          const [
            provincesResult,
            regenciesResult,
            districtsResult,
            villagesResult,
          ] = await Promise.all([
            client.query(queryProvince, [nisList]),
            client.query(queryRegency, [nisList]),
            client.query(queryDistrict, [nisList]),
            client.query(queryVillage, [nisList]),
          ]);

          data = {
            provinces: provincesResult.rows,
            regencies: regenciesResult.rows,
            districts: districtsResult.rows,
            villages: villagesResult.rows,
          };
        } else {
          data = {
            provinces: [],
            regencies: [],
            districts: [],
            villages: [],
          };
        }
      } else {
        const queryProvince = `
            SELECT province_id, province_name AS name, COUNT(*) AS total 
            FROM db_students 
            GROUP BY province_id, province_name
        `;
        const queryRegency = `
            SELECT regency_id, regency_name AS name, COUNT(*) AS total 
            FROM db_students 
            GROUP BY regency_id, regency_name
        `;
        const queryDistrict = `
            SELECT district_id, district_name AS name, COUNT(*) AS total 
            FROM db_students 
            GROUP BY district_id, district_name
        `;
        const queryVillage = `
            SELECT village_id, village_name AS name, COUNT(*) AS total 
            FROM db_students 
            GROUP BY village_id, village_name
        `;

        const [
          provincesResult,
          regenciesResult,
          districtsResult,
          villagesResult,
        ] = await Promise.all([
          client.query(queryProvince),
          client.query(queryRegency),
          client.query(queryDistrict),
          client.query(queryVillage),
        ]);

        data = {
          provinces: provincesResult.rows,
          regencies: regenciesResult.rows,
          districts: districtsResult.rows,
          villages: villagesResult.rows,
        };
      }

      res.status(200).json(data);
    } catch (error) {
      console.error("Error fetching demographic data:", error);
      res.status(500).json({ message: "Internal Server Error" });
    }
  }
);

export default router;
