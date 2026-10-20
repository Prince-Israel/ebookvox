"use client";
import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Banner, Button, Field, Input, Select } from "@/components/ui";
import { SocialButtons } from "@/components/SocialButtons";
import { TermsCheckbox } from "@/components/LegalLink";
import { api, ApiFailure } from "@/lib/client";
import { currencyForCountry, isCountry, listCountries } from "@/lib/countries";
import { detectCountry } from "@/lib/geo-client";

function Form() {
  const sp = useSearchParams();
  const next = sp.get("next")?.startsWith("/") ? sp.get("next")! : "/home";
  const countries = useMemo(() => listCountries(), []);
  // Every input owns its own state — nothing is shared between fields.
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [country, setCountry] = useState("NG");
  const [phoneCountry, setPhoneCountry] = useState("NG");
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [phone, setPhone] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  useEffect(() => {
    let live = true;
    detectCountry(isCountry).then((g) => { if (live) { setCountry(g); setPhoneCountry(g); } });
    return () => { live = false; };
  }, []);

  const dial = countries.find((c) => c.code === phoneCountry)?.dial;
  const currency = currencyForCountry(country);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFields({});
    if (!accepted) { setFields({ acceptTerms: "Please accept the Privacy Policy and Terms to continue." }); return; }
    setBusy(true);
    try {
      await api("/api/auth/signup", { method: "POST", json: { firstName, lastName, email, password, confirmPassword, country, phoneCountry, phone, acceptTerms: accepted } });
      window.location.href = next;
    } catch (err) {
      const f = err as ApiFailure;
      setError(f.message);
      setFields(f.fields ?? {});
      setBusy(false);
    }
  }

  return (
    <div className="anim-up">
      <h1 className="text-4xl font-semibold">Create your account</h1>
      <p className="mb-6 mt-2 text-muted">Join Ebookvox to read, listen and build your library.</p>
      <SocialButtons verb="Sign up" next={next} />
      <form onSubmit={submit} className="space-y-4" noValidate>
        {error && Object.keys(fields).length === 0 && <Banner tone="danger">{error}</Banner>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="First name" id="su-first" name="given-name" autoComplete="given-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} error={fields.firstName} />
          <Input label="Last name" id="su-last" name="family-name" autoComplete="family-name" value={lastName} onChange={(e) => setLastName(e.target.value)} error={fields.lastName} />
        </div>
        <Input label="Email" id="su-email" name="email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" value={email} onChange={(e) => setEmail(e.target.value)} error={fields.email} />
        <Select label="Country" id="su-country" name="country" value={country} onChange={(e) => { setCountry(e.target.value); if (!phoneTouched) setPhoneCountry(e.target.value); }} error={fields.country}>
          {countries.map((c) => <option key={c.code} value={c.code} suppressHydrationWarning>{c.name}</option>)}
        </Select>
        <p className="-mt-2 text-xs text-muted">Prices will be shown in <strong>{currency}</strong> for this country.</p>
        <Field label="Phone number" id="su-phone" error={fields.phone} hint={dial ? `Country code +${dial} · digits only` : undefined}>
          {(f) => (
            <div className="flex gap-2">
              <select aria-label="Phone country code" id="su-dial" name="phone-country" value={phoneCountry} onChange={(e) => { setPhoneCountry(e.target.value); setPhoneTouched(true); }} className="h-12 w-[7.5rem] shrink-0 rounded-2xl border border-line bg-surface px-3 focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/25">
                {countries.map((c) => <option key={c.code} value={c.code} suppressHydrationWarning>{c.code} +{c.dial}</option>)}
              </select>
              <input {...f} name="tel-national" type="tel" inputMode="numeric" autoComplete="tel-national" pattern="[0-9]*" placeholder="8012345678" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))} className={`${f.className} h-12 min-w-0 flex-1`} />
            </div>
          )}
        </Field>
        <Input label="Password" id="su-password" name="new-password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} error={fields.password} hint="At least 8 characters with upper and lower case letters and a number." />
        <Input label="Confirm password" id="su-confirm" name="confirm-new-password" type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} error={fields.confirmPassword} />
        <TermsCheckbox checked={accepted} onChange={setAccepted} error={fields.acceptTerms} />
        <Button type="submit" size="lg" className="w-full" loading={busy}>Create Account</Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">Already have an account? <Link href={`/sign-in?next=${encodeURIComponent(next)}`} className="font-semibold text-accent hover:underline">Sign in</Link></p>
    </div>
  );
}

export default function SignUp() {
  return <Suspense><Form /></Suspense>;
}
