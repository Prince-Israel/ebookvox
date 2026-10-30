"use client";
import { useState } from "react";
import { Bell, BookOpenText, KeyRound, Moon, Palette, Sun, SunMoon, UserRound } from "lucide-react";
import { AccountForm } from "@/components/AccountForm";
import { VoicePicker } from "@/components/audio/VoicePicker";
import { Banner, Button, Card, Input, PageTitle, Select, cx, useToast } from "@/components/ui";
import { useUser } from "@/components/UserContext";
import { api, ApiFailure } from "@/lib/client";
import { resolveVoice, SPEEDS } from "@/lib/voices";

function Section({ id, title, Icon, children }: { id: string; title: string; Icon: typeof Bell; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-24">
      <h2 id={`${id}-h`} className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-[0.2em]"><Icon className="size-5 text-accent" /> {title}</h2>
      <Card>{children}</Card>
    </section>
  );
}

function Toggle({ label, desc, checked, onChange }: { label: string; desc?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div><p className="font-medium">{label}</p>{desc && <p className="text-sm text-muted">{desc}</p>}</div>
      <button role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} className={cx("relative h-8 w-14 shrink-0 rounded-full transition", checked ? "bg-primary" : "bg-line")}>
        <span className={cx("absolute top-1 size-6 rounded-full bg-white shadow transition-all", checked ? "left-7" : "left-1")} />
      </button>
    </div>
  );
}

export default function SettingsPage() {
  const { user, refresh } = useUser();
  const toast = useToast();
  const [picker, setPicker] = useState(false);
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [pwBusy, setPwBusy] = useState(false);
  const [pwErr, setPwErr] = useState<Record<string, string>>({});
  const [pwMsg, setPwMsg] = useState<string | null>(null);

  async function patch(data: Record<string, unknown>, ok = "Saved.") {
    try {
      await api("/api/me", { method: "PATCH", json: data });
      await refresh();
      toast(ok);
    } catch (e) {
      toast((e as ApiFailure).message, "error");
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwBusy(true);
    setPwErr({});
    setPwMsg(null);
    try {
      await api("/api/me/password", { method: "POST", json: { currentPassword: pw.current, newPassword: pw.next, confirmPassword: pw.confirm } });
      setPw({ current: "", next: "", confirm: "" });
      await refresh();
      toast("Password updated.");
    } catch (err) {
      setPwErr((err as ApiFailure).fields ?? {});
      setPwMsg((err as ApiFailure).message);
    }
    setPwBusy(false);
  }

  const v = resolveVoice(user.defaultVoice);
  const theme = (t: "light" | "dark" | "system", label: string, Icon: typeof Sun) => (
    <button key={t} onClick={() => patch({ theme: t }, `${label} mode on.`)} aria-pressed={user.theme === t} className={cx("flex h-20 flex-1 flex-col items-center justify-center gap-1 rounded-2xl border text-sm font-medium transition", user.theme === t ? "border-accent bg-accent-soft text-accent-fg" : "border-line bg-surface hover:bg-surface2")}>
      <Icon className="size-6" /> {label}
    </button>
  );

  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <PageTitle title="Settings" />
      <Section id="account" title="Account" Icon={UserRound}><AccountForm /></Section>

      <Section id="security" title="Security" Icon={KeyRound}>
        <form onSubmit={changePassword} className="space-y-4" noValidate>
          <h3 className="text-lg font-semibold">Change password</h3>
          {pwMsg && Object.keys(pwErr).length === 0 && <Banner tone="danger">{pwMsg}</Banner>}
          {!user.hasPassword && <Banner>You signed in with Google. Set a password to also sign in with your email.</Banner>}
          {user.hasPassword && <Input label="Current password" id="pw-current" name="current-password" type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} error={pwErr.currentPassword} />}
          <Input label="New password" id="pw-new" name="new-password" type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} error={pwErr.newPassword} hint="At least 8 characters with upper and lower case letters and a number." />
          <Input label="Confirm new password" id="pw-confirm" name="confirm-password" type="password" autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} error={pwErr.confirmPassword} />
          <Button type="submit" loading={pwBusy}>Update password</Button>
        </form>
      </Section>

      <Section id="appearance" title="Appearance" Icon={Palette}>
        <div className="flex gap-3">{theme("light", "Light", Sun)}{theme("dark", "Dark", Moon)}{theme("system", "System", SunMoon)}</div>
      </Section>

      <Section id="reading" title="Reading" Icon={BookOpenText}>
        <div className="space-y-4">
          <div>
            <p className="mb-1.5 text-sm font-medium">Default voice</p>
            <button onClick={() => setPicker(true)} className="flex w-full items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-4 py-3 text-left hover:bg-surface2">
              <span><span className="block font-semibold">{v.name} · {v.style}</span><span className="text-sm text-muted">{v.accent} · {v.gender}</span></span>
              <span className="text-sm font-semibold text-accent">Change</span>
            </button>
          </div>
          <Select label="Default playback speed" id="set-speed" value={String(user.defaultSpeed)} onChange={(e) => patch({ defaultSpeed: Number(e.target.value) })}>
            {SPEEDS.map((s) => <option key={s} value={s}>{s}x{s === 1 ? " (normal)" : ""}</option>)}
          </Select>
          <Toggle label="Auto-play" desc="Start playing as soon as a book or document is opened." checked={user.autoPlay} onChange={(v) => patch({ autoPlay: v })} />
        </div>
        <VoicePicker open={picker} onClose={() => setPicker(false)} value={user.defaultVoice} onChange={(id) => patch({ defaultVoice: id }, "Default voice saved.")} />
      </Section>

      <Section id="notifications" title="Notifications" Icon={Bell}>
        <div className="divide-y divide-line">
          <Toggle label="Purchase notifications" desc="Payment confirmations and failures." checked={user.notifyPurchase} onChange={(v) => patch({ notifyPurchase: v })} />
          <Toggle label="Book notifications" desc="New books and books added to your library." checked={user.notifyBooks} onChange={(v) => patch({ notifyBooks: v })} />
          <Toggle label="Support notifications" desc="Replies from the Ebookvox support team." checked={user.notifySupport} onChange={(v) => patch({ notifySupport: v })} />
        </div>
      </Section>
    </div>
  );
}
