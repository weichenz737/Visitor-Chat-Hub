import path from "path";
import { fileURLToPath } from "url";

/** api-server package root (parent of `src/` or `dist/`). */
const apiServerRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const UPLOADS_DIR = path.join(apiServerRoot, "uploads");
