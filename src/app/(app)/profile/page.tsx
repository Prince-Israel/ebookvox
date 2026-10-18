"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { ArrowUpRight, Bell, Camera, ChevronRight, Crown, LifeBuoy, LogOut, PenLine, Receipt, Settings, ShieldCheck, Trash2, Wallet } from "lucide-react";
import { AccountForm } from "@/components/AccountForm";
import { Avatar } from "@/components/Avatar";
import { Badge, Button, Card, PageTitle, useToast } from "@/components/ui";
import { useUser } from "@/components/UserContext";
import { api, ApiFailure } from "@/lib/client";
import { countryName } from "@/lib/countries";
import { usePublicConfig } from "@/lib/public-config";
import { usePlayback } from "@/components/audio/PlaybackProvider";
import { AppVersion } from "@/components/AppVersion";

// Shrinks big phone photos before upload (faster, and handles any size camera image).
async function resizeImage(file: File, max = 640): Promise<Blob> {
  const bmp = await createImageBitmap(file).catch(() => null);
  if (!bmp) {
    if (/^image\/(jpeg|png|webp)$/.test(file.type)) return file;
    throw new Error("We couldn't read that image. Please choose a JPG, PNG or WebP photo.");
  }
  const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * s);
  c.height = Math.round(bmp.height * s);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("Image conversion failed."))), "image/jpeg", 0.88));
}

export default function ProfilePage() {
  const { user, refresh, supportUnread } = useUser();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState(false);
  const cfg = usePublicConfig();
  const pb = usePlayback();

  async function upload(file?: File) {
    if (!file) return;
    setBusy(true);
    try {
      const blob = await resizeImage(file);
      const fd = new FormData();
      fd.append("file", blob, "avatar.jpg");
      await api("/api/me/avatar", { method: "POST", body: fd });
      await refresh();
      toast("Profile photo updated.");
    } catch (e) {
      toast(e instanceof ApiFailure ? e.message : (e as Error).message, "error");
    }
    setBusy(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function remove() {
    setBusy(true);
    try {
      await api("/api/me/avatar", { method: "DELETE" });
      await refresh();
      toast("Profile photo removed.");
    } catch (e) {
      toast((e as ApiFailure).message, "error");
    }
    setBusy(false);
  }

  async function signOut() {
    setOut(true);
    (window as unknown as { __signingOut?: boolean }).__signingOut = true;
    pb.stop(); // stop the voice (and its background fetches) before the session goes away
    try { await api("/api/auth/signout", { method: "POST" }); } catch {}
    try { localStorage.removeItem("ev-theme"); } catch {}
    window.location.href = "/sign-in";
  }

  const link = (href: string, label: string, Icon: typeof Bell) => (
    <Link href={href} className="flex h-14 items-center gap-4 rounded-2xl px-3 font-medium hover:bg-surface2"><Icon className="size-5 text-accent" /><span className="flex-1">{label}</span>{href === "/support" && supportUnread > 0 && <span aria-label={`${supportUnread} unread support messages`} className="grid min-w-5 place-items-center rounded-full bg-accent px-1.5 text-[11px] font-bold leading-5 text-accent-fg">{supportUnread}</span>}<ChevronRight className="size-5 text-muted" /></Link>
  );

  return (
    <div>
      <PageTitle title="Profile" />
      <div className="grid gap-6 xl:grid-cols-[22rem_1fr]">
        <div className="space-y-6">
          <Card className="flex flex-col items-center text-center">
            <div className="relative">
              <Avatar user={user} size={128} />
              <button onClick={() => fileRef.current?.click()} disabled={busy} aria-label={user.avatarUpdatedAt ? "Replace profile photo" : "Upload profile photo"} className="absolute -bottom-1 -right-1 grid size-11 place-items-center rounded-full border-4 border-surface bg-primary text-primary-fg shadow-card disabled:opacity-60"><Camera className="size-5" /></button>
            </div>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/*" className="sr-only" id="avatar-file" aria-label="Choose profile photo" onChange={(e) => upload(e.target.files?.[0])} />
            <h2 className="mt-5 text-2xl font-semibold">{user.firstName} {user.lastName}</h2>
            <p className="break-all text-sm text-muted">{user.email}</p>
            <div className="mt-3 flex flex-wrap justify-center gap-2"><Badge tone="accent">{user.currency}</Badge><Badge>{countryName(user.country)}</Badge>{user.role === "ADMIN" && <Badge tone="success">Admin</Badge>}</div>
            <div className="mt-5 flex gap-2">
              <Button size="sm" variant="secondary" loading={busy} onClick={() => fileRef.current?.click()}>{user.avatarUpdatedAt ? "Replace photo" : "Upload photo"}</Button>
              {user.avatarUpdatedAt && <Button size="sm" variant="ghost" disabled={busy} onClick={remove}><Trash2 className="size-4" /> Remove</Button>}
            </div>
          </Card>
          <Card className="p-2 sm:p-3">
            {link("/subscribe", user.adFree ? "Subscription (ad-free)" : "Go ad-free", Crown)}
            {link("/wallet", "Wallet", Wallet)}
            {link("/orders", "Orders & payments", Receipt)}
            {link("/support", "Support", LifeBuoy)}
            {link("/notifications", "Notifications", Bell)}
            {link("/settings", "Settings", Settings)}
            <a href={cfg?.publisherSignUpUrl ?? "#"} target="_blank" rel="noopener noreferrer" className="flex h-14 items-center gap-4 rounded-2xl px-3 font-medium hover:bg-surface2"><PenLine className="size-5 text-accent" /><span className="min-w-0 flex-1">Publish your books <span className="block text-xs font-normal text-muted">Sell or share them free — for authors and publishers</span></span><ArrowUpRight className="size-5 text-muted" /></a>
            {user.role === "ADMIN" && link("/admin", "Admin console", ShieldCheck)}
            <button onClick={signOut} disabled={out} className="flex h-14 w-full items-center gap-4 rounded-2xl px-3 font-medium text-danger hover:bg-danger-soft"><LogOut className="size-5" /><span className="flex-1 text-left">{out ? "Signing out…" : "Sign out"}</span></button>
          </Card>
        </div>
        <Card><h2 className="mb-5 text-2xl font-semibold">Personal details</h2><AccountForm /></Card>
      </div>
      <AppVersion />
    </div>
  );
}
