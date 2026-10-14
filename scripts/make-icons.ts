import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { logoMarkSvg } from "../src/components/logo-svg";

const out = path.join(process.cwd(), "public");
async function main() {
  await mkdir(path.join(out, "icons"), { recursive: true });
  const svg = logoMarkSvg();
  await writeFile(path.join(out, "logo-mark.svg"), svg);
  for (const size of [48, 72, 96, 144, 180, 192, 384, 512, 1024]) {
    await sharp(Buffer.from(svg)).resize(size, size).png().toFile(path.join(out, "icons", `icon-${size}.png`));
  }
  // maskable: logo inset on a solid background for adaptive icons
  const inner = await sharp(Buffer.from(svg)).resize(380, 380).png().toBuffer();
  await sharp({ create: { width: 512, height: 512, channels: 4, background: "#4a3226" } }).composite([{ input: inner, gravity: "center" }]).png().toFile(path.join(out, "icons", "maskable-512.png"));
  await sharp(Buffer.from(svg)).resize(64, 64).png().toFile(path.join(out, "favicon.png"));
  console.log("icons written");
}
main();
