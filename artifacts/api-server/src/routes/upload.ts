import { Router, type IRouter } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { logger } from "../lib/logger";
import { getStorageProvider } from "../lib/storage";
import { isBlockedUpload, MAX_UPLOAD_BYTES, resolveMimeType } from "../lib/upload-policy";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const legacyUploadsDir = path.resolve(__dirname, "../uploads");

if (!fs.existsSync(legacyUploadsDir)) {
  fs.mkdirSync(legacyUploadsDir, { recursive: true });
}

const IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/bmp",
]);

const EXT_TO_IMAGE_MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".heic": "image/heic",
  ".heif": "image/heif",
  ".bmp": "image/bmp",
};

function resolvedImageMime(file: Express.Multer.File): string {
  if (file.mimetype && IMAGE_MIME_TYPES.has(file.mimetype)) return file.mimetype;
  const ext = path.extname(file.originalname).toLowerCase();
  return EXT_TO_IMAGE_MIME[ext] ?? "";
}

function safeImageExtension(file: Express.Multer.File): string {
  const mime = resolvedImageMime(file);
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
  return mimeToExt[mime] || path.extname(file.originalname).toLowerCase() || ".jpg";
}

const legacyImageStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, legacyUploadsDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, `img-${uniqueSuffix}${safeImageExtension(file)}`);
  },
});

const legacyImageUpload = multer({
  storage: legacyImageStorage,
  limits: { fileSize: MAX_UPLOAD_BYTES },
  fileFilter: (_req, file, cb) => {
    if (resolvedImageMime(file)) {
      cb(null, true);
    } else {
      cb(new Error("不支援的圖片格式。請使用 JPG、PNG、WebP 或 GIF"));
    }
  },
});

const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES },
});

const router: IRouter = Router();

router.post("/upload/image", (req, res): void => {
  legacyImageUpload.single("file")(req, res, (err) => {
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

router.post("/upload/file", (req, res): void => {
  memoryUpload.single("file")(req, res, async (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          res.status(400).json({ error: "文件太大，最大允许 20MB" });
        } else {
          res.status(400).json({ error: `上传错误：${err.message}` });
        }
        return;
      }
      res.status(400).json({ error: err.message || "文件上传失败" });
      return;
    }

    const file = req.file;
    if (!file) {
      res.status(400).json({ error: "未收到文件" });
      return;
    }

    const originalName = file.originalname || "file";
    const mimeType = resolveMimeType(originalName, file.mimetype);
    if (isBlockedUpload(originalName, mimeType)) {
      res.status(400).json({ error: "不支持该文件类型" });
      return;
    }

    try {
      const storage = getStorageProvider();
      const withMime = { ...file, mimetype: mimeType || file.mimetype };
      const result = await storage.uploadFile(withMime);
      res.json({
        url: result.url,
        fileName: result.fileName,
        fileSize: result.fileSize,
        mimeType: result.mimeType,
        storageKey: result.storageKey,
      });
    } catch (uploadErr) {
      logger.error({ err: uploadErr }, "File upload failed");
      res.status(500).json({ error: "文件上传失败" });
    }
  });
});

export default router;
