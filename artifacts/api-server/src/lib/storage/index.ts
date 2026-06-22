import type { StorageProvider } from "./StorageProvider";
import { LocalStorageProvider } from "./LocalStorageProvider";

let provider: StorageProvider | null = null;

/** Returns the configured storage provider (LOCAL for P0; MinIO/S3 later). */
export function getStorageProvider(): StorageProvider {
  if (!provider) {
    const kind = process.env.STORAGE_PROVIDER ?? "local";
    switch (kind) {
      case "local":
        provider = new LocalStorageProvider();
        break;
      default:
        throw new Error(`Unsupported STORAGE_PROVIDER: ${kind}. Use 'local' for now.`);
    }
  }
  return provider;
}

export type { StorageProvider, UploadResult } from "./StorageProvider";
