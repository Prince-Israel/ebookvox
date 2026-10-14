"use client";
import { useEffect, useState } from "react";
import { Activity, Trash2 } from "lucide-react";
import { Async, Button, EmptyState, PageTitle, Skeleton, useToast } from "@/components/ui";
import { DataTable, FilterBar, Pager, filterInput } from "@/components/table";
import { Confirm } from "@/components/Confirm";
import { useAdmin } from "@/components/AdminContext";
import { roleLabel } from "@/lib/rbac";
import { api, ApiFailure, useApi } from "@/lib/client";

export default function ActivityPage() {
  const { admin } = useAdmin();
  const toast = useToast();
  const [q, setQ] = useState(""); const [dq, setDq] = useState(""); const [page, setPage] = useState(1); const [clear, setClear] = useState(false);
  useEffect(() => { const t = setTimeout(() => { setDq(q.trim()); setPage(1); }, 300); return () => clearTimeout(t); }, [q]);
  const s = useApi<{ total: number; activities: any[] }>(`/api/activity?${new URLSearchParams({ ...(dq && { q: dq }), page: String(page) })}`, "We couldn't load the activity log.");
  return (
    <div>
      <PageTitle title="Activity log" sub="Important administrative actions, newest first." action={admin.role === "SUPER_ADMIN" ? <Button variant="danger" onClick={() => setClear(true)}><Trash2 className="size-4" /> Clear All Activities</Button> : undefined} />
      <FilterBar><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search action, target or admin" aria-label="Search activity" className={`${filterInput} w-full sm:w-80`} /></FilterBar>
      <Async state={s} skeleton={<Skeleton className="h-96" />} isEmpty={(d) => d.activities.length === 0} empty={<EmptyState icon={<Activity className="size-8" />} title={dq ? "No activity matches" : "No activity has been recorded."} />}>
        {(d) => (<><DataTable rows={d.activities} rowKey={(r) => r.id} cols={[
          { key: "a", header: "Actor", primary: true, cell: (r) => <span className="font-semibold">{r.actorName}</span> }, { key: "r", header: "Role", cell: (r) => roleLabel(r.actorRole) },
          { key: "ac", header: "Action", cell: (r) => r.action }, { key: "t", header: "Target", cell: (r) => <>{r.targetLabel ?? "—"}<span className="block text-xs text-muted">{r.targetType}</span></> },
          { key: "d", header: "Date", cell: (r) => new Date(r.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) }, { key: "ti", header: "Time", cell: (r) => new Date(r.createdAt).toLocaleTimeString() },
          { key: "de", header: "Details", hideCard: false, cell: (r) => <span className="text-xs text-muted">{r.details ?? ""}</span> },
        ]} /><Pager page={page} total={d.total} size={30} onPage={setPage} /></>)}
      </Async>
      <Confirm open={clear} danger title="Clear all activity?" confirmLabel="Clear All Activities" onClose={() => setClear(false)} body={<>Every entry in the activity log will be permanently deleted. A single entry recording who cleared it will be kept.</>} onConfirm={async () => { try { const r = await api<{ cleared: number }>("/api/activity", { method: "DELETE" }); toast(`${r.cleared} activities cleared.`); s.reload(); } catch (e) { throw new Error((e as ApiFailure).message); } }} />
    </div>
  );
}
