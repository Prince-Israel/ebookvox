"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PenLine } from "lucide-react";
import { Async, Banner, EmptyState, PageTitle, Skeleton } from "@/components/ui";
import { DataTable, FilterBar, filterInput } from "@/components/table";
import { dateFmt } from "@/components/bits";
import { useApi } from "@/lib/client";
import { formatMoney } from "@/lib/money";

function List() {
  const [q, setQ] = useState(useSearchParams().get("q") ?? ""); const [dq, setDq] = useState(q);
  useEffect(() => { const t = setTimeout(() => setDq(q.trim()), 300); return () => clearTimeout(t); }, [q]);
  const s = useApi<{ authors: any[]; unavailable: string[] }>(`/api/authors${dq ? `?q=${encodeURIComponent(dq)}` : ""}`, "We couldn't load authors.");
  return (
    <div>
      <PageTitle title="Authors" sub="Everyone with a book in the catalogue, across Reader and Publisher." />
      <FilterBar><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search author or publisher" aria-label="Search authors" className={`${filterInput} w-full sm:w-80`} /></FilterBar>
      {s.data?.unavailable.length ? <div className="mb-4"><Banner tone="warn">{s.data.unavailable.join(" and ")} data is currently unavailable, so some authors may be missing.</Banner></div> : null}
      <Async state={s} skeleton={<Skeleton className="h-96" />} isEmpty={(d) => d.authors.length === 0 && d.unavailable.length === 0} empty={<EmptyState icon={<PenLine className="size-8" />} title={dq ? "No authors match" : "No authors yet"} />}>
        {(d) => <DataTable rows={d.authors} rowKey={(r) => `${r.author}|${r.publisherId}`} cols={[
          { key: "a", header: "Author", primary: true, cell: (r) => <span className="font-semibold">{r.author}</span> },
          { key: "pr", header: "Profile", cell: (r) => r.source === "Publisher" ? "Publisher author" : "Reader catalogue" },
          { key: "b", header: "Biography", cell: (r) => <span className="line-clamp-2 max-w-64 text-muted">{r.bio || "Not provided"}</span> },
          { key: "n", header: "Books", cell: (r) => r.books, className: "tabular-nums" }, { key: "p", header: "Published", cell: (r) => r.published, className: "tabular-nums" },
          { key: "pub", header: "Publisher", cell: (r) => r.publisher },
          { key: "s", header: "Sales", cell: (r) => <>{r.sales}{r.gross && Object.keys(r.gross).length ? <span className="block text-xs text-muted">{Object.entries(r.gross as Record<string, number>).map(([c, v]) => formatMoney(v, c)).join(" · ")}</span> : null}</> },
          { key: "r", header: "Registered", cell: (r) => r.registeredAt ? dateFmt(r.registeredAt) : "Platform catalogue" },
        ]} />}
      </Async>
    </div>
  );
}
export default function AuthorsPage() { return <Suspense><List /></Suspense>; }
