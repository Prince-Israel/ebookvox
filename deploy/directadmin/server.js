// Startup file for DirectAdmin's "Node.js Selector / Setup Node.js App" (CloudLinux + Phusion Passenger).
// Passenger starts this file instead of `next start`. Copy it into each app's folder as `server.js`:
//   cp deploy/directadmin/server.js server.js ; cp deploy/directadmin/server.js publisher/server.js ; cp deploy/directadmin/server.js admin/server.js
// Run from the app's folder (Passenger sets that as the working directory). Next.js reads that folder's .env itself.
const { createServer } = require("node:http");
const next = require("next");

const app = next({ dev: false, dir: process.cwd() });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  // Under Passenger, listen() is intercepted and bound to the socket it provides; locally it uses PORT (or 3000).
  createServer((req, res) => handle(req, res)).listen(process.env.PORT || 3000, () => console.log("Ebookvox ready"));
}).catch((e) => { console.error(e); process.exit(1); });
