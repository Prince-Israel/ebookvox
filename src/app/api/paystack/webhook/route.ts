import { NextRequest, NextResponse } from "next/server";
import { validSignature, settlePayment } from "@/lib/paystack";

export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!validSignature(raw, req.headers.get("x-paystack-signature"))) return new NextResponse("invalid signature", { status: 401 });
  try {
    const evt = JSON.parse(raw) as { event: string; data?: { reference?: string } };
    if (evt.event?.startsWith("charge.") && evt.data?.reference) await settlePayment(evt.data.reference);
  } catch (e) {
    console.error("[paystack webhook]", e);
    return new NextResponse("error", { status: 500 });
  }
  return new NextResponse("ok");
}
