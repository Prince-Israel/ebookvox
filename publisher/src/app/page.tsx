import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { Logo } from "@/components/Logo";

export default async function Landing() {
  const u = await getUser();
  if (u) redirect(u.role === "ADMIN" ? "/admin" : "/dashboard");
  const points = [["Upload", "PDF, DOCX or TXT with a beautiful cover — we turn it into a reader-ready, listenable book."], ["Review", "Every book is checked by our team. Track status and see feedback if changes are needed."], ["Earn 85%", "Keep 85% of every verified sale, in the currency the reader paid. Withdraw to your bank or PayPal."]];
  return (
    <main className="mx-auto flex min-h-dvh max-w-5xl flex-col px-6 py-8">
      <header className="flex items-center justify-between"><Logo size={38} /><nav className="flex gap-2"><Link href="/sign-in" className="rounded-full px-5 py-2.5 font-medium hover:bg-surface2">Sign in</Link><Link href="/sign-up" className="rounded-full bg-primary px-5 py-2.5 font-medium text-primary-fg">Create account</Link></nav></header>
      <section className="flex flex-1 flex-col justify-center py-16">
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-accent">Your Words. Our Voice.</p>
        <h1 className="mt-4 max-w-3xl font-serif text-5xl font-semibold leading-[1.05] sm:text-7xl">Publish. Be heard. Get paid.</h1>
        <p className="mt-6 max-w-xl text-lg text-muted">Ebookvox Publisher is the professional home for authors and publishers to upload, manage, sell and monetise books for readers and listeners.</p>
        <div className="mt-8 flex flex-wrap gap-3"><Link href="/sign-up" className="rounded-full bg-primary px-8 py-4 font-medium text-primary-fg shadow-card">Start publishing</Link><Link href="/sign-in" className="rounded-full border border-line bg-surface px-8 py-4 font-medium">Sign in</Link></div>
        <div className="mt-16 grid gap-4 sm:grid-cols-3">{points.map(([t, b]) => <div key={t} className="rounded-3xl border border-line bg-surface p-6 shadow-card"><h2 className="text-2xl font-semibold">{t}</h2><p className="mt-2 text-sm text-muted">{b}</p></div>)}</div>
      </section>
    </main>
  );
}
