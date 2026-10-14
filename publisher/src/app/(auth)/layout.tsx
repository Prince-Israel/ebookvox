import Link from "next/link";
import { Logo } from "@/components/Logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_1.1fr]">
      <aside className="relative hidden overflow-hidden bg-[#3a261c] p-12 text-[#fbf1e4] lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(70% 55% at 30% 20%, #7b523f66, transparent), radial-gradient(50% 40% at 90% 100%, #ee9b6e40, transparent)" }} />
        <Link href="/" className="relative"><Logo size={44} className="[&_span]:text-[#fbf1e4] [&_span_span]:text-[#f6a67a]" /></Link>
        <div className="relative max-w-md">
          <h2 className="font-serif text-5xl font-semibold leading-tight">Your Words.<br />Our Voice.</h2>
          <p className="mt-5 text-lg text-[#e7d3bf]">Upload your books, reach listeners and readers, and earn 85% of every sale — with transparent reporting and fast payouts.</p>
        </div>
        <p className="relative text-sm text-[#c9b49f]">© {new Date().getFullYear()} Ebookvox</p>
      </aside>
      <main className="safe-t safe-b flex flex-col px-5 py-6 sm:px-10">
        <div className="mb-6 lg:hidden"><Link href="/"><Logo size={34} /></Link></div>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-4">{children}</div>
      </main>
    </div>
  );
}
