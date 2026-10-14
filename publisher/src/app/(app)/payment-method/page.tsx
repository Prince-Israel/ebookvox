"use client";
import { useEffect, useState } from "react";
import { Landmark, Mail } from "lucide-react";
import { Async, Banner, Button, Card, Input, PageTitle, Select, Skeleton, useToast } from "@/components/ui";
import { api, ApiFailure, useApi } from "@/lib/client";

type M = { required: "BANK" | "PAYPAL"; banks: Array<{ code: string; name: string }>; method: { type: string; bankCode: string | null; bankName: string | null; accountName: string | null; accountNumber: string | null; accountNumberMasked: string | null; paypalEmail: string | null } | null };

function Form({ d, reload }: { d: M; reload: () => void }) {
  const toast = useToast();
  const [bankCode, setBankCode] = useState(d.method?.bankCode ?? "");
  const [accountName, setAccountName] = useState(d.method?.accountName ?? "");
  const [accountNumber, setAccountNumber] = useState(d.method?.accountNumber ?? "");
  const [paypalEmail, setPaypalEmail] = useState(d.method?.paypalEmail ?? "");
  const [busy, setBusy] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { setFields({}); }, []);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setFields({}); setError(null);
    try { await api("/api/payment-method", { method: "PUT", json: d.required === "BANK" ? { bankCode, accountName, accountNumber } : { paypalEmail } }); toast("Payment method saved."); reload(); }
    catch (err) { setFields((err as ApiFailure).fields ?? {}); setError((err as ApiFailure).message); }
    setBusy(false);
  }
  return (
    <form onSubmit={save} className="space-y-4" noValidate>
      {error && Object.keys(fields).length === 0 && <Banner tone="danger">{error}</Banner>}
      {d.required === "BANK" ? (<>
        <Select label="Nigerian bank" id="pm-bank" value={bankCode} onChange={(e) => setBankCode(e.target.value)} error={fields.bankCode}><option value="">Select your bank…</option>{d.banks.map((b) => <option key={b.code} value={b.code}>{b.name}</option>)}</Select>
        <Input label="Account name" id="pm-name" value={accountName} onChange={(e) => setAccountName(e.target.value)} error={fields.accountName} autoComplete="off" />
        <Input label="Account number" id="pm-number" inputMode="numeric" maxLength={10} value={accountNumber} onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ""))} error={fields.accountNumber} hint="10-digit NUBAN account number" autoComplete="off" />
      </>) : (
        <Input label="PayPal email" id="pm-paypal" type="email" inputMode="email" value={paypalEmail} onChange={(e) => setPaypalEmail(e.target.value)} error={fields.paypalEmail} autoComplete="off" />
      )}
      <Button type="submit" loading={busy}>Save payment method</Button>
    </form>
  );
}

export default function PaymentMethodPage() {
  const state = useApi<M>("/api/payment-method", "We couldn't load your payment method. Please try again.");
  return (
    <div className="mx-auto max-w-2xl">
      <PageTitle title="Payment method" sub="Where we send your withdrawals." />
      <Async state={state} skeleton={<Skeleton className="h-80" />}>
        {(d) => (
          <div className="space-y-5">
            <Card className="flex items-center gap-4"><span className="grid size-12 place-items-center rounded-2xl bg-accent-soft text-accent-fg">{d.required === "BANK" ? <Landmark className="size-6" /> : <Mail className="size-6" />}</span>
              <div><p className="font-semibold">{d.required === "BANK" ? "Bank transfer (Nigeria)" : "PayPal (international)"}</p><p className="text-sm text-muted">{d.method ? (d.required === "BANK" ? `${d.method.bankName} · ${d.method.accountNumberMasked} · ${d.method.accountName}` : d.method.paypalEmail) : "Not set up yet"}</p></div></Card>
            <Card><Form key={d.method ? "set" : "new"} d={d} reload={state.reload} /></Card>
          </div>
        )}
      </Async>
    </div>
  );
}
