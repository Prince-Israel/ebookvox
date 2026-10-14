"use client";
import { useState } from "react";
import { KeyRound, LogOut, Moon, Palette, Sun, SunMoon } from "lucide-react";
import { Banner, Button, Card, Input, PageTitle, cx, useToast } from "@/components/ui";
import { useUser } from "@/components/UserContext";
import { api, ApiFailure } from "@/lib/client";

export default function SettingsPage() {
  const { user, refresh } = useUser();
  const toast = useToast();
  // three independent inputs — no shared state between them or with any other form
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  async function setTheme(theme: "light" | "dark" | "system") {
    try { await api("/api/me", { method: "PATCH", json: { theme } }); await refresh(); } catch (e) { toast((e as ApiFailure).message, "error"); }
  }
  async function change(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setFields({}); setError(null);
    try { await api("/api/me/password", { method: "POST", json: { currentPassword, newPassword, confirmPassword } }); setCurrentPassword(""); setNewPassword(""); setConfirmPassword(""); toast("Password updated."); }
    catch (err) { setError((err as ApiFailure).message); setFields((err as ApiFailure).fields ?? {}); }
    setBusy(false);
  }
  async function signOut() { try { await api("/api/auth/signout", { method: "POST" }); } catch {} try { localStorage.removeItem("evp-theme"); } catch {} window.location.href = "/sign-in"; }
  const themeBtn = (t: "light" | "dark" | "system", label: string, Icon: typeof Sun) => (
    <button key={t} onClick={() => setTheme(t)} aria-pressed={user.theme === t} className={cx("flex h-20 flex-1 flex-col items-center justify-center gap-1 rounded-2xl border text-sm font-medium transition", user.theme === t ? "border-accent bg-accent-soft text-accent-fg" : "border-line bg-surface hover:bg-surface2")}><Icon className="size-6" /> {label}</button>
  );
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <PageTitle title="Settings" />
      <section aria-labelledby="ap"><h2 id="ap" className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-[0.2em]"><Palette className="size-5 text-accent" /> Appearance</h2><Card><div className="flex gap-3">{themeBtn("light", "Light", Sun)}{themeBtn("dark", "Dark", Moon)}{themeBtn("system", "System", SunMoon)}</div></Card></section>
      <section aria-labelledby="sec"><h2 id="sec" className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-[0.2em]"><KeyRound className="size-5 text-accent" /> Change password</h2>
        <Card><form onSubmit={change} className="space-y-4" noValidate autoComplete="off">
          {error && Object.keys(fields).length === 0 && <Banner tone="danger">{error}</Banner>}
          <Input label="Current password" id="pw-current" name="current-password" type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} error={fields.currentPassword} />
          <Input label="New password" id="pw-new" name="new-password" type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} error={fields.newPassword} hint="At least 8 characters with upper and lower case letters and a number." />
          <Input label="Confirm new password" id="pw-confirm" name="confirm-password" type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} error={fields.confirmPassword} />
          <Button type="submit" loading={busy}>Update password</Button></form></Card></section>
      <Button variant="danger" onClick={signOut}><LogOut className="size-5" /> Sign out</Button>
    </div>
  );
}
