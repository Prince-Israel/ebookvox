"use client";
import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { Banner, Button, Textarea, cx, useToast, when } from "./ui";
import { api, ApiFailure } from "@/lib/client";
import { AttachPhotos, MessagePhotos, type Attachment } from "./Attach";

export type Msg = { id: string; from: "PUBLISHER" | "ADMIN"; body: string; createdAt: string; attachments?: Attachment[] };
export const STATUS_LABEL = { OPEN: "Open", WAITING_PUBLISHER: "Waiting for Publisher", WAITING_ADMIN: "Waiting for Admin", CLOSED: "Closed" } as const;
export const STATUS_TONE = { OPEN: "accent", WAITING_PUBLISHER: "warn", WAITING_ADMIN: "accent", CLOSED: "neutral" } as const;

export function Thread({ messages, viewer }: { messages: Msg[]; viewer: "PUBLISHER" | "ADMIN" }) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: "nearest" }); }, [messages.length]);
  return (
    <ul className="space-y-4" aria-label="Conversation">
      {messages.map((m) => {
        const mine = m.from === viewer;
        return (
          <li key={m.id} className={cx("flex flex-col", mine ? "items-end" : "items-start")}>
            <div className={cx("max-w-[88%] break-words rounded-3xl px-4 py-3 sm:max-w-[75%] sm:px-5", mine ? "rounded-br-lg bg-primary text-primary-fg" : "rounded-bl-lg bg-surface2")}>{m.body && <p className="whitespace-pre-wrap">{m.body}</p>}<MessagePhotos photos={m.attachments} /></div>
            <span className="mt-1 px-2 text-xs text-muted">{m.from === "ADMIN" ? (viewer === "ADMIN" ? "You (Admin)" : "Ebookvox Admin") : viewer === "ADMIN" ? "Publisher" : "You"} · {when(m.createdAt)}</span>
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
  const [files, setFiles] = useState<File[]>([]);
  if (closed) return <Banner>This ticket is closed, so no more messages can be added. If you still need help, please open a new ticket.</Banner>;
  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() && files.length === 0) return;
    setBusy(true);
    try {
      if (files.length) {
        const fd = new FormData();
        fd.append("message", text);
        files.forEach((f) => fd.append("files", f));
        await api(url, { method: "POST", body: fd });
      } else await api(url, { method: "POST", json: { message: text } });
      setText(""); setFiles([]); onSent();
    }
    catch (err) { toast((err as ApiFailure).message, "error"); }
    setBusy(false);
  }
  return (
    <form onSubmit={send} className="space-y-3">
      <Textarea label="Reply" id="reply" rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} />
      <AttachPhotos files={files} onChange={setFiles} disabled={busy} />
      <Button type="submit" loading={busy} disabled={!text.trim() && files.length === 0} className="w-full sm:w-auto"><Send className="size-4" /> Send reply</Button>
    </form>
  );
}
