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
        reject(new Error(`服务器错误 (${xhr.status})`));
        return;
      }
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(data.error || `上传失败 (${xhr.status})`));
        return;
      }
      if (!data.url || !data.fileName) {
        reject(new Error("服务器响应格式错误"));
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

    xhr.addEventListener("error", () => reject(new Error("网络错误，上传失败")));
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
        toast({ title: "文件太大", description: `文件大小 ${mb}MB，最大允许 20MB`, variant: "destructive" });
        return null;
      }

      const ext = resolveExtension(file.name);
      if (ext && BLOCKED_EXTENSIONS.has(ext)) {
        toast({ title: "格式不支持", description: "不允许上传可执行文件", variant: "destructive" });
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
        const message = error instanceof Error ? error.message : "文件上传失败，请重试";
        toast({ title: "上传失败", description: message, variant: "destructive" });
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
