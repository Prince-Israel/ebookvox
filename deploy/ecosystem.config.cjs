// PM2 process file: runs the three apps from one server. Start with:  pm2 start deploy/ecosystem.config.cjs && pm2 save
// Each app reads its own .env (in its folder) at start-up, so restart after editing one:  pm2 restart ebookvox-reader
const root = __dirname + "/..";
const app = (name, dir, port) => ({
  name, cwd: `${root}/${dir}`, script: "node_modules/next/dist/bin/next", args: `start -p ${port}`,
  env: { NODE_ENV: "production" }, max_memory_restart: "700M", autorestart: true,
});
module.exports = {
  apps: [app("ebookvox-reader", ".", 3230), app("ebookvox-publisher", "publisher", 3240), app("ebookvox-admin", "admin", 3250)],
};
