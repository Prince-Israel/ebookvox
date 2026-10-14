"use client";
import { useEffect, useRef, useState } from "react";
import { Camera, Plus, Trash2, X } from "lucide-react";
import { Async, Banner, Button, Card, Input, Select, Skeleton, Textarea, useToast } from "@/components/ui";
import { Avatar } from "@/components/Avatar";
import { useAdmin } from "@/components/AdminContext";
import { roleLabel } from "@/lib/rbac";
import { VOICES } from "@/lib/voices";
import { api, ApiFailure, useApi } from "@/lib/client";

type S = { settings: { company: { name: string; address: string; website: string }; supportEmail: string; categories: string[]; currency: { minWithdrawals: Record<string, number> }; voice: { defaultVoice: string } }; version: string; developer: string; copyright: string };

async function resize(file: File, max = 640): Promise<Blob> {
  const bmp = await createImageBitmap(file).catch(() => null);
  if (!bmp) { if (/^image\/(jpeg|png|webp)$/.test(file.type)) return file; throw new Error("We couldn't read that image."); }
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height)); const c = document.createElement("canvas"); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("Image conversion failed."))), "image/jpeg", 0.88));
}

function Section({ title, children, id }: { title: string; children: React.ReactNode; id?: string }) {
  return <section id={id} aria-label={title}><h2 className="mb-3 text-sm font-bold uppercase tracking-[0.2em]">{title}</h2><Card>{children}</Card></section>;
}

export default function SettingsPage() {
  const { admin, refresh, can } = useAdmin();
  const toast = useToast();
  const s = useApi<S>("/api/settings", "We couldn't load settings.");
  const fileRef = useRef<HTMLInputElement>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [name, setName] = useState(admin.name); const [phone, setPhone] = useState(admin.phone ?? ""); const [job, setJob] = useState(admin.jobTitle); const [bio, setBio] = useState(admin.bio);
  const [pBusy, setPBusy] = useState(false); const [pErr, setPErr] = useState<string | null>(null);
  const [cur, setCur] = useState(""); const [nw, setNw] = useState(""); const [conf, setConf] = useState(""); const [pwBusy, setPwBusy] = useState(false); const [pwErr, setPwErr] = useState<string | null>(null); const [pwFields, setPwFields] = useState<Record<string, string>>({});

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault(); setPBusy(true); setPErr(null);
    try { await api("/api/me", { method: "PATCH", json: { name, phone, jobTitle: job, bio } }); await refresh(); toast("Profile saved."); } catch (x) { setPErr((x as ApiFailure).message); }
    setPBusy(false);
  }
  async function upload(file?: File) {
    if (!file) return; setPhotoBusy(true);
    try { const fd = new FormData(); fd.append("file", await resize(file), "a.jpg"); await api("/api/me/avatar", { method: "POST", body: fd }); await refresh(); toast("Profile photo updated."); } catch (x) { toast(x instanceof ApiFailure ? x.message : (x as Error).message, "error"); }
    setPhotoBusy(false); if (fileRef.current) fileRef.current.value = "";
  }
  async function removePhoto() { try { await api("/api/me/avatar", { method: "DELETE" }); await refresh(); toast("Profile photo removed."); } catch (x) { toast((x as ApiFailure).message, "error"); } }
  async function changePw(e: React.FormEvent) {
    e.preventDefault(); setPwBusy(true); setPwErr(null); setPwFields({});
    try { await api("/api/me/password", { method: "POST", json: { currentPassword: cur, newPassword: nw, confirmPassword: conf } }); setCur(""); setNw(""); setConf(""); await refresh(); toast("Password updated."); if (admin.mustChangePassword) window.location.href = "/dashboard"; }
    catch (x) { setPwErr((x as ApiFailure).message); setPwFields((x as ApiFailure).fields ?? {}); }
    setPwBusy(false);
  }
  const avatarUser = { id: admin.id, firstName: admin.name.split(" ")[0], lastName: admin.name.split(" ")[1] ?? "", avatarUpdatedAt: admin.avatarUpdatedAt };

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <h1 className="text-4xl font-semibold">Settings</h1>
      {admin.mustChangePassword && <Banner tone="warn">Your password is temporary. Choose a new one below to continue.</Banner>}
      <Section title="Admin profile">
        <div className="mb-6 flex items-center gap-5">
          <div className="relative"><Avatar user={avatarUser} size={96} /><button onClick={() => fileRef.current?.click()} disabled={photoBusy} aria-label="Change profile photo" className="absolute -bottom-1 -right-1 grid size-10 place-items-center rounded-full border-4 border-surface bg-primary text-primary-fg"><Camera className="size-4" /></button></div>
          <input ref={fileRef} id="admin-avatar" type="file" accept="image/jpeg,image/png,image/webp,image/*" className="sr-only" aria-label="Choose profile photo" onChange={(e) => upload(e.target.files?.[0])} />
          <div><p className="text-xl font-semibold">{admin.name}</p><p className="text-sm text-muted">{roleLabel(admin.role)}</p><div className="mt-2 flex gap-2"><Button size="sm" variant="secondary" loading={photoBusy} onClick={() => fileRef.current?.click()}>{admin.avatarUpdatedAt ? "Replace photo" : "Upload photo"}</Button>{admin.avatarUpdatedAt && <Button size="sm" variant="ghost" onClick={removePhoto}><Trash2 className="size-4" /> Remove</Button>}</div></div>
        </div>
        <form onSubmit={saveProfile} className="space-y-4" noValidate>
          {pErr && <Banner tone="danger">{pErr}</Banner>}
          <div className="grid gap-4 sm:grid-cols-2"><Input label="Name" id="pf-name" value={name} onChange={(e) => setName(e.target.value)} /><Input label="Email" id="pf-email" value={admin.email} readOnly disabled /></div>
          <div className="grid gap-4 sm:grid-cols-2"><Input label="Phone" id="pf-phone" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /><Input label="Job title" id="pf-job" value={job} onChange={(e) => setJob(e.target.value)} /></div>
          <Textarea label="Biography" id="pf-bio" rows={3} value={bio} onChange={(e) => setBio(e.target.value)} />
          <Button type="submit" loading={pBusy}>Save profile</Button>
        </form>
      </Section>

      <Section title="Password" id="password">
        <form onSubmit={changePw} className="space-y-4" noValidate autoComplete="off">
          {pwErr && Object.keys(pwFields).length === 0 && <Banner tone="danger">{pwErr}</Banner>}
          <Input label="Current password" id="pw-current" type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} error={pwFields.currentPassword} />
          <Input label="New password" id="pw-new" type="password" autoComplete="new-password" value={nw} onChange={(e) => setNw(e.target.value)} error={pwFields.newPassword} hint="At least 10 characters with upper & lower case and a number." />
          <Input label="Confirm new password" id="pw-confirm" type="password" autoComplete="new-password" value={conf} onChange={(e) => setConf(e.target.value)} error={pwFields.confirmPassword} />
          <Button type="submit" loading={pwBusy}>Update password</Button>
        </form>
      </Section>

      {!admin.mustChangePassword && (
        <Async state={s} skeleton={<Skeleton className="h-64" />}>
          {(d) => (<>
            <PlatformConfig data={d} editable={can("settings")} onSaved={s.reload} />
            <Section title="About">
              <dl className="grid gap-4 sm:grid-cols-3">
                <div><dt className="text-sm text-muted">App Version</dt><dd className="font-semibold">{d.version}</dd></div>
                <div><dt className="text-sm text-muted">Developed & Maintained By</dt><dd className="font-semibold">{d.developer}</dd></div>
                <div><dt className="text-sm text-muted">Copyright</dt><dd className="font-semibold">{d.copyright}</dd></div>
              </dl>
            </Section>
          </>)}
        </Async>
      )}
    </div>
  );
}

function PlatformConfig({ data, editable, onSaved }: { data: S; editable: boolean; onSaved: () => void }) {
  const toast = useToast();
  const st = data.settings;
  const [company, setCompany] = useState(st.company);
  const [email, setEmail] = useState(st.supportEmail);
  const [cats, setCats] = useState(st.categories); const [newCat, setNewCat] = useState("");
  const [mins, setMins] = useState(Object.fromEntries(Object.entries(st.currency.minWithdrawals).map(([k, v]) => [k, String(v / 100)])));
  const [voice, setVoice] = useState(st.voice.defaultVoice);
  const [busy, setBusy] = useState<string | null>(null); const [err, setErr] = useState<string | null>(null);
  useEffect(() => { setCompany(st.company); setEmail(st.supportEmail); setCats(st.categories); setVoice(st.voice.defaultVoice); }, [st]);
  async function save(section: string, body: unknown) {
    setBusy(section); setErr(null);
    try { const r = await api<{ warnings: string[] }>(`/api/settings/${section}`, { method: "PUT", json: body }); r.warnings.length ? toast(r.warnings.join(" "), "error") : toast("Saved and applied."); onSaved(); } catch (x) { setErr((x as ApiFailure).message); }
    setBusy(null);
  }
  const ro = !editable;
  return (
    <>
      {!editable && <Banner>You can view platform configuration, but changing it requires the Settings permission.</Banner>}
      {err && <Banner tone="danger">{err}</Banner>}
      <Section title="Company information">
        <div className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><Input label="Company name" id="co-name" value={company.name} disabled={ro} onChange={(e) => setCompany({ ...company, name: e.target.value })} /><Input label="Website" id="co-web" value={company.website} disabled={ro} onChange={(e) => setCompany({ ...company, website: e.target.value })} /></div><Input label="Address" id="co-addr" value={company.address} disabled={ro} onChange={(e) => setCompany({ ...company, address: e.target.value })} />
          <div className="grid items-end gap-4 sm:grid-cols-[1fr_auto]"><Input label="Support email" id="co-support" type="email" value={email} disabled={ro} onChange={(e) => setEmail(e.target.value)} />{editable && <Button variant="secondary" loading={busy === "supportEmail"} onClick={() => save("supportEmail", { supportEmail: email })}>Save support email</Button>}</div>
          {editable && <Button loading={busy === "company"} onClick={() => save("company", company)}>Save company information</Button>}</div>
      </Section>
      <Section title="Book categories">
        <p className="mb-3 text-sm text-muted">Applied to the Publisher upload form and book validation.</p>
        <ul className="mb-4 flex flex-wrap gap-2">{cats.map((c) => <li key={c} className="inline-flex items-center gap-1.5 rounded-full bg-surface2 py-1.5 pl-3.5 pr-2 text-sm">{c}{editable && <button onClick={() => setCats(cats.filter((x) => x !== c))} aria-label={`Remove ${c}`} className="grid size-6 place-items-center rounded-full hover:bg-line"><X className="size-3.5" /></button>}</li>)}</ul>
        {editable && <div className="flex flex-wrap gap-2"><input value={newCat} onChange={(e) => setNewCat(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (newCat.trim() && !cats.includes(newCat.trim())) { setCats([...cats, newCat.trim()]); setNewCat(""); } } }} placeholder="New category" aria-label="New category" className="h-11 min-w-0 flex-1 rounded-full border border-line bg-surface px-4 text-sm" /><Button variant="secondary" onClick={() => { if (newCat.trim() && !cats.includes(newCat.trim())) { setCats([...cats, newCat.trim()]); setNewCat(""); } }}><Plus className="size-4" /> Add</Button><Button loading={busy === "categories"} onClick={() => save("categories", { categories: cats })}>Save categories</Button></div>}
      </Section>
      <Section title="Currency configuration">
        <p className="mb-3 text-sm text-muted">Reader prices follow the buyer's country: Nigeria → NGN, UK → GBP, Eurozone → EUR, elsewhere → USD. Set the minimum publisher withdrawal per currency:</p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">{["NGN", "USD", "GBP", "EUR"].map((c) => <Input key={c} label={`Min. withdrawal ${c}`} id={`min-${c}`} inputMode="decimal" disabled={ro} value={mins[c] ?? ""} onChange={(e) => setMins({ ...mins, [c]: e.target.value.replace(/[^0-9.]/g, "") })} />)}</div>
        {editable && <Button className="mt-4" loading={busy === "currency"} onClick={() => save("currency", { minWithdrawals: Object.fromEntries(Object.entries(mins).map(([k, v]) => [k, Number(v)])) })}>Save currency configuration</Button>}
      </Section>
      <Section title="Voice configuration">
        <div className="grid items-end gap-4 sm:grid-cols-[1fr_auto]"><Select label="Default voice for new readers" id="voice" value={voice} disabled={ro} onChange={(e) => setVoice(e.target.value)}>{VOICES.map((v) => <option key={v.id} value={v.id}>{v.name} · {v.accent} · {v.style}</option>)}</Select>{editable && <Button loading={busy === "voice"} onClick={() => save("voice", { defaultVoice: voice })}>Save voice</Button>}</div>
      </Section>
    </>
  );
}
