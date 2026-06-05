import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { useGetSessionMessages, getGetSessionMessagesQueryKey } from "@workspace/api-client-react";
import { useChat, type ChatMessage } from "@/hooks/useChat";
import { useImageUpload } from "@/hooks/useImageUpload";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Image, ArrowLeft, Wifi, WifiOff, RefreshCw, Check, CheckCheck } from "lucide-react";
import { format } from "date-fns";

function ReadStatus({ message }: { message: ChatMessage }) {
  if (message.senderType !== "visitor") return null;
  if (message.readAt) {
    return (
      <span className="inline-flex items-center gap-0.5 ml-1" title="已讀">
        <CheckCheck className="w-3.5 h-3.5 text-blue-400" />
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 ml-1" title="已送出">
      <Check className="w-3.5 h-3.5 text-primary-foreground/60" />
    </span>
  );
}

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
              />
            ) : (
              <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{message.content}</p>
            )}
          </div>
          <div className="flex items-center mt-1 mx-1">
            <span className="text-xs text-muted-foreground">
              {format(new Date(message.createdAt), "HH:mm")}
            </span>
            {isOwn && <ReadStatus message={message} />}
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
  const sessionId = Number(sessionStorage.getItem("sessionId") ?? "0");
  const visitorNickname = sessionStorage.getItem("visitorNickname") ?? "";
  const agentName = sessionStorage.getItem("agentName") ?? "客服";
  const [inputText, setInputText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploadImage, isUploading } = useImageUpload();

  useEffect(() => {
    if (!sessionId || !visitorNickname) {
      setLocation("/");
    }
  }, [sessionId, visitorNickname, setLocation]);

  const { data: history } = useGetSessionMessages(sessionId, {
    query: { enabled: !!sessionId, queryKey: getGetSessionMessagesQueryKey(sessionId) },
  });

  const onMessage = useCallback(() => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }, []);

  const { messages, isConnected, isReconnecting, sendTextMessage, sendImageMessage, addMessages } =
    useChat({ sessionId, visitorNickname, onMessage });

  useEffect(() => {
    if (history && history.length > 0) {
      addMessages(history as ChatMessage[]);
    }
  }, [history, addMessages]);

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
    // Reset BEFORE await — Safari recycles the synthetic event after async operations,
    // so resetting after await causes the input to get stuck (same file can't be picked again)
    e.target.value = "";
    if (!file) return;
    const url = await uploadImage(file);
    if (url) sendImageMessage(url);
  };

  const handleBack = () => {
    sessionStorage.clear();
    setLocation("/");
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-card border-b border-border shadow-sm">
        <button
          data-testid="button-back"
          onClick={handleBack}
          className="p-2 rounded-lg hover:bg-accent/50 transition-colors text-muted-foreground"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="font-semibold text-foreground text-sm">{agentName}</h1>
          <div className="flex items-center gap-1.5 mt-0.5">
            {isReconnecting ? (
              <>
                <RefreshCw className="w-3 h-3 text-amber-500 animate-spin" />
                <span className="text-xs text-amber-500">重新連線中...</span>
              </>
            ) : isConnected ? (
              <>
                <Wifi className="w-3 h-3 text-green-500" />
                <span className="text-xs text-green-500">已連線</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3 h-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">未連線</span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 bg-primary/10 rounded-full">
          <div className="w-2 h-2 rounded-full bg-primary" />
          <span className="text-xs font-medium text-primary">{visitorNickname}</span>
        </div>
      </div>

      {/* Messages */}
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

      {/* Input */}
      <div className="px-4 py-3 bg-card border-t border-border">
        <div className="flex items-end gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImagePick}
            data-testid="input-image-file"
          />
          <button
            data-testid="button-image-upload"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading || !isConnected}
            className="p-2.5 rounded-xl border border-border hover:bg-accent/50 transition-colors text-muted-foreground disabled:opacity-50"
          >
            <Image className="w-5 h-5" />
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
