"use client";
import { useEffect, useState } from "react";
import { Check, Copy, MoreVertical, PlusSquare, Share } from "lucide-react";
import { Button, Sheet } from "@/components/ui";
import { LogoMark } from "@/components/Logo";
import { captureInstallPrompt, detectPlatform, type Platform } from "@/lib/install";

/** Starts listening for the browser's install offer as soon as the app opens (mounted once, in the root layout). */
export function InstallBootstrap() {
  useEffect(() => { captureInstallPrompt(); }, []);
  return null;
}

const Step = ({ n, children }: { n: number; children: React.ReactNode }) => (
  <li className="flex gap-3">
    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-fg">{n}</span>
    <span className="min-w-0 pt-1 leading-snug">{children}</span>
  </li>
);
const Chip = ({ children }: { children: React.ReactNode }) => <span className="mx-0.5 inline-flex items-center gap-1 rounded-lg bg-surface2 px-2 py-0.5 align-middle text-sm font-semibold">{children}</span>;

/** Step-by-step "Add to Home Screen" instructions for the person's own browser. */
export function InstallSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [p, setP] = useState<Platform | null>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => { if (open) setP(detectPlatform()); }, [open]);
  const url = typeof window !== "undefined" ? window.location.origin : "";

  async function share() {
    try { await navigator.share({ title: "Ebookvox", text: "Your Words. Our Voice.", url }); } catch { /* closed without choosing */ }
  }
  async function copy() {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {}
  }

  return (
    <Sheet open={open} onClose={onClose} title="Add Ebookvox to your Home Screen">
      <div className="space-y-5 text-left">
        <div className="flex items-center gap-4 rounded-2xl bg-surface2 p-4">
          <LogoMark size={56} />
          <div className="min-w-0">
            <p className="text-lg font-semibold">Ebookvox</p>
            <p className="text-sm text-muted">Opens like an app, full screen, with its own icon.</p>
          </div>
        </div>

        {p?.standalone ? (
          <p role="status" className="flex items-center gap-2 rounded-2xl bg-success-soft p-4 font-medium"><Check className="size-5" /> Ebookvox is already on your Home Screen.</p>
        ) : p?.ios ? (
          <>
            <ol className="space-y-4">
              {p.iosChrome ? (
                <>
                  <Step n={1}>Tap the <Chip><Share className="size-4" /> Share</Chip> button at the top right of the address bar.</Step>
                  <Step n={2}>Scroll down and tap <Chip><PlusSquare className="size-4" /> Add to Home Screen</Chip>.</Step>
                </>
              ) : (
                <>
                  <Step n={1}>Tap the <Chip><Share className="size-4" /> Share</Chip> button at the bottom of Safari.</Step>
                  <Step n={2}>Scroll down and tap <Chip><PlusSquare className="size-4" /> Add to Home Screen</Chip>.</Step>
                </>
              )}
              <Step n={3}>Tap <strong>Add</strong>. Ebookvox now appears on your Home Screen.</Step>
            </ol>
            {p.canShare && (
              <Button size="lg" className="w-full" onClick={share}><Share className="size-5" /> Open the Share menu</Button>
            )}
            <p className="text-center text-xs text-muted">Apple only lets you add a website to the Home Screen yourself, so this takes three taps.</p>
          </>
        ) : p?.android ? (
          <>
            <ol className="space-y-4">
              <Step n={1}>Tap the <Chip><MoreVertical className="size-4" /> menu</Chip> at the top right of Chrome.</Step>
              <Step n={2}>Tap <Chip><PlusSquare className="size-4" /> Install app</Chip> or <strong>Add to Home screen</strong>.</Step>
              <Step n={3}>Tap <strong>Install</strong>.</Step>
            </ol>
            <p className="text-center text-xs text-muted">You can also get the Ebookvox app from Google Play.</p>
          </>
        ) : (
          <>
            <ol className="space-y-4">
              <Step n={1}>On your iPhone, open <strong>Safari</strong> and go to <strong className="break-all">{url.replace(/^https?:\/\//, "")}</strong>.</Step>
              <Step n={2}>Tap the <Chip><Share className="size-4" /> Share</Chip> button, then <Chip><PlusSquare className="size-4" /> Add to Home Screen</Chip>.</Step>
              <Step n={3}>Tap <strong>Add</strong>.</Step>
            </ol>
            <Button variant="secondary" className="w-full" onClick={copy}>{copied ? <Check className="size-4" /> : <Copy className="size-4" />} {copied ? "Link copied" : "Copy the link to send to your phone"}</Button>
          </>
        )}
      </div>
    </Sheet>
  );
}
