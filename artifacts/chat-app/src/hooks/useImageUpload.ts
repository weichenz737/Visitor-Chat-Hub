import { useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20MB — matches backend limit

// MIME types the backend accepts (includes iOS HEIC/HEIF)
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

export function useImageUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  const uploadImage = useCallback(
    async (file: File): Promise<string | null> => {
      // ── Client-side pre-checks (fast, no network needed) ──────────────────

      if (file.size > MAX_FILE_SIZE_BYTES) {
        const mb = (file.size / 1024 / 1024).toFixed(1);
        toast({
          title: "圖片太大",
          description: `檔案大小 ${mb}MB，最大允許 20MB`,
          variant: "destructive",
        });
        return null;
      }

      // Accept empty MIME type — some Android/iOS browsers don't set it correctly;
      // let the backend decide in that case.
      if (file.type && !ACCEPTED_MIME_TYPES.has(file.type)) {
        toast({
          title: "格式不支援",
          description: `${file.type || "未知格式"} 不被支援，請使用 JPG、PNG、WebP 或 GIF`,
          variant: "destructive",
        });
        return null;
      }

      // ── Upload ────────────────────────────────────────────────────────────

      setIsUploading(true);
      try {
        const formData = new FormData();
        // Append with explicit filename so iOS doesn't send "blob" as the name
        formData.append("file", file, file.name || "photo.jpg");

        const res = await fetch("/api/upload/image", {
          method: "POST",
          body: formData,
          // Do NOT set Content-Type — browser must set it with the multipart boundary
        });

        let responseData: { url?: string; error?: string } = {};
        try {
          responseData = await res.json();
        } catch {
          // Backend returned non-JSON (should not happen after the fix, but guard anyway)
          throw new Error(`伺服器錯誤 (${res.status})`);
        }

        if (!res.ok) {
          throw new Error(responseData.error || `上傳失敗 (${res.status})`);
        }

        return responseData.url ?? null;
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "圖片上傳失敗，請重試";
        toast({
          title: "上傳失敗",
          description: message,
          variant: "destructive",
        });
        return null;
      } finally {
        setIsUploading(false);
      }
    },
    [toast]
  );

  return { uploadImage, isUploading };
}
