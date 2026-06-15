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

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/bmp",
]);

// Extension → MIME fallback for browsers that send empty MIME (WeChat, some Android)
const EXT_TO_MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".heic": "image/heic",
  ".heif": "image/heif",
  ".bmp": "image/bmp",
};

function resolvedMime(file: Express.Multer.File): string {
  if (file.mimetype && ALLOWED_MIME_TYPES.has(file.mimetype)) return file.mimetype;
  // Empty or unknown MIME — try falling back to file extension
  const ext = path.extname(file.originalname).toLowerCase();
  return EXT_TO_MIME[ext] ?? "";
}

function safeExtension(file: Express.Multer.File): string {
  const mime = resolvedMime(file);
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
  const fromMime = mimeToExt[mime];
  if (fromMime) return fromMime;
  const orig = path.extname(file.originalname).toLowerCase();
  return orig || ".jpg";
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => { cb(null, uploadsDir); },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = safeExtension(file);
    cb(null, `img-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const mime = resolvedMime(file);
    if (mime) {
      cb(null, true);
    } else {
      logger.warn({ originalname: file.originalname, mimetype: file.mimetype }, "Rejected upload: unresolvable MIME type");
      cb(new Error(`不支援的圖片格式。請使用 JPG、PNG、WebP 或 GIF`));
    }
  },
});

const router: IRouter = Router();

// Legacy multipart endpoint — kept for backward compat with old local-disk uploads.
// New uploads should use POST /api/storage/uploads/request-url (presigned GCS).
router.post("/upload/image", (req, res): void => {
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
      res.status(400).json({ error: err.message || "圖片上傳失敗" });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: "未收到檔案" });
      return;
    }

    const filename = req.file.filename;
    const url = `/uploads/${filename}`;
    logger.info({ filename, mimetype: req.file.mimetype }, "Image uploaded (legacy local storage)");
    res.json({ url, filename });
  });
});

export default router;
