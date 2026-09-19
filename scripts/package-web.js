import fs from "fs";
import path from "path";

const ROOT_DIR = process.cwd();
const WWW_DIR = path.join(ROOT_DIR, "www");

console.log("Packaging TransMove frontend for Android Capacitor...");

// Ensure clean www directory
if (fs.existsSync(WWW_DIR)) {
  fs.rmSync(WWW_DIR, { recursive: true, force: true });
}
fs.mkdirSync(WWW_DIR, { recursive: true });

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const child of fs.readdirSync(src)) {
      copyRecursive(path.join(src, child), path.join(dest, child));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

// 1. Copy index.html
if (fs.existsSync(path.join(ROOT_DIR, "index.html"))) {
  fs.copyFileSync(path.join(ROOT_DIR, "index.html"), path.join(WWW_DIR, "index.html"));
  console.log("✓ Copied index.html");
}

// 2. Copy manifest
if (fs.existsSync(path.join(ROOT_DIR, "manifest.webmanifest"))) {
  fs.copyFileSync(path.join(ROOT_DIR, "manifest.webmanifest"), path.join(WWW_DIR, "manifest.webmanifest"));
  console.log("✓ Copied manifest.webmanifest");
}

// 3. Copy sw.js if exists
if (fs.existsSync(path.join(ROOT_DIR, "sw.js"))) {
  fs.copyFileSync(path.join(ROOT_DIR, "sw.js"), path.join(WWW_DIR, "sw.js"));
  console.log("✓ Copied sw.js");
}

// 4. Copy assets directory
if (fs.existsSync(path.join(ROOT_DIR, "assets"))) {
  copyRecursive(path.join(ROOT_DIR, "assets"), path.join(WWW_DIR, "assets"));
  console.log("✓ Copied assets/ directory");
}

// 5. Copy src directory
if (fs.existsSync(path.join(ROOT_DIR, "src"))) {
  copyRecursive(path.join(ROOT_DIR, "src"), path.join(WWW_DIR, "src"));
  console.log("✓ Copied src/ directory");
}

// Safety check: ensure no .env, server modules, or node_modules exist in www
const forbidden = [
  ".env", ".env.local", ".env.production", ".env.appwrite.setup",
  "node_modules", "netlify", "server.js", "server.ps1", "sql", "storage",
  path.join("src", "server")
];
for (const item of forbidden) {
  const checkPath = path.join(WWW_DIR, item);
  if (fs.existsSync(checkPath)) {
    fs.rmSync(checkPath, { recursive: true, force: true });
    console.log(`✓ Stripped server-only component from APK assets: ${item}`);
  }
}

console.log("✓ Web packaging complete! Target: " + WWW_DIR);
