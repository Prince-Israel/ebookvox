import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { absolute: "Go ad-free on Ebookvox: from $1.80 a month" },
  description: "Remove all ads and the video before listening. $2 a month, or $1.80 a month on the yearly plan, shown in your local currency.",
  alternates: { canonical: "/subscribe" },
};

export default function SubscribeLayout({ children }: { children: React.ReactNode }) { return children; }
