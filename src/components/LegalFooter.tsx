import Link from "next/link";

/** "Privacy Policy · Terms & Conditions" links shown at the bottom of Reader pages. */
export function LegalFooter({ className = "" }: { className?: string }) {
  return (
    <footer className={`text-center text-xs text-muted ${className}`}>
      <nav aria-label="Legal" className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1">
        <Link href="/privacy" className="py-2 hover:text-fg hover:underline">Privacy Policy</Link>
        <Link href="/terms" className="py-2 hover:text-fg hover:underline">Terms &amp; Conditions</Link>
      </nav>
      <p>© {new Date().getFullYear()} Ebookvox</p>
    </footer>
  );
}
