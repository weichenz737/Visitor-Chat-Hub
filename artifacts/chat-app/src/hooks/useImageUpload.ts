import { useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;

const ACCEPTED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/bmp",
]);

function normalizeContentType(file: File): string {
  if (file.type && ACCEPTED_MIME_TYPES.has(file.type)) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const extMap: Record<string, string> = {
    jpg: "image/jpeg", jpeg: "image/jpeg",
    png: "image/png", gif: "image/gif",
    webp: "image/webp", heic: "image/heic",
    heif: "image/heif", bmp: "image/bmp",
  };
  return extMap[ext] ?? "image/jpeg";
}

export function useImageUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  const uploadImage = useCallback(
    async (file: File): Promise<string | null> => {
      if (file.size > MAX_FILE_SIZE_BYTES) {
        const mb = (file.size / 1024 / 1024).toFixed(1);
        toast({ title: "圖片太大", description: `檔案大小 ${mb}MB，最大允許 20MB`, variant: "destructive" });
        return null;
      }

      const contentType = normalizeContentType(file);

      if (!ACCEPTED_MIME_TYPES.has(contentType)) {
        toast({ title: "格式不支援", description: `請使用 JPG、PNG、WebP 或 GIF`, variant: "destructive" });
        return null;
      }

      setIsUploading(true);
      try {
        // Step 1: Request a presigned upload URL from our API
        const metaRes = await fetch("/api/storage/uploads/request-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: file.name || "photo.jpg", size: file.size, contentType }),
        });

        let metaData: { uploadURL?: string; objectPath?: string; error?: string } = {};
        try { metaData = await metaRes.json(); } catch { throw new Error(`伺服器錯誤 (${metaRes.status})`); }
        if (!metaRes.ok) throw new Error(metaData.error || `無法取得上傳URL (${metaRes.status})`);
        if (!metaData.uploadURL || !metaData.objectPath) throw new Error("伺服器回應格式錯誤");

        // Step 2: Upload directly to GCS via presigned URL (no Authorization header)
        const uploadRes = await fetch(metaData.uploadURL, {
          method: "PUT",
          headers: { "Content-Type": contentType },
          body: file,
        });
        if (!uploadRes.ok) throw new Error(`上傳失敗 (${uploadRes.status})`);

        // Return serving URL: /api/storage + objectPath
        return `/api/storage${metaData.objectPath}`;
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "圖片上傳失敗，請重試";
        toast({ title: "上傳失敗", description: message, variant: "destructive" });
        return null;
      } finally {
        setIsUploading(false);
      }
    },
    [toast]
  );

  return { uploadImage, isUploading };
}
