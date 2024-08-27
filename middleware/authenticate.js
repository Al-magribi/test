import jwt from "jsonwebtoken";
import { client } from "../connection/connection.js";

export const authenticatedUser = async (req, res, next) => {
  const { token } = req.cookies;

  if (!token) {
    return res.status(401).json({ message: "Login first" });
  }

  try {
    const decode = jwt.verify(token, process.env.JWT);
    const { id, type } = decode;

    let data;
    if (type === "super-admin") {
      data = await client.query("SELECT * FROM admin WHERE id = $1", [id]);
    } else if (type === "admin") {
      data = await client.query("SELECT * FROM admin WHERE id = $1", [id]);
    } else if (type === "student") {
      data = await client.query("SELECT * FROM students WHERE id = $1", [id]);
    } else if (type === "teacher") {
      data = await client.query("SELECT * FROM teachers WHERE id = $1", [id]);
    } else {
      return res.status(401).json({ message: "You dont have any permission" });
    }

    if (data.rows.length === 0) {
      return res.status(401).json({ message: "You dont have any permission" });
    }

    req.user = data.rows[0];
    req.user.type = type; // Add type to the user object for further use if needed

    next();
  } catch (error) {
    res.status(401).json({ message: "Token is not valid" });
  }
};

export const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Login first" });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: "You dont have permission",
      });
    }

    next();
  };
};
