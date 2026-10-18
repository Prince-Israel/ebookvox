"use client";
import { useEffect } from "react";

const NO_KEYBOARD = new Set(["checkbox", "radio", "range", "file", "button", "submit", "reset", "color", "image"]);
const isField = (el: Element | null): el is HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement =>
  !!el && (el.tagName === "TEXTAREA" || el.tagName === "SELECT" || (el.tagName === "INPUT" && !NO_KEYBOARD.has((el as HTMLInputElement).type))) || (el as HTMLElement | null)?.isContentEditable === true;

/**
 * Keeps whatever the user is typing in view on phones. When the on-screen keyboard opens it:
 *  - scrolls the focused field to the middle of the part of the screen the keyboard leaves free,
 *  - marks <html data-kb="open"> and sets --kb (the keyboard's height) so fixed bars can step aside and the page can scroll far enough.
 */
export function KeyboardAware() {
  useEffect(() => {
    const vv = window.visualViewport;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const root = document.documentElement;
    // The tallest the window has been while no field was focused: what "no keyboard" looks like (Android shrinks the window when the keyboard opens).
    let baseline = window.innerHeight;
    const trackBaseline = () => { if (!isField(document.activeElement)) baseline = Math.max(baseline, window.innerHeight, vv?.height ?? 0); };
    let lastW = window.innerWidth; // a change of width means the phone was rotated, not that a keyboard opened

    const reveal = () => {
      const el = document.activeElement;
      if (!isField(el)) return;
      clearTimeout(timer);
      // wait for the keyboard animation to settle, then centre the field in what's left of the screen
      timer = setTimeout(() => {
        if (document.activeElement !== el) return;
        const view = vv?.height ?? window.innerHeight;
        const top = vv?.offsetTop ?? 0;
        const r = el.getBoundingClientRect();
        const room = view - r.height;
        const want = top + Math.max(16, room / 2 - 24); // a little above centre, so the label above stays visible
        if (r.top < top + 8 || r.bottom > top + view - 8 || Math.abs(r.top - want) > view * 0.2) window.scrollBy({ top: r.top - want, behavior: "smooth" });
        el.scrollIntoView({ block: "nearest", behavior: "smooth" }); // also scrolls an enclosing sheet / dialog
      }, 280);
    };

    const sync = () => {
      if (window.innerWidth !== lastW) { lastW = window.innerWidth; baseline = window.innerHeight; }
      trackBaseline();
      const kb = vv ? Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)) : 0;
      const shrunk = !!vv && vv.height < baseline * 0.8; // Android resizes the page instead
      const open = isField(document.activeElement) && (kb > 80 || shrunk);
      root.dataset.kb = open ? "open" : "closed";
      root.style.setProperty("--kb", `${kb}px`);
      if (open) reveal();
    };

    const onFocusIn = () => { reveal(); setTimeout(sync, 120); setTimeout(sync, 450); };
    const onFocusOut = () => setTimeout(() => { if (!isField(document.activeElement)) { root.dataset.kb = "closed"; root.style.setProperty("--kb", "0px"); } }, 80);

    vv?.addEventListener("resize", sync);
    vv?.addEventListener("scroll", sync);
    window.addEventListener("resize", sync);
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    return () => {
      clearTimeout(timer);
      vv?.removeEventListener("resize", sync);
      vv?.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
    };
  }, []);
  return null;
}
