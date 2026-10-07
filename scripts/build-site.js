import fs from "node:fs";
import path from "node:path";
import "./build-public-pages.js";

const root = process.cwd();
const output = path.resolve(root, "site-dist");
if (path.dirname(output) !== root) throw new Error("Invalid output directory");
fs.mkdirSync(output, { recursive: true });
// Copy an explicit public allowlist; never publish credentials or backend source.
for (const name of ["index.html", "about.html", "privacy.html", "terms.html", "googlea4ceea99234e80f4.html", "manifest.webmanifest", "sw.js", "favicon.ico", "assets", "downloads", "install-ios.html"]) {
  const source = path.join(root, name);
  if (fs.existsSync(source)) fs.cpSync(source, path.join(output, name), { recursive: true });
}
for (const name of ["components", "config", "services", "utils", "views"]) {
  fs.cpSync(path.join(root, "src", name), path.join(output, "src", name), { recursive: true });
}
console.log("Public website prepared in site-dist; trusted backend runs outside the public folder.");
