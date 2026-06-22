import { FileText, Download } from "lucide-react";

function formatFileSize(bytes?: number | null): string {
  if (bytes == null || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

interface FileMessageCardProps {
  fileUrl: string;
  fileName: string;
  fileSize?: number | null;
  mimeType?: string | null;
  inverted?: boolean;
}

export function FileMessageCard({ fileUrl, fileName, fileSize, inverted }: FileMessageCardProps) {
  const sizeLabel = formatFileSize(fileSize);

  return (
    <a
      href={fileUrl}
      download={fileName}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex items-center gap-3 rounded-lg px-3 py-2 min-w-[180px] max-w-full transition-opacity hover:opacity-90 ${
        inverted ? "bg-primary-foreground/10 text-primary-foreground" : "bg-muted/60 text-foreground"
      }`}
    >
      <div
        className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${
          inverted ? "bg-primary-foreground/15" : "bg-background"
        }`}
      >
        <FileText className="w-4 h-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{fileName}</p>
        {sizeLabel && <p className="text-xs opacity-70">{sizeLabel}</p>}
      </div>
      <Download className="w-4 h-4 flex-shrink-0 opacity-70" />
    </a>
  );
}
