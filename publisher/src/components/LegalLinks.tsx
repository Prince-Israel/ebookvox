"use client";
import { createContext, useContext } from "react";

const Base = createContext("");
export const LegalProvider = ({ readerUrl, children }: { readerUrl: string; children: React.ReactNode }) => <Base.Provider value={readerUrl}>{children}</Base.Provider>;
export const useLegalBase = () => useContext(Base);

const link = "font-medium text-accent underline underline-offset-2 hover:no-underline";

/** Opens a Reader legal page in a new tab. */
export function LegalLink({ page, children }: { page: "privacy" | "terms"; children: React.ReactNode }) {
  const base = useLegalBase();
  return <a href={`${base}/${page}`} target="_blank" rel="noopener" className={link}>{children}</a>;
}

/** "Privacy Policy · Terms & Conditions" for the bottom of Publisher pages. */
export function LegalFooter({ className = "" }: { className?: string }) {
  const base = useLegalBase();
  return (
    <footer className={`text-center text-xs text-muted ${className}`}>
      <nav aria-label="Legal" className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1">
        <a href={`${base}/privacy`} target="_blank" rel="noopener" className="py-2 hover:text-fg hover:underline">Privacy Policy</a>
        <a href={`${base}/terms`} target="_blank" rel="noopener" className="py-2 hover:text-fg hover:underline">Terms &amp; Conditions</a>
      </nav>
      <p>© {new Date().getFullYear()} Ebookvox</p>
    </footer>
  );
}

/** The "I agree to the Privacy Policy and Terms" checkbox used on sign-up. */
export function TermsCheckbox({ checked, onChange, error }: { checked: boolean; onChange: (v: boolean) => void; error?: string }) {
  return (
    <div>
      <div className="flex items-start gap-3">
        <input id="su-terms" name="acceptTerms" type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} aria-invalid={!!error} aria-describedby={error ? "su-terms-err" : undefined} className="mt-1 size-5 shrink-0 cursor-pointer rounded accent-[var(--accent)]" />
        <label htmlFor="su-terms" className="cursor-pointer text-sm leading-relaxed text-muted">
          I agree to the <LegalLink page="privacy">Privacy Policy</LegalLink> and the <LegalLink page="terms">Terms &amp; Conditions</LegalLink>.
        </label>
      </div>
      {error && <p id="su-terms-err" role="alert" className="mt-1.5 pl-8 text-sm text-danger">{error}</p>}
    </div>
  );
}
