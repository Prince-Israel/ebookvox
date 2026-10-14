"use client";
import { useEffect, useMemo, useState } from "react";
import { Badge, Banner, Button, Field, Input, Select, useToast } from "./ui";
import { useUser } from "./UserContext";
import { api, ApiFailure } from "@/lib/client";
import { currencyForCountry, listCountries } from "@/lib/countries";

/** Name / phone / country editor. Each input keeps its own state so fields can never leak into each other. */
export function AccountForm() {
  const { user, refresh } = useUser();
  const toast = useToast();
  const countries = useMemo(() => listCountries(), []);
  const [firstName, setFirstName] = useState(user.firstName);
  const [lastName, setLastName] = useState(user.lastName);
  const [country, setCountry] = useState(user.country);
  const [phoneCountry, setPhoneCountry] = useState(user.phoneCountry ?? user.country);
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  // show the saved number without its dialing code
  useEffect(() => {
    const dial = countries.find((c) => c.code === (user.phoneCountry ?? user.country))?.dial;
    const saved = user.phone ?? "";
    setPhone(dial && saved.startsWith(`+${dial}`) ? saved.slice(dial.length + 1) : saved.replace(/\D/g, ""));
  }, [user.phone, user.phoneCountry, user.country, countries]);

  const dial = countries.find((c) => c.code === phoneCountry)?.dial;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setFields({});
    try {
      await api("/api/me", { method: "PATCH", json: { firstName, lastName, country, phoneCountry, phone } });
      await refresh();
      toast("Your details were saved.");
    } catch (err) {
      setError((err as ApiFailure).message);
      setFields((err as ApiFailure).fields ?? {});
    }
    setBusy(false);
  }

  return (
    <form onSubmit={save} className="space-y-4" noValidate>
      {error && Object.keys(fields).length === 0 && <Banner tone="danger">{error}</Banner>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="First name" id="acc-first" value={firstName} onChange={(e) => setFirstName(e.target.value)} error={fields.firstName} autoComplete="given-name" />
        <Input label="Last name" id="acc-last" value={lastName} onChange={(e) => setLastName(e.target.value)} error={fields.lastName} autoComplete="family-name" />
      </div>
      <div>
        <Input label="Email" id="acc-email" value={user.email} readOnly disabled />
        <div className="mt-1.5">{user.emailVerified ? <Badge tone="success">Verified</Badge> : <Badge tone="warn">Not verified</Badge>}</div>
      </div>
      <Field label="Phone" id="acc-phone" error={fields.phone} hint={dial ? `Country code +${dial} · digits only` : undefined}>
        {(f) => (
          <div className="flex gap-2">
            <select aria-label="Phone country code" value={phoneCountry} onChange={(e) => setPhoneCountry(e.target.value)} className="h-12 w-[7.5rem] shrink-0 rounded-2xl border border-line bg-surface px-3 focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/25">
              {countries.map((c) => <option key={c.code} value={c.code} suppressHydrationWarning>{c.code} +{c.dial}</option>)}
            </select>
            <input {...f} type="tel" inputMode="numeric" autoComplete="tel-national" pattern="[0-9]*" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))} className={`${f.className} h-12 min-w-0 flex-1`} />
          </div>
        )}
      </Field>
      <Select label="Country" id="acc-country" value={country} onChange={(e) => setCountry(e.target.value)} error={fields.country}>
        {countries.map((c) => <option key={c.code} value={c.code} suppressHydrationWarning>{c.name}</option>)}
      </Select>
      <p className="text-sm text-muted">Currency: <strong className="text-fg">{currencyForCountry(country)}</strong> <span>(your account's home currency. Book prices and payments always use the currency of where you are right now.)</span></p>
      <Button type="submit" loading={busy}>Save changes</Button>
    </form>
  );
}
