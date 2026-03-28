"use client";

import { useEffect, useState } from "react";
import { MessageCircle, Send, Sparkles, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type AgentSiteChatWidgetProps = {
  agentSlug: string;
  agentName: string;
  accentClassName: string;
};

export function AgentSiteChatWidget({
  agentSlug,
  agentName,
  accentClassName,
}: AgentSiteChatWidgetProps) {
  const sendMutation = trpc.profile.sendChatMessage.useMutation();
  const captureMutation = trpc.profile.captureChatLead.useMutation();
  const storageKey = `kevv-agent-chat:${agentSlug}`;
  const [open, setOpen] = useState(false);
  const [sessionKey, setSessionKey] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      return window.sessionStorage.getItem(storageKey);
    } catch {
      return null;
    }
  });
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([
    "What is your market like right now?",
    "Can you help me with seller strategy?",
    "Show me relevant listings",
  ]);
  const [leadFormVisible, setLeadFormVisible] = useState(false);
  const [leadForm, setLeadForm] = useState({
    name: "",
    email: "",
    phone: "",
    notes: "",
  });

  useEffect(() => {
    if (!sessionKey) return;
    try {
      window.sessionStorage.setItem(storageKey, sessionKey);
    } catch {}
  }, [sessionKey, storageKey]);

  const sendMessage = async (message: string) => {
    if (!message.trim() || sendMutation.isPending) return;

    const trimmed = message.trim();
    setMessages((current) => [...current, { role: "user", content: trimmed }]);
    setInput("");

    try {
      const result = await sendMutation.mutateAsync({
        slug: agentSlug,
        sessionKey: sessionKey ?? undefined,
        message: trimmed,
      });

      setSessionKey(result.sessionKey);
      setSuggestions(result.suggestedPrompts);
      setMessages((current) => [...current, { role: "assistant", content: result.response }]);

      if (messages.filter((item) => item.role === "user").length >= 1) {
        setLeadFormVisible(true);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Chat failed.");
    }
  };

  const submitLead = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      await captureMutation.mutateAsync({
        slug: agentSlug,
        sessionKey: sessionKey ?? undefined,
        ...leadForm,
      });
      toast.success(`${agentName.split(" ")[0]} received your info.`);
      setLeadFormVisible(false);
      setLeadForm({ name: "", email: "", phone: "", notes: "" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to share contact info.");
    }
  };

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3">
      {open ? (
        <div className="w-[360px] max-w-[calc(100vw-24px)] overflow-hidden rounded-[28px] border border-white/20 bg-neutral-950 text-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <div>
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.28em] text-white/50">
                <Sparkles className="h-3.5 w-3.5" />
                AI concierge
              </div>
              <div className="mt-1 text-base font-semibold">{agentName}</div>
            </div>
            <Button size="icon" variant="ghost" onClick={() => setOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <ScrollArea className="h-[360px] px-5 py-4">
            {messages.length === 0 ? (
              <div className="space-y-3 text-sm text-white/75">
                <p>
                  Ask about market timing, seller strategy, neighborhood fit, or live listings.
                </p>
                <div className="flex flex-wrap gap-2">
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      className="rounded-full border border-white/15 px-3 py-1.5 text-left text-xs text-white/80 transition hover:border-white/30 hover:bg-white/10"
                      onClick={() => void sendMessage(suggestion)}
                      type="button"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map((message, index) => (
                  <div
                    key={`${message.role}-${index}`}
                    className={message.role === "user" ? "flex justify-end" : "flex justify-start"}
                  >
                    <div
                      className={
                        message.role === "user"
                          ? "max-w-[85%] rounded-2xl rounded-br-md bg-white px-4 py-3 text-sm text-neutral-900"
                          : "max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-bl-md bg-white/10 px-4 py-3 text-sm text-white"
                      }
                    >
                      {message.content}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {leadFormVisible ? (
            <form className="border-t border-white/10 px-5 py-4" onSubmit={submitLead}>
              <div className="mb-3 text-xs uppercase tracking-[0.28em] text-white/45">
                Send your info to {agentName.split(" ")[0]}
              </div>
              <div className="space-y-2">
                <Input
                  required
                  placeholder="Name"
                  value={leadForm.name}
                  onChange={(event) =>
                    setLeadForm((current) => ({ ...current, name: event.target.value }))
                  }
                />
                <Input
                  type="email"
                  placeholder="Email"
                  value={leadForm.email}
                  onChange={(event) =>
                    setLeadForm((current) => ({ ...current, email: event.target.value }))
                  }
                />
                <Input
                  placeholder="Phone"
                  value={leadForm.phone}
                  onChange={(event) =>
                    setLeadForm((current) => ({ ...current, phone: event.target.value }))
                  }
                />
                <Textarea
                  rows={3}
                  placeholder="Anything you want the agent to know?"
                  value={leadForm.notes}
                  onChange={(event) =>
                    setLeadForm((current) => ({ ...current, notes: event.target.value }))
                  }
                />
                <Button
                  className={`w-full ${accentClassName}`}
                  disabled={captureMutation.isPending}
                  type="submit"
                >
                  {captureMutation.isPending ? "Sending..." : "Share my contact info"}
                </Button>
              </div>
            </form>
          ) : null}

          <div className="border-t border-white/10 px-5 py-4">
            <div className="flex gap-2">
              <Textarea
                className="min-h-[44px] border-white/10 bg-white/5 text-white placeholder:text-white/35"
                placeholder="Ask about strategy, listings, or market timing..."
                rows={2}
                value={input}
                onChange={(event) => setInput(event.target.value)}
              />
              <Button
                className={accentClassName}
                disabled={sendMutation.isPending}
                onClick={() => void sendMessage(input)}
                size="icon"
                type="button"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <Button
        className={`h-14 rounded-full px-5 shadow-xl ${accentClassName}`}
        onClick={() => setOpen((current) => !current)}
      >
        <MessageCircle className="mr-1 h-4 w-4" />
        Ask {agentName.split(" ")[0]}
      </Button>
    </div>
  );
}
