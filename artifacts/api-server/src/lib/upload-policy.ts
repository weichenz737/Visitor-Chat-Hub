const BLOCKED_EXTENSIONS = new Set([
  ".exe",
  ".bat",
  ".cmd",
  ".com",
  ".msi",
  ".scr",
  ".ps1",
  ".sh",
  ".dll",
  ".jar",
  ".vbs",
  ".reg",
  ".hta",
]);

const ALLOWED_MIME_PREFIXES = ["image/"];

const ALLOWED_FILE_MIMES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
  "application/zip",
  "application/x-zip-compressed",
  "application/x-rar-compressed",
  "application/vnd.rar",
  "application/x-7z-compressed",
  "application/json",
  "application/xml",
  "text/xml",
]);

const EXT_TO_MIME: Record<string, string> = {
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".txt": "text/plain",
  ".csv": "text/csv",
  ".zip": "application/zip",
  ".rar": "application/vnd.rar",
  ".7z": "application/x-7z-compressed",
  ".json": "application/json",
  ".xml": "application/xml",
};

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

export function resolveExtension(fileName: string): string {
  const idx = fileName.lastIndexOf(".");
  return idx >= 0 ? fileName.slice(idx).toLowerCase() : "";
}

export function resolveMimeType(fileName: string, mimeType: string): string {
  const normalized = mimeType?.trim().toLowerCase() ?? "";
  if (normalized && (ALLOWED_FILE_MIMES.has(normalized) || ALLOWED_MIME_PREFIXES.some((p) => normalized.startsWith(p)))) {
    return normalized;
  }
  return EXT_TO_MIME[resolveExtension(fileName)] ?? "";
}

export function isBlockedUpload(fileName: string, mimeType: string): boolean {
  const ext = resolveExtension(fileName);
  if (ext && BLOCKED_EXTENSIONS.has(ext)) return true;
  const resolved = resolveMimeType(fileName, mimeType);
  if (!resolved) return true;
  if (resolved.startsWith("image/")) return false;
  return !ALLOWED_FILE_MIMES.has(resolved);
}
