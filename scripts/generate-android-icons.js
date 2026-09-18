import fs from "fs";
import path from "path";
import { spawn } from "child_process";

const ROOT = process.cwd();
const SVG_PATH = path.join(ROOT, "assets", "images", "icon.svg");
const RES_PATH = path.join(ROOT, "android", "app", "src", "main", "res");
const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const SIZES = [
  { dir: "mipmap-mdpi", size: 48 },
  { dir: "mipmap-hdpi", size: 72 },
  { dir: "mipmap-xhdpi", size: 96 },
  { dir: "mipmap-xxhdpi", size: 144 },
  { dir: "mipmap-xxxhdpi", size: 192 }
];

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.msgId = 1;
    this.callbacks = new Map();
  }
  async connect() {
    return new Promise((res, rej) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.onopen = res;
      this.ws.onerror = rej;
      this.ws.onmessage = (e) => {
        const d = JSON.parse(e.data);
        if (d.id && this.callbacks.has(d.id)) {
          const { resolve, reject } = this.callbacks.get(d.id);
          this.callbacks.delete(d.id);
          if (d.error) reject(new Error(d.error.message));
          else resolve(d.result);
        }
      };
    });
  }
  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.msgId++;
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  close() { this.ws?.close(); }
}

async function renderIcons() {
  console.log("Rendering TransMove branding icons for Android...");
  const tempHtml = path.join(ROOT, "temp_icon_render.html");
  const svgContent = fs.readFileSync(SVG_PATH, "utf-8");
  fs.writeFileSync(tempHtml, `<!DOCTYPE html><html><body style="margin:0;padding:0;background:transparent;">${svgContent}</body></html>`);

  const tempProfile = path.join(process.env.TEMP || "C:\\temp", "transmove_icon_prof_" + Date.now());
  const proc = spawn(CHROME_PATH, [
    "--headless=new",
    "--remote-debugging-port=9225",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    `--user-data-dir=${tempProfile}`
  ], { stdio: "ignore" });

  let pageTarget = null;
  for (let i = 0; i < 30; i++) {
    try {
      const r = await fetch("http://127.0.0.1:9225/json/new?file:///" + tempHtml.replace(/\\/g, "/"), { method: "PUT" });
      if (r.ok) {
        pageTarget = await r.json();
        break;
      }
    } catch (_) {}
    await new Promise(r => setTimeout(r, 200));
  }

  if (!pageTarget) {
    proc.kill();
    throw new Error("Could not connect to Chrome on port 9225");
  }

  const cdp = new CDPClient(pageTarget.webSocketDebuggerUrl);
  await cdp.connect();
  await cdp.send("Page.enable");

  // Render for each density
  for (const item of SIZES) {
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: item.size,
      height: item.size,
      deviceScaleFactor: 1,
      mobile: false
    });
    await new Promise(r => setTimeout(r, 100));
    const shot = await cdp.send("Page.captureScreenshot", { format: "png", fromSurface: true });
    const buffer = Buffer.from(shot.data, "base64");

    const targetDir = path.join(RES_PATH, item.dir);
    if (fs.existsSync(targetDir)) {
      fs.writeFileSync(path.join(targetDir, "ic_launcher.png"), buffer);
      fs.writeFileSync(path.join(targetDir, "ic_launcher_round.png"), buffer);
      fs.writeFileSync(path.join(targetDir, "ic_launcher_foreground.png"), buffer);
      console.log(`✓ Generated ${item.dir} (${item.size}x${item.size})`);
    }
  }

  // Generate splash drawable
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 512,
    height: 512,
    deviceScaleFactor: 1,
    mobile: false
  });
  await new Promise(r => setTimeout(r, 100));
  const splashShot = await cdp.send("Page.captureScreenshot", { format: "png", fromSurface: true });
  const splashDir = path.join(RES_PATH, "drawable");
  if (!fs.existsSync(splashDir)) fs.mkdirSync(splashDir, { recursive: true });
  fs.writeFileSync(path.join(splashDir, "splash.png"), Buffer.from(splashShot.data, "base64"));
  console.log("✓ Generated splash.png (512x512)");

  cdp.close();
  proc.kill();
  try { fs.unlinkSync(tempHtml); } catch (_) {}
  console.log("✓ All Android launcher icons and splash assets rendered!");
}

renderIcons().catch(console.error);
