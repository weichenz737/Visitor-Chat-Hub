import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import QRCode from "qrcode";

interface AgentChatQrModalProps {
  open: boolean;
  chatUrl: string;
  onClose: () => void;
}

export function AgentChatQrModal({ open, chatUrl, onClose }: AgentChatQrModalProps) {
  const [mounted, setMounted] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrError, setQrError] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !chatUrl) {
      setQrDataUrl(null);
      setQrError(false);
      return;
    }

    let cancelled = false;
    setQrDataUrl(null);
    setQrError(false);

    QRCode.toDataURL(chatUrl, {
      width: 192,
      margin: 1,
      color: { dark: "#000000", light: "#ffffff" },
    })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrError(true);
      });

    return () => {
      cancelled = true;
    };
  }, [open, chatUrl]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 grid place-items-center p-4"
      style={{ zIndex: 2147483000 }}
      role="presentation"
    >
      <button
        type="button"
        aria-label="关闭"
        className="absolute inset-0 bg-black/80"
        style={{ zIndex: 0 }}
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="agent-chat-qr-title"
        className="relative w-full max-w-xs rounded-lg border border-neutral-200 bg-white p-6 text-neutral-900 shadow-2xl"
        style={{ zIndex: 1 }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-sm p-1 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
        >
          <X className="h-4 w-4" />
        </button>

        <h2 id="agent-chat-qr-title" className="pr-8 text-lg font-semibold text-neutral-900">
          专属二维码
        </h2>

        <div className="mt-4 flex flex-col items-center gap-3">
          <div className="flex h-[208px] w-[208px] items-center justify-center rounded-lg border border-neutral-200 bg-white p-2">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="专属客服链接二维码"
                width={192}
                height={192}
                className="block h-[192px] w-[192px]"
              />
            ) : qrError ? (
              <span className="px-3 text-center text-xs text-red-600">二维码生成失败</span>
            ) : (
              <span className="text-xs text-neutral-500">生成中…</span>
            )}
          </div>
          <p className="break-all text-center text-xs text-neutral-600">{chatUrl}</p>
          <p className="text-center text-xs text-neutral-500">扫码后将进入与您的专属会话</p>
        </div>
      </div>
    </div>,
    document.body,
  );
}
