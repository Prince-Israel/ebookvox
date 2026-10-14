import { pollEvents } from "./lib/events";

// Keeps admin notifications flowing even when nobody has the dashboard open:
// pulls new events from the Reader and Publisher feeds every few seconds.
export function start() {
  setTimeout(() => void pollEvents(true).catch(() => {}), 1500); // sets the starting cursors
  setInterval(() => void pollEvents().catch(() => {}), 8000);
}
