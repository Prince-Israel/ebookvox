"use client";
import { useEffect, useState } from "react";
import { Pencil, Plus, ShieldCheck, Trash2, UserCheck, UserX } from "lucide-react";
import { Async, Banner, Button, Input, PageTitle, Select, Sheet, Skeleton, Textarea, cx, useToast } from "@/components/ui";
import { DataTable } from "@/components/table";
import { StatusBadge, dateFmt } from "@/components/bits";
import { Confirm } from "@/components/Confirm";
import { Avatar } from "@/components/Avatar";
import { useAdmin } from "@/components/AdminContext";
import { roleLabel } from "@/lib/rbac";
import { api, ApiFailure, useApi } from "@/lib/client";

type A = { id: string; name: string; email: string; phone: string | null; role: string; permissions: string[]; status: string; jobTitle: string; bio: string; avatarUpdatedAt: string | null; lastLoginAt: string | null; createdAt: string };
type D = { admins: A[]; roles: Array<[string, string]>; permissions: Array<[string, string]>; defaults: Record<string, string[]> };

export default function AdminsPage() {
  const { admin: me } = useAdmin();
  const toast = useToast();
  const s = useApi<D>(me.role === "SUPER_ADMIN" ? "/api/admins" : null, "We couldn't load administrators.");
  const [form, setForm] = useState<{ mode: "create" | "edit"; a?: A } | null>(null);
  const [del, setDel] = useState<A | null>(null);
  async function setStatus(a: A, status: string) { try { await api(`/api/admins/${a.id}/status`, { method: "POST", json: { status } }); toast(status === "ACTIVE" ? `${a.name} activated.` : `${a.name} suspended.`); s.reload(); } catch (e) { toast((e as ApiFailure).message, "error"); } }
  if (me.role !== "SUPER_ADMIN") return <div role="alert" className="rounded-3xl border border-danger/30 bg-danger-soft p-8 text-center font-medium">You don't have permission to manage administrators. Only a Super Admin can.</div>;
  return (
    <div>
      <PageTitle title="Administrators" sub="Create admins and control exactly what each can do." action={<Button onClick={() => setForm({ mode: "create" })}><Plus className="size-5" /> Create admin</Button>} />
      <Async state={s} skeleton={<Skeleton className="h-80" />}>
        {(d) => (<>
          <DataTable rows={d.admins} rowKey={(r) => r.id} cols={[
            { key: "n", header: "Admin", primary: true, cell: (r) => <span className="flex items-center gap-3"><Avatar user={{ id: r.id, firstName: r.name.split(" ")[0], lastName: r.name.split(" ")[1] ?? "", avatarUpdatedAt: r.avatarUpdatedAt }} size={36} /><span><b>{r.name}</b>{r.id === me.id && <span className="ml-2 text-xs text-muted">(you)</span>}<span className="block break-all text-xs font-normal text-muted">{r.email}</span></span></span> },
            { key: "j", header: "Job title", cell: (r) => r.jobTitle || "—" }, { key: "r", header: "Role", cell: (r) => roleLabel(r.role) },
            { key: "p", header: "Permissions", cell: (r) => <span className="text-xs text-muted">{r.role === "SUPER_ADMIN" ? "Full access" : r.permissions.map((p) => d.permissions.find((x) => x[0] === p)?.[1]).join(", ") || "None"}</span> },
            { key: "s", header: "Status", cell: (r) => <StatusBadge status={r.status} /> }, { key: "l", header: "Last sign-in", cell: (r) => dateFmt(r.lastLoginAt, true) },
          ]} actions={(r) => (<>
            <Button size="sm" variant="secondary" onClick={() => setForm({ mode: "edit", a: r })}><Pencil className="size-4" /> Edit</Button>
            {r.id !== me.id && (r.status === "ACTIVE" ? <Button size="sm" variant="secondary" onClick={() => setStatus(r, "SUSPENDED")}><UserX className="size-4" /> Suspend</Button> : <Button size="sm" variant="secondary" onClick={() => setStatus(r, "ACTIVE")}><UserCheck className="size-4" /> Activate</Button>)}
            {r.id !== me.id && <Button size="sm" variant="danger" onClick={() => setDel(r)}><Trash2 className="size-4" /> Delete</Button>}
          </>)} />
          <AdminForm data={d} state={form} onClose={() => setForm(null)} onSaved={() => { setForm(null); s.reload(); }} />
        </>)}
      </Async>
      <Confirm open={!!del} danger title="Delete this administrator?" confirmLabel="Delete admin" onClose={() => setDel(null)} body={<>{del?.name} will lose access immediately. Their past actions stay in the activity log.</>} onConfirm={async () => { try { await api(`/api/admins/${del!.id}`, { method: "DELETE" }); toast("Administrator deleted."); s.reload(); } catch (e) { throw new Error((e as ApiFailure).message); } }} />
    </div>
  );
}

function AdminForm({ data, state, onClose, onSaved }: { data: D; state: { mode: "create" | "edit"; a?: A } | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({ name: "", email: "", phone: "", role: "OPERATIONS", jobTitle: "", bio: "", password: "" });
  const [perms, setPerms] = useState<string[]>([]);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null); const [fields, setFields] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!state) return;
    const a = state.a;
    setF({ name: a?.name ?? "", email: a?.email ?? "", phone: a?.phone ?? "", role: a?.role ?? "OPERATIONS", jobTitle: a?.jobTitle ?? "", bio: a?.bio ?? "", password: "" });
    setPerms(a ? a.permissions : data.defaults.OPERATIONS);
    setErr(null); setFields({});
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const editable = data.permissions.filter(([k]) => k !== "admins");
  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null); setFields({});
    try {
      const body: any = { name: f.name, email: f.email, phone: f.phone, role: f.role, jobTitle: f.jobTitle, bio: f.bio, permissions: perms };
      if (f.password) body.password = f.password;
      if (state!.mode === "create") await api("/api/admins", { method: "POST", json: { ...body, password: f.password } });
      else await api(`/api/admins/${state!.a!.id}`, { method: "PATCH", json: body });
      toast(state!.mode === "create" ? "Administrator created." : "Administrator saved."); onSaved();
    } catch (x) { setErr((x as ApiFailure).message); setFields((x as ApiFailure).fields ?? {}); }
    setBusy(false);
  }
  return (
    <Sheet open={!!state} onClose={onClose} title={state?.mode === "create" ? "Create administrator" : "Edit administrator"}>
      <form onSubmit={save} className="space-y-4" noValidate>
        {err && <Banner tone="danger">{err}</Banner>}
        <Input label="Name" id="ad-name" value={f.name} onChange={set("name")} error={fields.name} />
        <Input label="Email" id="ad-email" type="email" value={f.email} onChange={set("email")} error={fields.email} />
        <div className="grid gap-4 sm:grid-cols-2"><Input label="Phone" id="ad-phone" inputMode="tel" value={f.phone} onChange={set("phone")} error={fields.phone} /><Input label="Job title" id="ad-job" value={f.jobTitle} onChange={set("jobTitle")} /></div>
        <Select label="Role" id="ad-role" value={f.role} disabled={state?.mode === "edit" && state.a?.id === undefined} onChange={(e) => { setF({ ...f, role: e.target.value }); setPerms(data.defaults[e.target.value] ?? []); }}>{data.roles.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select>
        <Textarea label="Biography" id="ad-bio" rows={3} value={f.bio} onChange={set("bio")} />
        <Input label={state?.mode === "create" ? "Temporary password" : "Reset password (optional)"} id="ad-pass" type="password" autoComplete="new-password" value={f.password} onChange={set("password")} error={fields.password} hint="At least 10 characters with upper & lower case and a number. They must change it at first sign-in." />
        <fieldset className="rounded-2xl border border-line p-4"><legend className="flex items-center gap-2 px-2 text-sm font-semibold"><ShieldCheck className="size-4 text-accent" /> Permissions</legend>
          {f.role === "SUPER_ADMIN" ? <p className="text-sm text-muted">Super Admins have full access to everything, including managing administrators.</p> : (
            <div className="grid gap-2 sm:grid-cols-2">{editable.map(([k, l]) => <label key={k} className={cx("flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border px-3 text-sm", perms.includes(k) ? "border-accent bg-accent-soft" : "border-line")}><input type="checkbox" className="size-4 accent-[var(--primary)]" checked={perms.includes(k)} onChange={() => setPerms(perms.includes(k) ? perms.filter((p) => p !== k) : [...perms, k])} />{l}</label>)}</div>
          )}
        </fieldset>
        <Button type="submit" size="lg" className="w-full" loading={busy}>{state?.mode === "create" ? "Create administrator" : "Save changes"}</Button>
      </form>
    </Sheet>
  );
}
