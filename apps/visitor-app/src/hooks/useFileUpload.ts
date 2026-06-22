import { useState, useCallback, useRef } from "react";
import { useToast } from "@/hooks/use-toast";

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;

const BLOCKED_EXTENSIONS = new Set([
  ".exe", ".bat", ".cmd", ".com", ".msi", ".scr", ".ps1", ".sh", ".dll", ".jar", ".vbs", ".reg", ".hta",
]);

export interface FileUploadResult {
  fileUrl: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

export interface FileUploadProgress {
  fileName: string;
  progress: number;
  status: "uploading" | "sending";
}

function resolveExtension(fileName: string): string {
  const idx = fileName.lastIndexOf(".");
  return idx >= 0 ? fileName.slice(idx).toLowerCase() : "";
}

function uploadViaXhr(
  file: File,
  onProgress: (percent: number) => void,
  registerXhr: (xhr: XMLHttpRequest) => void,
): Promise<FileUploadResult> {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append("file", file);
    const xhr = new XMLHttpRequest();
    registerXhr(xhr);

    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable && event.total > 0) {
        onProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)));
      }
    });

    xhr.addEventListener("load", () => {
      let data: FileUploadResult & { error?: string } = {} as FileUploadResult;
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        reject(new Error(`伺服器錯誤 (${xhr.status})`));
        return;
      }
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(data.error || `上傳失敗 (${xhr.status})`));
        return;
      }
      if (!data.url || !data.fileName) {
        reject(new Error("伺服器回應格式錯誤"));
        return;
      }
      onProgress(100);
      resolve({
        fileUrl: data.url,
        fileName: data.fileName,
        fileSize: data.fileSize ?? file.size,
        mimeType: data.mimeType ?? file.type ?? "application/octet-stream",
      });
    });

    xhr.addEventListener("error", () => reject(new Error("網路錯誤，上傳失敗")));
    xhr.addEventListener("abort", () => {
      const err = new Error("已取消");
      err.name = "AbortError";
      reject(err);
    });

    xhr.open("POST", "/api/upload/file");
    xhr.send(formData);
  });
}

export function useFileUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<FileUploadProgress | null>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const { toast } = useToast();

  const clearUploadProgress = useCallback(() => {
    setUploadProgress(null);
  }, []);

  const cancelUpload = useCallback(() => {
    xhrRef.current?.abort();
    xhrRef.current = null;
    setUploadProgress(null);
    setIsUploading(false);
  }, []);

  const uploadFile = useCallback(
    async (file: File): Promise<FileUploadResult | null> => {
      if (file.size > MAX_FILE_SIZE_BYTES) {
        const mb = (file.size / 1024 / 1024).toFixed(1);
        toast({ title: "檔案太大", description: `檔案大小 ${mb}MB，最大允許 20MB`, variant: "destructive" });
        return null;
      }

      const ext = resolveExtension(file.name);
      if (ext && BLOCKED_EXTENSIONS.has(ext)) {
        toast({ title: "格式不支援", description: "不允許上傳可執行檔", variant: "destructive" });
        return null;
      }

      setIsUploading(true);
      setUploadProgress({ fileName: file.name, progress: 0, status: "uploading" });

      try {
        const result = await uploadViaXhr(
          file,
          (percent) => setUploadProgress({ fileName: file.name, progress: percent, status: "uploading" }),
          (xhr) => {
            xhrRef.current = xhr;
          },
        );
        setUploadProgress({ fileName: file.name, progress: 100, status: "sending" });
        return result;
      } catch (error: unknown) {
        setUploadProgress(null);
        if (error instanceof Error && error.name === "AbortError") return null;
        const message = error instanceof Error ? error.message : "檔案上傳失敗，請重試";
        toast({ title: "上傳失敗", description: message, variant: "destructive" });
        return null;
      } finally {
        xhrRef.current = null;
        setIsUploading(false);
      }
    },
    [toast],
  );

  return { uploadFile, isUploading, uploadProgress, cancelUpload, clearUploadProgress };
}
