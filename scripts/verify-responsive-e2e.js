import fs from "fs";
import path from "path";
import { spawn } from "child_process";

const ARTIFACTS_DIR = "C:\\Users\\PC\\.gemini\\antigravity-ide\\brain\\ae0487d9-6ec2-43d3-8f9d-b24dc7d17341";
const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.msgId = 1;
    this.callbacks = new Map();
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.onopen = () => resolve();
      this.ws.onerror = (e) => reject(e);
      this.ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.id && this.callbacks.has(data.id)) {
          const { resolve, reject } = this.callbacks.get(data.id);
          this.callbacks.delete(data.id);
          if (data.error) reject(new Error(data.error.message));
          else resolve(data.result);
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

  close() {
    if (this.ws) this.ws.close();
  }
}

async function startChrome() {
  const tempProfile = path.join(process.env.TEMP || "C:\\temp", "transmove_chrome_profile_" + Date.now());
  const proc = spawn(CHROME_PATH, [
    "--headless=new",
    "--remote-debugging-port=9224",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    `--user-data-dir=${tempProfile}`
  ], { stdio: "ignore" });

  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch("http://127.0.0.1:9224/json/version");
      if (res.ok) return proc;
    } catch (_) {}
    await new Promise(r => setTimeout(r, 200));
  }
  throw new Error("Chrome failed to start on port 9224");
}

async function run() {
  console.log("Launching headless Chrome...");
  const chromeProc = await startChrome();
  const versionRes = await fetch("http://127.0.0.1:9224/json/new?http://localhost:8080/", { method: "PUT" });
  const pageTarget = await versionRes.json();
  const cdp = new CDPClient(pageTarget.webSocketDebuggerUrl);
  await cdp.connect();

  console.log("Connected to page:", pageTarget.webSocketDebuggerUrl);
  await cdp.send("Page.enable");
  await cdp.send("DOM.enable");
  await cdp.send("Runtime.enable");

  // Wait for page to load
  await new Promise(r => setTimeout(r, 2000));

  const testViewports = [
    { name: "mobile_320px", width: 320, height: 640 },
    { name: "mobile_360px", width: 360, height: 740 },
    { name: "mobile_390px", width: 390, height: 844 },
    { name: "mobile_430px", width: 430, height: 932 },
    { name: "desktop_1280px", width: 1280, height: 800 }
  ];

  const results = {};

  for (const vp of testViewports) {
    console.log(`\nTesting viewport: ${vp.name} (${vp.width}x${vp.height})...`);
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: vp.width,
      height: vp.height,
      deviceScaleFactor: 2,
      mobile: vp.width <= 768
    });

    await new Promise(r => setTimeout(r, 600));

    // Audit horizontal overflow
    const overflowCheck = await cdp.send("Runtime.evaluate", {
      expression: `
        (() => {
          const scrollW = document.documentElement.scrollWidth;
          const clientW = document.documentElement.clientWidth;
          return {
            scrollWidth: scrollW,
            clientWidth: clientW,
            hasOverflow: scrollW > clientW
          };
        })()
      `,
      returnByValue: true
    });

    const isOverflow = overflowCheck.result.value.hasOverflow;
    console.log(`Viewport ${vp.width}px: scrollWidth=${overflowCheck.result.value.scrollWidth}, clientWidth=${overflowCheck.result.value.clientWidth}, hasOverflow=${isOverflow}`);
    results[vp.name] = !isOverflow ? "PASS" : "FAIL";

    // Capture screenshot
    const shot = await cdp.send("Page.captureScreenshot", { format: "png" });
    const shotPath = path.join(ARTIFACTS_DIR, `${vp.name}.png`);
    fs.writeFileSync(shotPath, Buffer.from(shot.data, "base64"));
    console.log(`Saved screenshot: ${shotPath}`);
  }

  // TEST DRIVER REQUEST CARD & COUNTDOWN
  console.log("\n--- Testing Driver Request Floating Card on Desktop (1280px) ---");
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 1280,
    height: 800,
    deviceScaleFactor: 1,
    mobile: false
  });

  // Navigate to #driver view and trigger card
  await cdp.send("Runtime.evaluate", {
    expression: `window.location.hash = "#driver";`
  });
  await new Promise(r => setTimeout(r, 1200));

  // Trigger DriverRequestCard.show
  await cdp.send("Runtime.evaluate", {
    expression: `
      (async () => {
        const { DriverRequestCard } = await import("./src/components/DriverRequestCard.js");
        DriverRequestCard.show({
          id: "req-e2e-1",
          pickup_address: "MSU Batanai Campus",
          destination_address: "Southdowns",
          service_type: "ride",
          suggested_price: 10
        }, {
          onMakeOffer: (job) => { window.__OFFER_OPENED = true; },
          onDismiss: (job) => { window.__DISMISSED = true; },
          onTimeout: (job) => { window.__TIMED_OUT = true; }
        });
      })()
    `
  });

  await new Promise(r => setTimeout(r, 500));

  // Inspect Card placement and countdown
  const cardEvaluation = await cdp.send("Runtime.evaluate", {
    expression: `
      (() => {
        const card = document.getElementById("driver-floating-request-card");
        if (!card) return { found: false };
        const rect = card.getBoundingClientRect();
        const countdownText = document.getElementById("driver-request-countdown-text")?.textContent;
        const computed = window.getComputedStyle(card);
        return {
          found: true,
          top: rect.top,
          right: window.innerWidth - rect.right,
          width: rect.width,
          position: computed.position,
          countdown: countdownText
        };
      })()
    `,
    returnByValue: true
  });

  console.log("Desktop Card evaluation:", cardEvaluation.result.value);
  const cardData = cardEvaluation.result.value;
  const isTopRight = cardData.found && cardData.position === "fixed" && cardData.top >= 70 && cardData.top <= 120 && cardData.right >= 10;
  console.log(`Top-right position verified: ${isTopRight ? "PASS" : "FAIL"}`);

  // Capture desktop card screenshot
  const deskCardShot = await cdp.send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.join(ARTIFACTS_DIR, "driver_card_desktop.png"), Buffer.from(deskCardShot.data, "base64"));

  // Wait 3 seconds and verify countdown ticks down
  console.log("Waiting 3s for countdown tick...");
  await new Promise(r => setTimeout(r, 3200));

  const tickedEvaluation = await cdp.send("Runtime.evaluate", {
    expression: `document.getElementById("driver-request-countdown-text")?.textContent;`,
    returnByValue: true
  });
  console.log(`Countdown after ~3s: ${tickedEvaluation.result.value}`);

  // Test Mobile view for request card (390px)
  console.log("\n--- Testing Driver Request Card on Mobile (390px) ---");
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true
  });
  await new Promise(r => setTimeout(r, 600));

  const mobileCardEval = await cdp.send("Runtime.evaluate", {
    expression: `
      (() => {
        const card = document.getElementById("driver-floating-request-card");
        if (!card) return { found: false };
        const rect = card.getBoundingClientRect();
        return {
          found: true,
          left: rect.left,
          right: window.innerWidth - rect.right,
          width: rect.width,
          windowWidth: window.innerWidth
        };
      })()
    `,
    returnByValue: true
  });
  console.log("Mobile Card evaluation:", mobileCardEval.result.value);

  const mobileCardShot = await cdp.send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.join(ARTIFACTS_DIR, "driver_card_mobile.png"), Buffer.from(mobileCardShot.data, "base64"));

  // Click "Make offer"
  console.log("\nTesting 'Make offer' button click...");
  await cdp.send("Runtime.evaluate", {
    expression: `document.getElementById("driver-btn-make-offer")?.click();`
  });
  await new Promise(r => setTimeout(r, 600));

  const afterOfferEval = await cdp.send("Runtime.evaluate", {
    expression: `
      (() => {
        const card = document.getElementById("driver-floating-request-card");
        return {
          cardStillPresent: Boolean(card),
          offerCallbackTriggered: window.__OFFER_OPENED === true
        };
      })()
    `,
    returnByValue: true
  });
  console.log("After clicking Make Offer:", afterOfferEval.result.value);

  cdp.close();
  try { chromeProc.kill(); } catch (_) {}
  console.log("\nBrowser verification complete! Results:", results);
}

run().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
