import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import {
  useGetSessionMessages,
  getGetSessionMessagesQueryKey,
  useGetSessionUnread,
  useMarkSessionVisitorRead,
  useGetPublicAgent,
  getGetPublicAgentQueryKey,
  getGetSessionUnreadQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useChat, type ChatMessage } from "@/hooks/useChat";
import { useImageUpload } from "@/hooks/useImageUpload";
import { useFileUpload } from "@/hooks/useFileUpload";
import { FileMessageCard } from "@/components/FileMessageCard";
import { FileUploadProgressBar } from "@/components/FileUploadProgressBar";
import {
  getStoredAgentId,
  getStoredAgentAvatarUrl,
  getStoredAgentName,
  readStoredSessionOrNull,
  setStoredAgentProfile,
} from "@/lib/visitor-session";
import { AgentHeaderBar } from "@/components/AgentHeaderBar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Image, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

function MessageBubble({ message, isOwn, agentName }: { message: ChatMessage; isOwn: boolean; agentName: string }) {
  const [showLightbox, setShowLightbox] = useState(false);

  return (
    <>
      <div className={`flex ${isOwn ? "justify-end" : "justify-start"} mb-3`}>
        <div className={`max-w-[75%] ${isOwn ? "items-end" : "items-start"} flex flex-col`}>
          {!isOwn && (
            <span className="text-xs text-muted-foreground mb-1 ml-1 font-medium">{agentName}</span>
          )}
          <div
            className={`rounded-2xl px-4 py-2.5 shadow-sm ${
              isOwn
                ? "bg-primary text-primary-foreground rounded-br-sm"
                : "bg-card border border-border text-foreground rounded-bl-sm"
            }`}
          >
            {message.messageType === "image" && message.imageUrl ? (
              <img
                src={message.imageUrl}
                alt="共享圖片"
                className="max-w-full rounded-lg cursor-pointer max-h-48 object-contain"
                onClick={() => setShowLightbox(true)}
                data-testid={`img-message-${message.id}`}
                onError={(e) => {
                  const el = e.target as HTMLImageElement;
                  el.style.display = "none";
                  el.parentElement!.innerHTML = '<span style="font-size:12px;opacity:0.6">圖片已失效</span>';
                }}
              />
            ) : message.messageType === "file" && message.fileUrl && message.fileName ? (
              <FileMessageCard
                fileUrl={message.fileUrl}
                fileName={message.fileName}
                fileSize={message.fileSize}
                mimeType={message.mimeType}
                inverted={isOwn}
              />
            ) : (
              <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{message.content}</p>
            )}
          </div>
          <div className="flex items-center mt-1 mx-1">
            <span className="text-xs text-muted-foreground">
              {format(new Date(message.createdAt), "HH:mm")}
            </span>
          </div>
        </div>
      </div>

      {showLightbox && message.imageUrl && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setShowLightbox(false)}
        >
          <img src={message.imageUrl} alt="原始圖片" className="max-w-full max-h-full rounded-lg" />
        </div>
      )}
    </>
  );
}

export default function VisitorChat() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const stored = readStoredSessionOrNull();
  const sessionId = stored?.sessionId ?? 0;
  const visitorNickname = stored?.visitorNickname ?? "";
  const visitorId = stored?.visitorId;
  const agentId = stored?.agentId ?? getStoredAgentId() ?? 0;
  const [inputText, setInputText] = useState("");
  const [visitorUnread, setVisitorUnread] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const { uploadImage, isUploading: isUploadingImage } = useImageUpload();
  const { uploadFile, isUploading: isUploadingFile, uploadProgress, cancelUpload, clearUploadProgress } =
    useFileUpload();
  const isUploading = isUploadingImage || isUploadingFile;
  const { toast } = useToast();

  const markVisitorRead = useMarkSessionVisitorRead();

  const { data: publicAgent } = useGetPublicAgent(agentId, {
    query: {
      enabled: agentId > 0,
      queryKey: getGetPublicAgentQueryKey(agentId),
      refetchInterval: 30_000,
    },
  });

  const agentName = publicAgent?.displayName ?? getStoredAgentName();
  const agentAvatarUrl = publicAgent?.avatarUrl ?? getStoredAgentAvatarUrl();
  const [agentIsOnline, setAgentIsOnline] = useState(publicAgent?.isOnline ?? false);

  useEffect(() => {
    if (publicAgent) {
      setStoredAgentProfile(publicAgent.displayName, publicAgent.avatarUrl);
      setAgentIsOnline(publicAgent.isOnline);
    }
  }, [publicAgent]);

  const { data: unreadData } = useGetSessionUnread(
    sessionId,
    { visitorId },
    { query: { enabled: !!sessionId, queryKey: getGetSessionUnreadQueryKey(sessionId, { visitorId }) } },
  );

  useEffect(() => {
    if (unreadData) setVisitorUnread(unreadData.visitorUnread);
  }, [unreadData]);

  const doMarkRead = useCallback(() => {
    if (!sessionId) return;
    markVisitorRead.mutate(
      { id: sessionId, data: { visitorId } },
      {
        onSuccess: (result) => {
          setVisitorUnread(result.visitorUnread);
          queryClient.invalidateQueries({ queryKey: getGetSessionUnreadQueryKey(sessionId, { visitorId }) });
        },
      },
    );
  }, [sessionId, visitorId, markVisitorRead, queryClient]);

  useEffect(() => {
    if (stored) return;
    const agentId = getStoredAgentId();
    if (agentId) {
      setLocation(`/chat/${agentId}`, { replace: true });
    } else {
      setLocation("/", { replace: true });
    }
  }, [stored, setLocation]);

  const messageParams = visitorId ? { visitorId } : undefined;

  const { data: history } = useGetSessionMessages(sessionId, messageParams, {
    query: {
      enabled: !!sessionId,
      queryKey: getGetSessionMessagesQueryKey(sessionId, messageParams),
    },
  });

  const onMessage = useCallback(() => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }, []);

  const onUnreadUpdate = useCallback(
    (data: { sessionId: number; visitorUnread: number }) => {
      if (data.sessionId === sessionId) {
        setVisitorUnread(data.visitorUnread);
      }
    },
    [sessionId],
  );

  const onAgentPresence = useCallback(
    (data: { agentId: number; isOnline: boolean }) => {
      if (data.agentId === agentId) {
        setAgentIsOnline(data.isOnline);
      }
    },
    [agentId],
  );

  const onChatError = useCallback(
    (error: string) => {
      toast({ title: "訊息發送失敗", description: error, variant: "destructive" });
    },
    [toast],
  );

  const { messages, isConnected, sendTextMessage, sendImageMessage, sendFileMessage, addMessages } =
    useChat({ sessionId, visitorNickname, onMessage, onUnreadUpdate, onAgentPresence, onError: onChatError });

  useEffect(() => {
    if (history) {
      addMessages(history as ChatMessage[]);
    }
  }, [history, addMessages]);

  useEffect(() => {
    if (!sessionId) return;
    doMarkRead();
    const onFocus = () => {
      doMarkRead();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [sessionId, doMarkRead]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    const text = inputText.trim();
    if (!text) return;
    sendTextMessage(text);
    setInputText("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleImagePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const url = await uploadImage(file);
    if (url) sendImageMessage(url);
  };

  const handleFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!isConnected) {
      toast({ title: "未連線", description: "請等待連線後再傳送檔案", variant: "destructive" });
      return;
    }
    try {
      const result = await uploadFile(file);
      if (!result) return;
      const sent = sendFileMessage(result);
      if (!sent) {
        toast({ title: "傳送失敗", description: "連線中斷，檔案已上傳但未能送出，請重試", variant: "destructive" });
      }
    } finally {
      // Keep progress visible briefly so fast uploads are still noticeable.
      await new Promise((resolve) => setTimeout(resolve, 500));
      clearUploadProgress();
    }
  };

  const handleBack = () => {
    sessionStorage.clear();
    setLocation("/");
  };

  if (!stored) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      <AgentHeaderBar
        displayName={agentName}
        avatarUrl={agentAvatarUrl}
        isOnline={agentIsOnline}
        visitorNickname={visitorNickname}
        visitorUnread={visitorUnread}
        onBack={handleBack}
      />

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <Send className="w-5 h-5 text-primary" />
              </div>
              <p className="text-sm font-medium text-foreground">開始對話</p>
              <p className="text-xs text-muted-foreground mt-1">{agentName} 將盡快回覆您</p>
            </div>
          </div>
        )}
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            isOwn={msg.senderType === "visitor"}
            agentName={agentName}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="px-4 py-3 bg-card border-t border-border">
        {uploadProgress && (
          <FileUploadProgressBar progress={uploadProgress} onCancel={cancelUpload} />
        )}
        <div className="flex items-end gap-2">
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImagePick}
            data-testid="input-image-file"
          />
          <input
            ref={attachmentInputRef}
            type="file"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar,.7z,.json,.xml"
            className="hidden"
            onChange={handleFilePick}
            data-testid="input-attachment-file"
          />
          <button
            data-testid="button-image-upload"
            onClick={() => imageInputRef.current?.click()}
            disabled={isUploading || !isConnected}
            className="p-2.5 rounded-xl border border-border hover:bg-accent/50 transition-colors text-muted-foreground disabled:opacity-50 shrink-0"
            title="上傳圖片"
            aria-label="上傳圖片"
          >
            <Image className="w-5 h-5" />
          </button>
          <button
            data-testid="button-file-upload"
            onClick={() => attachmentInputRef.current?.click()}
            disabled={isUploading || !isConnected}
            className="p-2.5 rounded-xl border border-border hover:bg-accent/50 transition-colors text-muted-foreground disabled:opacity-50 shrink-0 text-lg leading-none"
            title="上傳檔案"
            aria-label="上傳檔案"
          >
            📎
          </button>
          <Textarea
            data-testid="input-message"
            placeholder="輸入訊息..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 min-h-[44px] max-h-32 resize-none rounded-xl text-sm"
            rows={1}
          />
          <Button
            data-testid="button-send"
            onClick={handleSend}
            disabled={!inputText.trim() || !isConnected}
            className="p-2.5 h-auto rounded-xl"
          >
            <Send className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
