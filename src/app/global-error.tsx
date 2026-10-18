"use client";

// Last-resort error screen (the whole page failed to render). Plain HTML/CSS on purpose: nothing here can itself fail.
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100dvh", display: "grid", placeItems: "center", background: "#fbf5ec", color: "#2a1d16", fontFamily: "system-ui, sans-serif", textAlign: "center", padding: 24 }}>
        <main style={{ maxWidth: 380 }}>
          <div style={{ fontFamily: "Georgia, serif", fontSize: 34, fontWeight: 600, marginBottom: 24 }}>Ebook<span style={{ color: "#ee8a5a" }}>vox</span></div>
          <h1 style={{ fontFamily: "Georgia, serif", fontSize: 28, margin: "0 0 8px" }}>Something went wrong</h1>
          <p style={{ color: "#7a6558", lineHeight: 1.5, margin: "0 0 24px" }}>We couldn&apos;t show this page. Check your internet connection and try again.</p>
          <button onClick={reset} style={{ minHeight: 52, padding: "0 32px", borderRadius: 999, border: 0, background: "#6b4a3a", color: "#fff", font: "600 17px system-ui", cursor: "pointer" }}>Try again</button>
        </main>
      </body>
    </html>
  );
}
