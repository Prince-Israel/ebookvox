import type { Metadata, Viewport } from "next";
import "@fontsource-variable/fraunces";
import "@fontsource-variable/inter";
import "./globals.css";
import { ToastProvider } from "@/components/ui";
import { KeyboardAware } from "@/components/KeyboardAware";
import { NativeBridge } from "@/components/NativeBridge";
import { GeoHint } from "@/components/GeoHint";

export const metadata: Metadata = {
  title: { default: "Ebookvox — Your Words. Our Voice.", template: "%s · Ebookvox" },
  description: "Read, listen and discover books. Turn any text or document into natural-sounding speech.",
  applicationName: "Ebookvox",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/favicon.png", apple: "/icons/icon-180.png" },
  appleWebApp: { capable: true, title: "Ebookvox", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content", // on Android the page shrinks to the space above the keyboard
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#fbf5ec" }, { media: "(prefers-color-scheme: dark)", color: "#17110e" }],
};

// Runs before first paint so there is no light/dark flash.
const themeScript = `try{var t=localStorage.getItem('ev-theme')||'system';var d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light'}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <ToastProvider>{children}</ToastProvider>
        <KeyboardAware />
        <NativeBridge />
        <GeoHint />
      </body>
    </html>
  );
}
