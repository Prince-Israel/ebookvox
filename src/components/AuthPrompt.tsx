"use client";
import Link from "next/link";
import { LockKeyhole } from "lucide-react";
import { Button, Sheet } from "./ui";

/** Shown when a visitor tries something that needs an account (read aloud, purchase, read a book…). */
export function AuthPrompt({ open, onClose, next, reason }: { open: boolean; onClose: () => void; next: string; reason: string }) {
  const q = `?next=${encodeURIComponent(next)}`;
  return (
    <Sheet open={open} onClose={onClose} title="Create a free account to continue">
      <div className="space-y-5 text-center">
        <span className="mx-auto grid size-16 place-items-center rounded-full bg-accent-soft text-accent-fg"><LockKeyhole className="size-8" /></span>
        <p className="text-muted">{reason}</p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link href={`/sign-up${q}`} className="flex-1"><Button size="lg" className="w-full">Create Account</Button></Link>
          <Link href={`/sign-in${q}`} className="flex-1"><Button size="lg" variant="secondary" className="w-full">Sign In</Button></Link>
        </div>
      </div>
    </Sheet>
  );
}
