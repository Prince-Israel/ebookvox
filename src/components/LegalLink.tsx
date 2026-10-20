"use client";
import { isNativeApp } from "@/lib/public-config";

/** A link to a legal page that opens in a new tab on the web and in the in-app browser inside the mobile apps (so a half-filled form is never lost). */
export function LegalLink({ href, children }: { href: string; children: React.ReactNode }) {
  async function open(e: React.MouseEvent) {
    if (!isNativeApp()) return;
    e.preventDefault();
    try {
      const { Browser } = await import("@capacitor/browser");
      await Browser.open({ url: new URL(href, window.location.origin).toString() });
    } catch { window.open(href, "_blank"); }
  }
  return <a href={href} target="_blank" rel="noopener" onClick={open} className="font-medium text-accent underline underline-offset-2 hover:no-underline">{children}</a>;
}

/** The "I agree to the Privacy Policy and Terms" checkbox used on sign-up. */
export function TermsCheckbox({ checked, onChange, error, legalBase = "" }: { checked: boolean; onChange: (v: boolean) => void; error?: string; legalBase?: string }) {
  return (
    <div>
      <div className="flex items-start gap-3">
        <input id="su-terms" name="acceptTerms" type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} aria-invalid={!!error} aria-describedby={error ? "su-terms-err" : undefined} className="mt-1 size-5 shrink-0 cursor-pointer rounded accent-[var(--accent)]" />
        <label htmlFor="su-terms" className="cursor-pointer text-sm leading-relaxed text-muted">
          I agree to the <LegalLink href={`${legalBase}/privacy`}>Privacy Policy</LegalLink> and the <LegalLink href={`${legalBase}/terms`}>Terms &amp; Conditions</LegalLink>.
        </label>
      </div>
      {error && <p id="su-terms-err" role="alert" className="mt-1.5 pl-8 text-sm text-danger">{error}</p>}
    </div>
  );
}
