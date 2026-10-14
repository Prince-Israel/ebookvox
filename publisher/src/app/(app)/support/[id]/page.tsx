"use client";
import Link from "next/link";
import { use, useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { Async, Badge, Card, Skeleton } from "@/components/ui";
import { Composer, STATUS_LABEL, STATUS_TONE, Thread, type Msg } from "@/components/Conversation";
import { useApi } from "@/lib/client";

export default function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const state = useApi<{ ticket: { subject: string; status: keyof typeof STATUS_LABEL; messages: Msg[] } }>(`/api/tickets/${id}`, "We couldn't load this conversation. Please try again.");
  useEffect(() => {
    const t = setInterval(() => document.visibilityState === "visible" && state.reload(), 20000);
    return () => clearInterval(t);
  }, [state.reload]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/support" className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-fg"><ArrowLeft className="size-4" /> Support</Link>
      <Async state={state} skeleton={<Skeleton className="h-96" />}>
        {({ ticket }) => (
          <div className="anim-up space-y-5">
            <div className="flex flex-wrap items-center gap-3"><h1 className="text-3xl font-semibold">{ticket.subject}</h1><Badge tone={STATUS_TONE[ticket.status]}>{STATUS_LABEL[ticket.status]}</Badge></div>
            <Card><Thread messages={ticket.messages} viewer="PUBLISHER" /></Card>
            <Composer url={`/api/tickets/${id}/reply`} closed={ticket.status === "CLOSED"} onSent={state.reload} />
          </div>
        )}
      </Async>
    </div>
  );
}
