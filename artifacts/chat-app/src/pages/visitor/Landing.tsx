import { useState } from "react";
import { useLocation } from "wouter";
import { useCreateSession } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageCircle, ArrowRight } from "lucide-react";

export default function VisitorLanding() {
  const [nickname, setNickname] = useState("");
  const [, setLocation] = useLocation();
  const createSession = useCreateSession();

  const existingSessionId = sessionStorage.getItem("sessionId");
  const existingNickname = sessionStorage.getItem("visitorNickname");

  const handleStart = async () => {
    const name = nickname.trim();
    if (!name) return;

    createSession.mutate(
      { data: { visitorNickname: name } },
      {
        onSuccess: (session) => {
          sessionStorage.setItem("sessionId", String(session.id));
          sessionStorage.setItem("visitorNickname", name);
          setLocation("/chat");
        },
      }
    );
  };

  const handleResume = () => {
    setLocation("/chat");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleStart();
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary mb-6">
            <MessageCircle className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Customer Support</h1>
          <p className="mt-3 text-muted-foreground text-base">
            We are here to help. Start a conversation with our team.
          </p>
        </div>

        {existingSessionId && existingNickname && (
          <div
            className="mb-6 p-4 rounded-xl border border-border bg-card cursor-pointer hover:bg-accent/40 transition-colors"
            onClick={handleResume}
            data-testid="resume-session-card"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Continue previous chat</p>
                <p className="text-sm text-muted-foreground mt-0.5">as {existingNickname}</p>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
            </div>
          </div>
        )}

        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-foreground mb-4 uppercase tracking-wider">
            {existingSessionId ? "Start new chat" : "Start a chat"}
          </h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="nickname" className="block text-sm font-medium text-foreground mb-2">
                Your name
              </label>
              <Input
                id="nickname"
                data-testid="input-nickname"
                placeholder="Enter your name..."
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                onKeyDown={handleKeyDown}
                autoFocus
                className="h-11"
              />
            </div>
            <Button
              data-testid="button-start-chat"
              className="w-full h-11 font-semibold"
              onClick={handleStart}
              disabled={!nickname.trim() || createSession.isPending}
            >
              {createSession.isPending ? "Starting..." : "Start Chat"}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          By chatting, you agree to our terms of service.
        </p>
      </div>
    </div>
  );
}
