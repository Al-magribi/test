import express from "express";
import multer from "multer";
import path from "path";

const router = express.Router();

const imageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "./upload/images");
  },

  filename: function (req, file, cb) {
    cb(
      null,
      path.parse(file.originalname).name +
        "-" +
        Date.now() +
        path.extname(file.originalname)
    );
  },
});

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

const uploadImage = multer({ storage: imageStorage });
const uploadAudio = multer({ storage: audioStorage });

router.post("/images", uploadImage.single("file"), (req, res) => {
  try {
    const imageLink =
      process.env.SERVER_2 + "/upload/images/" + req.file.filename;

    res.status(200).json({ location: imageLink });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error });
  }
});

router.post("/audios", uploadAudio.single("file"), (req, res) => {
  try {
    const audioLink =
      process.env.SERVER_2 + "/upload/audios/" + req.file.filename;

    res.status(200).json({ url: audioLink });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error });
  }
});

export default router;
