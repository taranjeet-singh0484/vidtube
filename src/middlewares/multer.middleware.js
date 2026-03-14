import fs from "fs";
import path from "path";
import multer from "multer";

const tempDir = path.join(process.cwd(), "public", "temp");

// Ensure folder exists at runtime
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

const fileFilter = (req,file,cb) => {
if(file.filename === "video")
{
  if(file.mimetype.startsWith("video/"))
  {
    cb(null, true); 
  }
  else
  {
    cb(new Error("Only video files are allowed for video upload"), false); 
  }
}

if(file.filename === "thumbnail")
{
  if(file.mimetype.startsWith("image/"))
  {
    cb(null, true); 
  }
  else
  {
    cb(new Error("Only image files are allowed for thumbnail upload"), false); 
  }
}
}; 

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, tempDir);
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  },
});

export const upload = multer({ storage });
