"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, ImagePlus, Save, Send } from "lucide-react";
import { Banner, Button, Card, Input, Select, Textarea, cx, useToast } from "./ui";
import { api, ApiFailure, upload } from "@/lib/client";
import { SUGGEST_PER_USD } from "@/lib/config";
import { formatMoney } from "@/lib/money";
import { useUser } from "./UserContext";

export type BookDto = {
  id: string; title: string; author: string; category: string; description: string; isFree: boolean; status: string; rejectionReason: string | null;
  coverUrl: string | null; hasFile: boolean; fileName: string | null; fileKind: string | null; fileSize: number; prices: Record<string, number>;
};
const CUR = ["NGN", "USD", "GBP", "EUR"] as const;
const major = (m?: number) => (m ? String(m / 100) : "");
const sizeLabel = (n: number) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export function BookForm({ book }: { book?: BookDto }) {
  const { user } = useUser();
  const router = useRouter();
  const toast = useToast();
  // each input has its own state
  const [title, setTitle] = useState(book?.title ?? "");
  const [author, setAuthor] = useState(book?.author ?? user.publisherName);
  const [category, setCategory] = useState(book?.category ?? "");
  const [description, setDescription] = useState(book?.description ?? "");
  const [isFree, setIsFree] = useState(book?.isFree ?? false);
  const [prices, setPrices] = useState<Record<string, string>>(Object.fromEntries(CUR.map((c) => [c, major(book?.prices[c])])));
  const [cover, setCover] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(book?.coverUrl ?? null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState<null | "draft" | "submit">(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [step, setStep] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const coverRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [categories, setCategories] = useState<string[]>(book ? [book.category] : []);
  useEffect(() => { api<{ categories: string[] }>("/api/config").then((c) => setCategories(c.categories)).catch(() => {}); }, []);
  const primary = user.currency;
  function suggest() {
    const base = Number(prices[primary]);
    if (!base) return toast(`Enter the ${primary} price first.`, "error");
    const usd = base / SUGGEST_PER_USD[primary];
    setPrices(Object.fromEntries(CUR.map((c) => [c, c === primary ? prices[c] : String(Math.round(usd * SUGGEST_PER_USD[c] * (c === "NGN" ? 1 : 100)) / (c === "NGN" ? 1 : 100))])));
  }

  function pickCover(f?: File) {
    if (!f) return;
    setCover(f);
    setCoverPreview(URL.createObjectURL(f));
  }

  async function save(submit: boolean) {
    setError(null);
    setFields({});
    setBusy(submit ? "submit" : "draft");
    setProgress(0);
    setStep("Uploading…");
    const fd = new FormData();
    fd.append("title", title);
    fd.append("author", author);
    fd.append("category", category);
    fd.append("description", description);
    fd.append("isFree", String(isFree));
    fd.append("prices", JSON.stringify(isFree ? {} : Object.fromEntries(CUR.map((c) => [c, Math.round(Number(prices[c] || 0) * 100)]))));
    if (cover) fd.append("cover", cover);
    if (file) fd.append("file", file);
    try {
      const r = await upload<{ id: string }>(book ? `/api/books/${book.id}` : "/api/books", book ? "PATCH" : "POST", fd, (p) => { setProgress(p); if (p >= 100) setStep("Checking your file…"); });
      if (submit) {
        setStep("Submitting for review…");
        await api(`/api/books/${r.id}/submit`, { method: "POST" });
        toast("Submitted — our team will review your book.");
      } else toast("Draft saved.");
      router.push(`/books/${r.id}`);
      router.refresh();
    } catch (e) {
      const f = e as ApiFailure;
      setError(f.message);
      setFields(f.fields ?? {});
      setBusy(null);
      setProgress(null);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  const priceErr = Object.entries(fields).filter(([k]) => k.startsWith("price_"));
  return (
    <form onSubmit={(e) => { e.preventDefault(); void save(false); }} className="space-y-6" noValidate>
      {book?.status === "REJECTED" && <Banner tone="danger"><strong>Rejected by Admin:</strong> {book.rejectionReason}<br />Fix the issues below, then resubmit.</Banner>}
      {error && <Banner tone="danger">{error}</Banner>}
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <Card className="space-y-4">
          <Input label="Book title" id="bk-title" value={title} onChange={(e) => setTitle(e.target.value)} error={fields.title} maxLength={200} />
          <Input label="Author name" id="bk-author" value={author} onChange={(e) => setAuthor(e.target.value)} error={fields.author} maxLength={150} />
          <Select label="Category" id="bk-category" value={category} onChange={(e) => setCategory(e.target.value)} error={fields.category}>
            <option value="">Select a category…</option>{Array.from(new Set([...categories, ...(category ? [category] : [])])).map((c) => <option key={c}>{c}</option>)}
          </Select>
          <Textarea label="Description" id="bk-desc" rows={6} value={description} onChange={(e) => setDescription(e.target.value)} error={fields.description} hint={`${description.trim().length} / 5000 · at least 30 characters to submit`} />
        </Card>

        <div className="space-y-6">
          <Card>
            <p className="mb-3 text-sm font-medium">Book cover</p>
            <button type="button" onClick={() => coverRef.current?.click()} className={cx("group relative block aspect-[2/3] w-full overflow-hidden rounded-2xl border-2 border-dashed bg-surface2/60 transition hover:bg-surface2", fields.cover ? "border-danger" : "border-line")} aria-label={coverPreview ? "Replace cover" : "Upload cover"}>
              {coverPreview ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={coverPreview} alt="Cover preview" className="size-full object-cover" /> : <span className="grid size-full place-items-center p-4 text-center text-sm text-muted"><span><ImagePlus className="mx-auto mb-2 size-9 text-accent" />Tap to upload<br />JPG, PNG or WebP · min 300×400</span></span>}
            </button>
            <input ref={coverRef} id="bk-cover" type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label="Book cover file" onChange={(e) => pickCover(e.target.files?.[0])} />
            {fields.cover && <p role="alert" className="mt-2 text-sm text-danger">{fields.cover}</p>}
            {coverPreview && <Button type="button" size="sm" variant="secondary" className="mt-3 w-full" onClick={() => coverRef.current?.click()}>Replace cover</Button>}
          </Card>
          <Card>
            <p className="mb-3 text-sm font-medium">Book file</p>
            <button type="button" onClick={() => fileRef.current?.click()} className={cx("flex w-full items-center gap-3 rounded-2xl border-2 border-dashed p-4 text-left transition hover:bg-surface2", fields.file ? "border-danger" : "border-line")}>
              <FileText className="size-8 shrink-0 text-accent" />
              <span className="min-w-0 text-sm">{file ? <><strong className="block truncate">{file.name}</strong><span className="text-muted">{sizeLabel(file.size)}</span></> : book?.hasFile ? <><strong className="block truncate">{book.fileName}</strong><span className="text-muted">{sizeLabel(book.fileSize)} · tap to replace</span></> : <><strong>Choose PDF, DOCX or TXT</strong><span className="block text-muted">up to 15 MB</span></>}</span>
            </button>
            <input ref={fileRef} id="bk-file" type="file" accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" className="sr-only" aria-label="Book file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            {fields.file && <p role="alert" className="mt-2 text-sm text-danger">{fields.file}</p>}
          </Card>
        </div>
      </div>

      <Card className="space-y-4">
        <h2 className="text-xl font-semibold">Pricing</h2>
        <div className="flex gap-2" role="radiogroup" aria-label="Free or paid">
          {[[false, "Paid"], [true, "Free"]].map(([v, l]) => <button key={String(l)} type="button" role="radio" aria-checked={isFree === v} onClick={() => setIsFree(v as boolean)} className={cx("h-11 flex-1 rounded-full text-sm font-semibold transition sm:flex-none sm:px-10", isFree === v ? "bg-primary text-primary-fg" : "bg-surface2 hover:bg-line")}>{l as string}</button>)}
        </div>
        {isFree ? <p className="text-sm text-muted">Free books are available to every reader at no cost. They earn no revenue.</p> : (
          <>
            <p className="text-sm text-muted">Readers pay in their own currency, so set a price for each. Your primary currency is <strong className="text-fg">{primary}</strong>. You earn 85% of every sale.</p>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {CUR.map((c) => <Input key={c} label={`Price (${c})${c === primary ? " · primary" : ""}`} id={`bk-price-${c}`} type="text" inputMode="decimal" value={prices[c]} onChange={(e) => setPrices({ ...prices, [c]: e.target.value.replace(/[^0-9.]/g, "") })} error={fields[`price_${c}`]} placeholder="0.00" hint={prices[c] ? `You earn ${formatMoney(Math.floor(Number(prices[c]) * 85), c)}` : undefined} />)}
            </div>
            <Button type="button" size="sm" variant="secondary" onClick={suggest}>Suggest other currencies from {primary} price</Button>
            <p className="text-xs text-muted">Suggestions use indicative exchange rates — review and edit every price before submitting.</p>
          </>
        )}
      </Card>

      {busy && progress !== null && (
        <div role="status" aria-live="polite" className="rounded-2xl border border-line bg-surface p-4">
          <div className="mb-2 flex justify-between text-sm"><span className="font-medium">{step}</span><span className="tabular-nums text-muted">{progress}%</span></div>
          <div className="h-2.5 overflow-hidden rounded-full bg-surface2"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} /></div>
        </div>
      )}
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button type="submit" size="lg" variant="secondary" loading={busy === "draft"} disabled={!!busy} className="sm:min-w-44"><Save className="size-5" /> Save Draft</Button>
        <Button type="button" size="lg" loading={busy === "submit"} disabled={!!busy} onClick={() => save(true)} className="sm:min-w-52"><Send className="size-5" /> {book?.status === "REJECTED" ? "Resubmit for Review" : "Submit for Review"}</Button>
      </div>
      {priceErr.length > 0 && <p className="sr-only">Some prices are missing.</p>}
    </form>
  );
}
