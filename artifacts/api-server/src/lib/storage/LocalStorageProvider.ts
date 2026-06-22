import path from "path";
import fs from "fs";
import type { StorageProvider, UploadResult } from "./StorageProvider";
import { UPLOADS_DIR } from "../uploads-dir";

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function buildResult(subdir: "images" | "files", file: Express.Multer.File, storedName: string): UploadResult {
  const storageKey = `${subdir}/${storedName}`;
  return {
    url: `/uploads/${storageKey}`,
    fileName: file.originalname,
    fileSize: file.size,
    mimeType: file.mimetype,
    storageKey,
  };
}

export class LocalStorageProvider implements StorageProvider {
  readonly kind = "local";

  constructor() {
    ensureDir(path.join(UPLOADS_DIR, "images"));
    ensureDir(path.join(UPLOADS_DIR, "files"));
  }

  async uploadImage(file: Express.Multer.File): Promise<UploadResult> {
    const dir = path.join(UPLOADS_DIR, "images");
    const storedName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname) || ".jpg"}`;
    const dest = path.join(dir, storedName);
    await fs.promises.writeFile(dest, file.buffer);
    return buildResult("images", file, storedName);
  }

  async uploadFile(file: Express.Multer.File): Promise<UploadResult> {
    const dir = path.join(UPLOADS_DIR, "files");
    const storedName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
    const dest = path.join(dir, storedName);
    await fs.promises.writeFile(dest, file.buffer);
    return buildResult("files", file, storedName);
  }

  resolvePublicUrl(storageKey: string): string {
    return `/uploads/${storageKey}`;
  }
}
