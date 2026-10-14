"use client";
import { createContext, useCallback, useContext, useEffect, useId, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { AlertTriangle, CheckCircle2, Loader2, RotateCw, X } from "lucide-react";
import clsx from "clsx";

export const cx = clsx;

export function Spinner({ className = "" }: { className?: string }) {
  return <Loader2 className={cx("animate-spin", className)} aria-hidden />;
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger" | "accent"; size?: "sm" | "md" | "lg"; loading?: boolean };
export function Button({ variant = "primary", size = "md", loading, className, children, disabled, ...p }: BtnProps) {
  const v = {
    primary: "bg-primary text-primary-fg hover:bg-primary-hover shadow-card",
    accent: "bg-accent text-accent-fg hover:brightness-95 shadow-card",
    secondary: "bg-surface text-fg border border-line hover:bg-surface2",
    ghost: "text-fg hover:bg-surface2",
    danger: "bg-danger-soft text-danger border border-danger/30 hover:brightness-95",
  }[variant];
  const s = { sm: "h-9 px-4 text-sm", md: "h-11 px-5 text-[15px]", lg: "h-14 px-7 text-base" }[size];
  return (
    <button
      {...p}
      disabled={disabled || loading}
      className={cx("inline-flex select-none items-center justify-center gap-2 rounded-full font-medium transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55", v, s, className)}
    >
      {loading && <Spinner className="size-4" />}
      {children}
    </button>
  );
}

export function Card({ className, children, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...p} className={cx("rounded-3xl border border-line bg-surface p-5 shadow-card sm:p-6", className)}>
      {children}
    </div>
  );
}

const fieldBase = "w-full rounded-2xl border bg-surface px-4 text-fg placeholder:text-muted/70 transition focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/25";

export function Field({ label, error, hint, children, id }: { label: string; error?: string; hint?: string; children: (p: { id: string; "aria-invalid": boolean; "aria-describedby"?: string; className: string }) => ReactNode; id?: string }) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <div className="space-y-1.5">
      <label htmlFor={fid} className="block text-sm font-medium">
        {label}
      </label>
      {children({ id: fid, "aria-invalid": !!error, "aria-describedby": error ? `${fid}-e` : hint ? `${fid}-h` : undefined, className: cx(fieldBase, error ? "border-danger" : "border-line") })}
      {error ? (
        <p id={`${fid}-e`} role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${fid}-h`} className="text-xs text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

type InProps = InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; hint?: string };
export function Input({ label, error, hint, className, ...p }: InProps) {
  return <Field label={label} error={error} hint={hint} id={p.id}>{(f) => <input {...p} {...f} className={cx(f.className, "h-12", className)} />}</Field>;
}
export function Select({ label, error, children, className, ...p }: SelectHTMLAttributes<HTMLSelectElement> & { label: string; error?: string }) {
  return <Field label={label} error={error} id={p.id}>{(f) => <select {...p} {...f} className={cx(f.className, "h-12 appearance-none bg-[length:1rem] pr-9", className)}>{children}</select>}</Field>;
}
export function Textarea({ label, error, hint, className, ...p }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; error?: string; hint?: string }) {
  return <Field label={label} error={error} hint={hint} id={p.id}>{(f) => <textarea {...p} {...f} className={cx(f.className, "py-3 leading-relaxed", className)} />}</Field>;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("skeleton", className)} aria-hidden />;
}

export function EmptyState({ icon, title, body, action }: { icon: ReactNode; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="anim-in flex flex-col items-center rounded-3xl border border-dashed border-line bg-surface/60 px-6 py-12 text-center">
      <div className="mb-4 grid size-16 place-items-center rounded-full bg-accent-soft text-accent-fg">{icon}</div>
      <h3 className="text-xl font-semibold">{title}</h3>
      {body && <p className="mt-2 max-w-sm text-sm text-muted">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center rounded-3xl border border-danger/30 bg-danger-soft px-6 py-10 text-center">
      <AlertTriangle className="mb-3 size-9 text-danger" />
      <p className="max-w-sm text-sm font-medium text-fg">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry}>
          <RotateCw className="size-4" /> Try again
        </Button>
      )}
    </div>
  );
}

/** One component that gives every section its loading / error / empty / content states. */
export function Async<T>({ state, skeleton, isEmpty, empty, children }: { state: { data: T | null; error: string | null; loading: boolean; reload: () => void }; skeleton: ReactNode; isEmpty?: (d: T) => boolean; empty?: ReactNode; children: (d: T) => ReactNode }) {
  if (state.error && !state.data) return <ErrorState message={state.error} onRetry={state.reload} />;
  if (!state.data) return <>{skeleton}</>;
  if (isEmpty?.(state.data)) return <>{empty}</>;
  return <>{children(state.data)}</>;
}

export function Banner({ tone = "info", children, action }: { tone?: "info" | "success" | "danger" | "warn"; children: ReactNode; action?: ReactNode }) {
  const t = { info: "bg-accent-soft text-accent-fg", success: "bg-success-soft text-success", danger: "bg-danger-soft text-danger", warn: "bg-warn-soft text-warn" }[tone];
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cx("flex flex-wrap items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium", t)}>
      <div className="min-w-0 flex-1">{children}</div>
      {action}
    </div>
  );
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "success" | "danger" | "warn" | "accent" }) {
  const t = { neutral: "bg-surface2 text-muted", success: "bg-success-soft text-success", danger: "bg-danger-soft text-danger", warn: "bg-warn-soft text-warn", accent: "bg-accent-soft text-accent-fg" }[tone];
  return <span className={cx("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold", t)}>{children}</span>;
}

// ---- toasts ----
type Toast = { id: number; msg: string; tone: "success" | "error" };
const ToastCtx = createContext<(msg: string, tone?: Toast["tone"]) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [list, setList] = useState<Toast[]>([]);
  const push = useCallback((msg: string, tone: Toast["tone"] = "success") => {
    const id = Date.now() + Math.random();
    setList((l) => [...l, { id, msg, tone }]);
    setTimeout(() => setList((l) => l.filter((t) => t.id !== id)), 4500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-3 z-[100] flex flex-col items-center gap-2 px-4" aria-live="polite">
        {list.map((t) => (
          <div key={t.id} className={cx("anim-up pointer-events-auto flex max-w-md items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium shadow-pop", t.tone === "success" ? "bg-fg text-bg" : "bg-danger text-white")}>
            {t.tone === "success" ? <CheckCircle2 className="size-5 shrink-0" /> : <AlertTriangle className="size-5 shrink-0" />}
            {t.msg}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", k);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", k);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="anim-in absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="anim-up relative flex max-h-[88dvh] w-full flex-col rounded-t-[2rem] bg-surface shadow-pop sm:max-w-2xl sm:rounded-[2rem]">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-xl font-semibold">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="grid size-10 place-items-center rounded-full hover:bg-surface2">
            <X className="size-5" />
          </button>
        </div>
        <div className="safe-b min-h-0 flex-1 overflow-y-auto overscroll-contain p-5">{children}</div>
      </div>
    </div>
  );
}

export function PageTitle({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-3xl font-semibold sm:text-4xl">{title}</h1>
        {sub && <p className="mt-1 text-muted">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export const when = (d: string | Date | null | undefined) =>
  d ? new Date(d).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "";
