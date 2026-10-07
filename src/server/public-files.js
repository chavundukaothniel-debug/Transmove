import fs from "node:fs";
import path from "node:path";

const publicFiles = new Set(["index.html", "about.html", "privacy.html", "terms.html", "googlea4ceea99234e80f4.html", "install-ios.html", "manifest.webmanifest", "sw.js", "favicon.ico"]);
const publicDirectories = ["assets/", "downloads/", "src/components/", "src/config/", "src/services/", "src/utils/", "src/views/"];

export function resolvePublicFile(urlPath, root) {
  let decoded;
  try { decoded = decodeURIComponent(urlPath); } catch { return null; }
  const relative = decoded === "/" ? "index.html" : decoded.replace(/^\/+/, "");
  if (relative.includes("\\") || relative.split("/").some(part => part === ".." || part.startsWith("."))) return null;
  if (!publicFiles.has(relative) && !publicDirectories.some(prefix => relative.startsWith(prefix))) return null;
  const file = path.resolve(root, relative);
  if (!file.startsWith(path.resolve(root) + path.sep)) return null;
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return null;
  const realRoot = fs.realpathSync(root);
  if (!fs.realpathSync(file).startsWith(realRoot + path.sep)) return null;
  return file;
}
