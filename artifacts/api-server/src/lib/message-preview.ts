export function formatMessagePreview(
  messageType: string,
  content: string,
  options?: { fileName?: string | null; imageUrl?: string | null },
): string {
  if (messageType === "image" || options?.imageUrl) return "📷 圖片";
  if (messageType === "file") {
    const name = options?.fileName?.trim();
    return name ? `📎 ${name}` : "📎 文件";
  }
  return content;
}
