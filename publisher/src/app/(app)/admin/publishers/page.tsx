"use client";
import { Users } from "lucide-react";
import { Async, Badge, Card, EmptyState, PageTitle, Skeleton } from "@/components/ui";
import { dateFmt } from "@/components/bits";
import { useApi } from "@/lib/client";

export default function AdminPublishers() {
  const s = useApi<{ publishers: Array<{ id: string; name: string; email: string; country: string; currency: string; verified: boolean; status: string; books: number; sales: number; createdAt: string }> }>("/api/admin/publishers", "We couldn't load publishers. Please try again.");
  return (
    <div>
      <PageTitle title="Publishers" />
      <Async state={s} skeleton={<Skeleton className="h-64" />} isEmpty={(d) => d.publishers.length === 0} empty={<EmptyState icon={<Users className="size-8" />} title="No publishers yet" body="Registered publishers will be listed here." />}>
        {(d) => (<ul className="grid gap-3 md:grid-cols-2">{d.publishers.map((p) => (
          <li key={p.id}><Card className="p-4"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate font-semibold">{p.name}</p><p className="truncate text-sm text-muted">{p.email}</p></div><Badge tone={p.verified ? "success" : "warn"}>{p.verified ? "Verified" : "Unverified"}</Badge></div>
            <p className="mt-2 text-sm text-muted">{p.country} · {p.currency} · {p.books} books · {p.sales} sales · joined {dateFmt(p.createdAt)}</p></Card></li>))}</ul>)}
      </Async>
    </div>
  );
}
