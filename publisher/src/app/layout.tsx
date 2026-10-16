import type { Metadata, Viewport } from "next";
import "@fontsource-variable/fraunces";
import "@fontsource-variable/inter";
import "./globals.css";
import { ToastProvider } from "@/components/ui";
import { KeyboardAware } from "@/components/KeyboardAware";

export const metadata: Metadata = {
  title: { default: "Ebookvox Publisher — Your Words. Our Voice.", template: "%s · Ebookvox Publisher" },
  description: "Upload, publish, sell and earn from your books on Ebookvox.",
  icons: { icon: "/favicon.png", apple: "/icons/icon-180.png" },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: [{ media: "(prefers-color-scheme: light)", color: "#fbf5ec" }, { media: "(prefers-color-scheme: dark)", color: "#17110e" }] };

const themeScript = `try{var t=localStorage.getItem('evp-theme')||'system';var d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light'}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body><ToastProvider>{children}</ToastProvider>
        <KeyboardAware /></body>
    </html>
  );
}
