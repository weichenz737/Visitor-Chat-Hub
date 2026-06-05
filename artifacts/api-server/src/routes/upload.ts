import { Router, type IRouter } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { logger } from "../lib/logger";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.resolve(__dirname, "../uploads");

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Allowed MIME types — includes iOS HEIC/HEIF and common variants
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",   // non-standard but sent by some browsers
  "image/png",
  "image/gif",
  "image/webp",
  "image/heic",  // iOS default camera format
  "image/heif",  // iOS HEIF variant
  "image/bmp",
]);

// Map MIME type → safe extension (some iOS files arrive with wrong/missing extension)
function safeExtension(file: Express.Multer.File): string {
  const mimeToExt: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "image/heic": ".heic",
    "image/heif": ".heif",
    "image/bmp": ".bmp",
  };
  const fromMime = mimeToExt[file.mimetype];
  if (fromMime) return fromMime;
  // Fall back to original extension if present
  const orig = path.extname(file.originalname).toLowerCase();
  return orig || ".jpg";
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = safeExtension(file);
    cb(null, `img-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // raised to 20MB for high-res phone photos
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`不支援的圖片格式：${file.mimetype}。請使用 JPG、PNG、WebP 或 GIF`));
    }
  },
});

const router: IRouter = Router();

router.post("/upload/image", (req, res): void => {
  // Wrap multer in a callback to catch its errors and return proper JSON
  upload.single("file")(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          res.status(400).json({ error: "圖片太大，最大允許 20MB" });
        } else {
          res.status(400).json({ error: `上傳錯誤：${err.message}` });
        }
        return;
      }
      // fileFilter rejection or other error
      res.status(400).json({ error: err.message || "圖片上傳失敗" });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: "未收到檔案" });
      return;
    }

    const filename = req.file.filename;
    const url = `/uploads/${filename}`;
    logger.info({ filename, mimetype: req.file.mimetype }, "Image uploaded");
    res.json({ url, filename });
  });
});

export default router;
