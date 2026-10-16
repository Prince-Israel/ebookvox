"use client";
// Bridge to the native "BackgroundAudio" plugin (Android foreground service). It does nothing in a normal browser.
type Handle = { remove: () => void };
type Plugin = {
  start: (o: { title: string; text: string }) => Promise<unknown>;
  stop: () => Promise<unknown>;
  addListener: (event: string, cb: () => void) => Promise<Handle> | Handle;
};
const plugin = (): Plugin | null => {
  if (typeof window === "undefined") return null;
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean; Plugins?: Record<string, Plugin> } }).Capacitor;
  return cap?.isNativePlatform?.() ? cap.Plugins?.BackgroundAudio ?? null : null;
};

export const backgroundAudio = {
  start(title: string, text: string) { try { void Promise.resolve(plugin()?.start({ title, text })).catch(() => {}); } catch {} },
  stop() { try { void Promise.resolve(plugin()?.stop()).catch(() => {}); } catch {} },
  /** Called when the listener taps "Stop" on the reading notification. */
  onStopRequested(cb: () => void) {
    let handle: Handle | undefined;
    let gone = false;
    // Never let a native-bridge hiccup take the whole app down: the plugin may hand back a promise or the handle itself.
    try {
      void Promise.resolve(plugin()?.addListener("stopRequested", cb)).then((h) => { if (!h) return; if (gone) h.remove(); else handle = h; }).catch(() => {});
    } catch {}
    return () => { gone = true; handle?.remove(); };
  },
};
