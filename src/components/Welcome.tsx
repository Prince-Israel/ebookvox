"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, BookOpen, Eye, Headphones, Library, Mic2 } from "lucide-react";
import { Logo, LogoMark } from "./Logo";
import { Button, cx } from "./ui";

const SLIDES = [
  { title: "Read with your eyes.", body: "A calm, beautiful reader with your place saved on every device.", Icon: Eye, tone: "from-[#f6c9a8] to-[#e58f63]" },
  { title: "Listen with your ears.", body: "Turn any book or document into natural speech with a premium audio player.", Icon: Headphones, tone: "from-[#c99a7e] to-[#7b523f]" },
  { title: "Discover books.", body: "Browse free and paid titles, pay securely, and keep them in your library forever.", Icon: Library, tone: "from-[#f2dcc3] to-[#c89a76]" },
  { title: "Give your words a voice.", body: "Paste text or upload a PDF, DOCX or TXT and hear it read in 30+ distinct voices.", Icon: Mic2, tone: "from-[#8a5a44] to-[#3f2a1f]" },
] as const;

function Bars({ className = "" }: { className?: string }) {
  return (
    <div className={cx("flex h-16 items-center gap-1.5", className)} aria-hidden>
      {Array.from({ length: 21 }, (_, i) => (
        <span key={i} className="w-1.5 rounded-full bg-accent" style={{ height: `${28 + ((i * 37) % 60)}%`, animation: `wave ${1.1 + (i % 5) * 0.18}s ease-in-out ${(i % 7) * 0.09}s infinite` }} />
      ))}
    </div>
  );
}

export function Welcome() {
  const [stage, setStage] = useState<"splash" | "onboarding">("splash");
  const [i, setI] = useState(0);

  useEffect(() => {
    let seen = false;
    try { seen = localStorage.getItem("ev-onboarded") === "1"; } catch {}
    if (seen) setI(SLIDES.length - 1);
    const t = setTimeout(() => setStage("onboarding"), 2600);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (i === SLIDES.length - 1) try { localStorage.setItem("ev-onboarded", "1"); } catch {}
  }, [i]);

  if (stage === "splash")
    return (
      <main className="relative grid min-h-dvh place-items-center overflow-hidden bg-[#3a261c] px-6 text-center text-[#fbf1e4]">
        <div className="pointer-events-none absolute inset-0 opacity-60" style={{ background: "radial-gradient(60% 50% at 50% 40%, #7b523f55, transparent), radial-gradient(40% 40% at 80% 90%, #ee9b6e33, transparent)" }} />
        <div className="relative flex flex-col items-center">
          <div className="anim-up" style={{ animation: "fade-up .8s both, float 5s ease-in-out .8s infinite" }}>
            <LogoMark size={116} />
          </div>
          <h1 className="anim-up mt-8 font-serif text-5xl font-semibold tracking-tight [animation-delay:.25s] sm:text-6xl">Ebook<span className="text-[#f6a67a]">vox</span></h1>
          <p className="anim-up mt-3 font-serif text-xl italic text-[#f3dfc9] [animation-delay:.5s]">Your Words. Our Voice.</p>
          <Bars className="anim-in mt-10 [animation-delay:.8s]" />
        </div>
      </main>
    );

  const s = SLIDES[i];
  const last = i === SLIDES.length - 1;
  return (
    <main className="safe-t safe-b mx-auto flex min-h-dvh max-w-5xl flex-col px-6 py-6 lg:px-10">
      <header className="flex items-center justify-between">
        <Logo size={34} />
        {!last && (
          <button onClick={() => setI(SLIDES.length - 1)} className="h-10 rounded-full px-4 text-sm font-medium text-muted hover:bg-surface2">Skip</button>
        )}
      </header>

      <section className="grid flex-1 items-center gap-8 py-8 lg:grid-cols-2 lg:gap-16" aria-live="polite">
        <div key={i} className="anim-up relative mx-auto aspect-square w-full max-w-sm lg:order-2 lg:max-w-md">
          <div className={cx("absolute inset-0 rounded-[3rem] bg-gradient-to-br shadow-pop", s.tone)} />
          <div className="absolute inset-6 rounded-[2.2rem] border border-white/30" />
          <div className="absolute inset-0 grid place-items-center">
            <div className="relative grid size-40 place-items-center rounded-full bg-white/25 backdrop-blur">
              <s.Icon className="size-20 text-white drop-shadow" strokeWidth={1.4} />
              <BookOpen className="absolute -bottom-3 -right-3 size-14 rounded-2xl bg-[#fbf1e4] p-3 text-[#6b4a3a] shadow-card" />
            </div>
          </div>
          <Bars className="absolute inset-x-0 bottom-8 justify-center opacity-90 [&>span]:bg-white/80" />
        </div>
        <div key={`t${i}`} className="anim-up text-center lg:text-left">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-accent">{i + 1} / {SLIDES.length}</p>
          <h1 className="font-serif text-4xl font-semibold leading-tight sm:text-5xl">{s.title}</h1>
          <p className="mx-auto mt-4 max-w-md text-lg text-muted lg:mx-0">{s.body}</p>
        </div>
      </section>

      <footer className="space-y-5 pb-2">
        <div className="flex justify-center gap-2" role="tablist" aria-label="Onboarding steps">
          {SLIDES.map((_, n) => (
            <button key={n} role="tab" aria-selected={n === i} aria-label={`Go to step ${n + 1}`} onClick={() => setI(n)} className={cx("h-2.5 rounded-full transition-all", n === i ? "w-8 bg-primary" : "w-2.5 bg-line")} />
          ))}
        </div>
        {last ? (
          <div className="mx-auto flex max-w-md flex-col gap-3 sm:flex-row">
            <Link href="/sign-up" className="flex-1"><Button size="lg" className="w-full">Create Account</Button></Link>
            <Link href="/sign-in" className="flex-1"><Button size="lg" variant="secondary" className="w-full">Sign In</Button></Link>
          </div>
        ) : (
          <div className="mx-auto flex max-w-md gap-3">
            {i > 0 && <Button size="lg" variant="secondary" onClick={() => setI(i - 1)}>Back</Button>}
            <Button size="lg" className="flex-1" onClick={() => setI(i + 1)}>Next <ArrowRight className="size-5" /></Button>
          </div>
        )}
      </footer>
    </main>
  );
}
