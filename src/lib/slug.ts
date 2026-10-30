// Pure text helpers (safe for the browser as well as the server).
export const slugify = (s: string) =>
  s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);

export const clip = (s: string, n: number) => {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length <= n) return t;
  const cut = t.slice(0, n - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), n - 25))}…`;
};

/** "Doyle, Arthur Conan" → "Arthur Conan Doyle" (Gutenberg lists surnames first). */
export const displayAuthor = (a: string) => (/^[^,]+,\s*[^,]+$/.test(a) ? a.split(",").map((p) => p.trim()).reverse().join(" ") : a);

