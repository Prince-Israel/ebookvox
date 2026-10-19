// Startup file for DirectAdmin's "Node.js Selector / Setup Node.js App" (CloudLinux + Phusion Passenger).
// Copy it into each app's folder as `server.js` (the upload zips from scripts/package-for-upload.sh already contain it).
// If the app fails to start, the reason is written to `startup-error.log` next to this file (open it in File Manager).
const fs = require("node:fs");
const path = require("node:path");
const { createServer } = require("node:http");

const dir = __dirname;
const log = (m) => { try { fs.appendFileSync(path.join(dir, "startup-error.log"), `${new Date().toISOString()} ${m}\n`); } catch {} };
process.on("uncaughtException", (e) => { log(`uncaughtException: ${(e && e.stack) || e}`); process.exit(1); });
process.on("unhandledRejection", (e) => log(`unhandledRejection: ${(e && e.stack) || e}`));

try {
  log(`starting: node ${process.version}, dir ${dir}`);
  if (!fs.existsSync(path.join(dir, ".next", "BUILD_ID"))) throw new Error("No production build found (.next/BUILD_ID is missing). Run the 'build' script first.");
  if (!fs.existsSync(path.join(dir, ".env"))) log("warning: no .env file in the app folder");
  const next = require("next");
  const app = next({ dev: false, dir });
  const handle = app.getRequestHandler();
  app.prepare().then(() => {
    // Under Passenger, listen() is intercepted and bound to the socket it provides; locally it uses PORT (or 3000).
    createServer((req, res) => handle(req, res)).listen(process.env.PORT || 3000, () => log("Ebookvox ready"));
  }).catch((e) => { log(`prepare failed: ${(e && e.stack) || e}`); process.exit(1); });
} catch (e) {
  log(`startup failed: ${(e && e.stack) || e}`);
  process.exit(1);
}
