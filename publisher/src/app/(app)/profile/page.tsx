"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, Trash2 } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { Badge, Banner, Button, Card, Field, Input, PageTitle, Select, Textarea, useToast } from "@/components/ui";
import { useUser } from "@/components/UserContext";
import { api, ApiFailure } from "@/lib/client";
import { countryName, currencyForCountry, listCountries } from "@/lib/countries";

async function resizeImage(file: File, max = 640): Promise<Blob> {
  const bmp = await createImageBitmap(file).catch(() => null);
  if (!bmp) { if (/^image\/(jpeg|png|webp)$/.test(file.type)) return file; throw new Error("We couldn't read that image. Please choose a JPG, PNG or WebP photo."); }
  const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("Image conversion failed."))), "image/jpeg", 0.88));
}

export default function ProfilePage() {
  const { user, refresh } = useUser();
  const toast = useToast();
  const countries = useMemo(() => listCountries(), []);
  const fileRef = useRef<HTMLInputElement>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [publisherName, setPublisherName] = useState(user.publisherName);
  const [firstName, setFirstName] = useState(user.firstName);
  const [lastName, setLastName] = useState(user.lastName);
  const [bio, setBio] = useState(user.bio);
  const [country, setCountry] = useState(user.country);
  const [phoneCountry, setPhoneCountry] = useState(user.phoneCountry);
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dial = countries.find((c) => c.code === user.phoneCountry)?.dial;
    setPhone(dial && user.phone.startsWith(`+${dial}`) ? user.phone.slice(dial.length + 1) : user.phone.replace(/\D/g, ""));
  }, [user.phone, user.phoneCountry, countries]);

  async function upload(file?: File) {
    if (!file) return;
    setPhotoBusy(true);
    try {
      const fd = new FormData(); fd.append("file", await resizeImage(file), "avatar.jpg");
      await api("/api/me/avatar", { method: "POST", body: fd }); await refresh(); toast("Profile photo updated.");
    } catch (e) { toast(e instanceof ApiFailure ? e.message : (e as Error).message, "error"); }
    setPhotoBusy(false);
    if (fileRef.current) fileRef.current.value = "";
  }
  async function removePhoto() {
    setPhotoBusy(true);
    try { await api("/api/me/avatar", { method: "DELETE" }); await refresh(); toast("Profile photo removed."); } catch (e) { toast((e as ApiFailure).message, "error"); }
    setPhotoBusy(false);
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setFields({}); setError(null);
    try { await api("/api/me", { method: "PATCH", json: { publisherName, firstName, lastName, bio, country, phoneCountry, phone } }); await refresh(); toast("Profile saved."); }
    catch (err) { setError((err as ApiFailure).message); setFields((err as ApiFailure).fields ?? {}); }
    setBusy(false);
  }
  const dial = countries.find((c) => c.code === phoneCountry)?.dial;
  return (
    <div>
      <PageTitle title="Profile" />
      <div className="grid gap-6 lg:grid-cols-[20rem_1fr]">
        <Card className="flex flex-col items-center text-center">
          <div className="relative"><Avatar user={user} size={128} />
            <button onClick={() => fileRef.current?.click()} disabled={photoBusy} aria-label={user.avatarUpdatedAt ? "Replace profile photo" : "Upload profile photo"} className="absolute -bottom-1 -right-1 grid size-11 place-items-center rounded-full border-4 border-surface bg-primary text-primary-fg shadow-card disabled:opacity-60"><Camera className="size-5" /></button></div>
          <input ref={fileRef} id="avatar-file" type="file" accept="image/jpeg,image/png,image/webp,image/*" className="sr-only" aria-label="Choose profile photo" onChange={(e) => upload(e.target.files?.[0])} />
          <h2 className="mt-5 text-2xl font-semibold">{user.publisherName}</h2>
          <p className="break-all text-sm text-muted">{user.email}</p>
          <div className="mt-3 flex flex-wrap justify-center gap-2"><Badge tone="accent">{user.currency}</Badge><Badge>{countryName(user.country)}</Badge><Badge tone="success">Verified</Badge></div>
          <div className="mt-5 flex gap-2"><Button size="sm" variant="secondary" loading={photoBusy} onClick={() => fileRef.current?.click()}>{user.avatarUpdatedAt ? "Replace photo" : "Upload photo"}</Button>{user.avatarUpdatedAt && <Button size="sm" variant="ghost" disabled={photoBusy} onClick={removePhoto}><Trash2 className="size-4" /> Remove</Button>}</div>
        </Card>
        <Card>
          <form onSubmit={save} className="space-y-4" noValidate>
            {error && Object.keys(fields).length === 0 && <Banner tone="danger">{error}</Banner>}
            <Input label="Publisher name" id="pf-pub" value={publisherName} onChange={(e) => setPublisherName(e.target.value)} error={fields.publisherName} hint="Shown to readers as the publisher of your books." />
            <div className="grid gap-4 sm:grid-cols-2"><Input label="First name" id="pf-first" value={firstName} onChange={(e) => setFirstName(e.target.value)} error={fields.firstName} /><Input label="Last name" id="pf-last" value={lastName} onChange={(e) => setLastName(e.target.value)} error={fields.lastName} /></div>
            <Input label="Email" id="pf-email" value={user.email} readOnly disabled />
            <Field label="Phone" id="pf-phone" error={fields.phone} hint={dial ? `Country code +${dial} · digits only` : undefined}>
              {(f) => (<div className="flex gap-2">
                <select aria-label="Phone country code" value={phoneCountry} onChange={(e) => setPhoneCountry(e.target.value)} className="h-12 w-[7.5rem] shrink-0 rounded-2xl border border-line bg-surface px-3">{countries.map((c) => <option key={c.code} value={c.code} suppressHydrationWarning>{c.code} +{c.dial}</option>)}</select>
                <input {...f} type="tel" inputMode="numeric" autoComplete="tel-national" pattern="[0-9]*" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))} className={`${f.className} h-12 min-w-0 flex-1`} /></div>)}
            </Field>
            <Select label="Country" id="pf-country" value={country} onChange={(e) => setCountry(e.target.value)} error={fields.country}>{countries.map((c) => <option key={c.code} value={c.code} suppressHydrationWarning>{c.name}</option>)}</Select>
            <p className="text-sm text-muted">Primary currency: <strong className="text-fg">{currencyForCountry(country)}</strong>{country !== user.country && " (applies after saving; existing wallets keep their currency)"}</p>
            <Textarea label="Biography" id="pf-bio" rows={5} value={bio} onChange={(e) => setBio(e.target.value)} error={fields.bio} maxLength={1500} hint={`${bio.length} / 1500`} />
            <Button type="submit" loading={busy}>Save profile</Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
