import express from "express";
import bodyParser from "body-parser";
import session from "express-session";
import cookieParser from "cookie-parser";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import useragent from "express-useragent";

// Routers
import authRouter from "./router/authRouter.js";
import adminRouter from "./router/adminRouter.js";
import homebaseRouter from "./router/homebaseRouter.js";
import classRouter from "./router/classRouter.js";
import gradeRouter from "./router/gradeRouter.js";
import subjectRouter from "./router/subjectRouter.js";
import teacherRouter from "./router/teacherRouter.js";
import studentRouter from "./router/studentRouter.js";
import quizRouter from "./router/quizRouter.js";
import questionRouter from "./router/questionRouter.js";
import scheduleRouter from "./router/scheduleRouter.js";
import uploadRouter from "./router/uploadRouter.js";
import answerRouter from "./router/answerRouter.js";
import logRouter from "./router/logRouter.js";
import dbRouter from "./router/dbRouter.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(
  cors({
    origin: [
      process.env.DOMAIN_1,
      process.env.DOMAIN_2,
      process.env.DOMAIN_3,
      process.env.DOMAIN_4,
      process.env.DOMAIN_5,
    ],
    credentials: true,
  })
);
app.use(cookieParser());
app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ extended: true, limit: "50mb" }));
app.use(useragent.express());

app.use("/upload", express.static(path.join(__dirname, "upload")));
app.use("/auth/", authRouter);
app.use("/admin", adminRouter);
app.use("/homebase", homebaseRouter);
app.use("/grade", gradeRouter);
app.use("/class", classRouter);
app.use("/subject", subjectRouter);
app.use("/teacher", teacherRouter);
app.use("/student", studentRouter);
app.use("/quiz", quizRouter);
app.use("/question", questionRouter);
app.use("/schedule", scheduleRouter);
app.use("/upload", uploadRouter);
app.use("/answer", answerRouter);
app.use("/log", logRouter);
app.use("/database", dbRouter);

export default app;
