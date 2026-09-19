import fs from "fs";
import { BrowserRunner } from "./browser-runner.js";

const browser = new BrowserRunner({ port: 9238 });
const outputDir = "test-output/responsive-ui";
fs.mkdirSync(outputDir, { recursive: true });

async function capture(name, hash, saveScreenshot = false) {
  await browser.navigate(hash);
  await browser.wait(400);
  await browser.evaluate(`(async () => {
    history.replaceState(null, '', '${hash}');
    const { CustomerView } = await import('/src/views/CustomerView.js');
    document.body.className = 'customer-route';
    document.body.innerHTML = '<header class="app-header"><div class="header-mobile-brand">🚗 <b>Trans<span>Move</span></b></div><div class="header-right">🔔　👤</div></header><main class="app-main"></main><nav class="mobile-bottom-nav"><a class="mobile-nav-item active">⌂<span class="mobile-nav-label">Home</span></a><a class="mobile-nav-item">▧<span class="mobile-nav-label">Requests</span></a><a class="mobile-nav-item">◇<span class="mobile-nav-label">Trips</span></a><a class="mobile-nav-item">□<span class="mobile-nav-label">Messages</span></a><a class="mobile-nav-item">○<span class="mobile-nav-label">Profile</span></a></nav>';
    document.querySelector('.app-main').innerHTML = await CustomerView.render({ full_name: 'Simba Moyo' });
  })()`);
  await browser.wait(500);
  if (saveScreenshot) {
    const screenshot = await browser.sendSession("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    fs.writeFileSync(`${outputDir}/${name}.png`, Buffer.from(screenshot.result.data, "base64"));
  }
  const audit = await browser.evaluate(`({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth, height: document.body.scrollHeight })`);
  if (audit.scrollWidth > audit.width) throw new Error(`${name} has horizontal overflow`);
  console.log(name, audit);
}

await browser.start();
try {
  const sizes = [[320, 568], [360, 800], [375, 812], [390, 844], [412, 915], [430, 932], [768, 1024], [1440, 900]];
  for (const [width, height] of sizes) {
    await browser.setViewport(width, height, width <= 768);
    await capture(`reference-passenger-home-${width}`, "#customer", width === 390);
    await capture(`reference-request-details-${width}`, "#customer?tab=search", width === 390);
  }
} finally {
  await browser.close();
}
