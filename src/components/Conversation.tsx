"use client";
import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { Badge, Banner, Button, Textarea, cx, useToast, when } from "./ui";
import { api, ApiFailure } from "@/lib/client";

export type Msg = { id: string; from: "USER" | "ADMIN"; body: string; createdAt: string };
export const STATUS_LABEL = { OPEN: "Open", WAITING_USER: "Waiting for User", CLOSED: "Closed" } as const;
export const STATUS_TONE = { OPEN: "accent", WAITING_USER: "warn", CLOSED: "neutral" } as const;

export function Thread({ messages, viewer }: { messages: Msg[]; viewer: "USER" | "ADMIN" }) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: "nearest" }); }, [messages.length]);
  return (
    <ul className="space-y-4" aria-label="Conversation">
      {messages.map((m) => {
        const mine = m.from === viewer;
        return (
          <li key={m.id} className={cx("flex flex-col", mine ? "items-end" : "items-start")}>
            <div className={cx("max-w-[88%] whitespace-pre-wrap break-words rounded-3xl px-5 py-3 sm:max-w-[75%]", mine ? "rounded-br-lg bg-primary text-primary-fg" : "rounded-bl-lg bg-surface2")}>{m.body}</div>
            <span className="mt-1 px-2 text-xs text-muted">{m.from === "ADMIN" ? "Ebookvox Support" : viewer === "ADMIN" ? "Customer" : "You"} · {when(m.createdAt)}</span>
          </li>
        );
      })}
      <div ref={end} />
    </ul>
  );
}

export function Composer({ url, closed, onSent, placeholder = "Write your reply…" }: { url: string; closed: boolean; onSent: () => void; placeholder?: string }) {
  const toast = useToast();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  if (closed) return <Banner>This ticket is closed, so replies are turned off. If you still need help, please open a new ticket.</Banner>;
  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    try {
      await api(url, { method: "POST", json: { message: text } });
      setText("");
      onSent();
    } catch (err) {
      toast((err as ApiFailure).message, "error");
    }
    setBusy(false);
  }
  return (
    <form onSubmit={send} className="space-y-3">
      <Textarea label="Reply" id="reply" rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} />
      <Button type="submit" loading={busy} disabled={!text.trim()}><Send className="size-4" /> Send reply</Button>
    </form>
  );
}
export { Badge };
