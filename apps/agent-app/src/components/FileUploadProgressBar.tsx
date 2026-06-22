import { Progress } from "@/components/ui/progress";
import type { FileUploadProgress } from "@/hooks/useFileUpload";
import { X } from "lucide-react";

interface FileUploadProgressBarProps {
  progress: FileUploadProgress;
  onCancel: () => void;
}

export function FileUploadProgressBar({ progress, onCancel }: FileUploadProgressBarProps) {
  const statusText =
    progress.status === "sending"
      ? "正在发送..."
      : progress.progress > 0
        ? `上传中 ${progress.progress}%`
        : "准备上传...";

  return (
    <div
      className="mb-2 rounded-xl border border-border bg-muted/40 px-3 py-2.5"
      data-testid="file-upload-progress"
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm truncate flex-1 min-w-0" title={progress.fileName}>
          📎 {progress.fileName}
        </span>
        {progress.status === "uploading" && (
          <button
            type="button"
            onClick={onCancel}
            className="flex-shrink-0 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors"
            aria-label="取消上传"
            data-testid="button-cancel-file-upload"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      <Progress value={progress.status === "sending" ? 100 : progress.progress} className="h-1.5" />
      <p className="text-xs text-muted-foreground mt-1.5">{statusText}</p>
    </div>
  );
}
