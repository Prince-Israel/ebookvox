// A tiny stand-in for api.paystack.co used by the automated tests. It mimics
// /transaction/initialize and /transaction/verify so the server-side verification
// logic (amount / currency / status checks) can be exercised end to end.
import http from "node:http";

type Tx = { reference: string; amount: number; currency: string; email: string; status: "pending" | "success" | "failed" | "abandoned"; paidAmount?: number };
const txs = new Map<string, Tx>();

const json = (res: http.ServerResponse, code: number, body: unknown) => {
  res.writeHead(code, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
};

http
  .createServer((req, res) => {
    const url = new URL(req.url!, "http://x");
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      // test control: /__set/<ref>/<status>[/<paidAmount>]
      if (url.pathname.startsWith("/__set/")) {
        const [, , ref, status, paid] = url.pathname.split("/");
        const t = txs.get(ref);
        if (!t) return json(res, 404, { ok: false });
        t.status = status as Tx["status"];
        if (paid) t.paidAmount = Number(paid);
        return json(res, 200, { ok: true });
      }
      if (req.headers.authorization !== "Bearer sk_test_mock") return json(res, 401, { status: false, message: "Invalid key" });
      if (req.method === "POST" && url.pathname === "/transaction/initialize") {
        const b = JSON.parse(body);
        if (!["NGN", "USD", "GBP", "EUR"].includes(b.currency)) return json(res, 400, { status: false, message: "Currency not supported by merchant" });
        txs.set(b.reference, { reference: b.reference, amount: b.amount, currency: b.currency, email: b.email, status: "pending" });
        return json(res, 200, { status: true, message: "Authorization URL created", data: { authorization_url: `http://localhost:4010/pay/${b.reference}`, access_code: "ac_mock", reference: b.reference } });
      }
      if (req.method === "GET" && url.pathname.startsWith("/transaction/verify/")) {
        const t = txs.get(decodeURIComponent(url.pathname.split("/").pop()!));
        if (!t) return json(res, 404, { status: false, message: "Transaction reference not found" });
        return json(res, 200, { status: true, message: "Verification successful", data: { id: 9000 + [...txs.keys()].indexOf(t.reference), status: t.status, reference: t.reference, amount: t.paidAmount ?? t.amount, currency: t.currency, channel: "card", gateway_response: t.status === "failed" ? "Declined" : "Successful" } });
      }
      json(res, 404, { status: false, message: "not found" });
    });
  })
  .listen(4010, () => console.log("mock paystack on :4010"));
