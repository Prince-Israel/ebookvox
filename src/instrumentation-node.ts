import { flushOutbox } from "./lib/outbox";

export function start() {
  setInterval(() => void flushOutbox().catch((e) => console.error("[outbox]", e)), 10_000);
}
