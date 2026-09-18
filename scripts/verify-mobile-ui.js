import fs from "fs";
import path from "path";
import { BrowserRunner } from "./browser-runner.js";

const outputDir = path.resolve("test-output", "responsive-ui");
fs.mkdirSync(outputDir, { recursive: true });

const browser = new BrowserRunner({ port: 9231 });
const accounts = {
  passenger: "bid.test.pass.p@tm.test",
  driver: "bid.test.drv.a@tm.test",
  admin: "transmove@admin.com"
};
const passwords = {
  passenger: "T3stP@ssword2026!#",
  driver: "T3stP@ssword2026!#",
  admin: "Transmove2026"
};

const sizes = [
  [320, 568],
  [360, 800],
  [375, 812],
  [390, 844],
  [412, 915],
  [430, 932],
  [768, 1024],
  [1440, 900]
];

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function shot(name) {
  const result = await browser.sendSession("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false
  });
  fs.writeFileSync(path.join(outputDir, `${name}.png`), Buffer.from(result.result.data, "base64"));
}

async function audit(label) {
  const result = await browser.evaluate(`(() => {
    const offenders = [...document.querySelectorAll('body *')].filter((node) => {
      const rect = node.getBoundingClientRect();
      return rect.right > window.innerWidth + 1 || rect.left < -1;
    }).slice(0, 10).map((node) => ({ tag: node.tagName, cls: node.className, right: Math.round(node.getBoundingClientRect().right) }));
    return {
      hash: location.hash,
      viewport: [innerWidth, innerHeight],
      scrollWidth: document.documentElement.scrollWidth,
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      offenders,
      navLabels: [...document.querySelectorAll('.mobile-nav-label')].map((node) => node.textContent.trim()),
      theme: document.documentElement.dataset.theme,
      textMain: getComputedStyle(document.documentElement).getPropertyValue('--text-main').trim(),
      welcomeColor: document.querySelector('.passenger-welcome-title')
        ? getComputedStyle(document.querySelector('.passenger-welcome-title')).color
        : null,
      activeAdminTab: document.querySelector('.adm-tab-btn.active')?.dataset.tab || null
    };
  })()`);
  console.log(JSON.stringify({ label, ...result }));
  if (result.overflow) throw new Error(`${label} has document-level horizontal overflow`);
  return result;
}

function assertNav(label, actual, expected) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label} navigation mismatch: ${actual.join(' / ')}`);
  }
}

async function login(role) {
  await browser.navigate("#login");
  await browser.evaluate(`localStorage.setItem('transmove-theme', 'light'); localStorage.setItem('transmove_theme', 'light');`);
  await browser.type("#auth-email", accounts[role]);
  await browser.type("#auth-password", passwords[role]);
  await browser.click("#auth-submit-btn");
  for (let i = 0; i < 40; i += 1) {
    await wait(350);
    const hash = await browser.getCurrentHash();
    if (hash !== "#login") return hash;
  }
  throw new Error(`${role} login did not leave #login`);
}

async function logout() {
  await browser.evaluate(`(async () => { const { AuthService } = await import('/src/services/auth.js'); await AuthService.logout(); })()`);
  await wait(600);
}

async function run() {
  await browser.start();
  try {
    await browser.setViewport(390, 844, true);
    await login("passenger");

    for (const [width, height] of sizes) {
      await browser.setViewport(width, height, width <= 768);
      await browser.setHash("#customer");
      await wait(1600);
      const label = `passenger-home-${width}x${height}`;
      const result = await audit(label);
      assertNav(label, result.navLabels, ["Home", "Requests", "Trips", "Messages", "Profile"]);
      await shot(label);
    }

    await browser.setViewport(390, 844, true);
    for (const route of [
      ["request-details", "#customer?tab=search"],
      ["requests", "#customer?tab=quotes"],
      ["trips", "#customer?tab=bookings"],
      ["messages", "#messages"],
      ["profile", "#profile"]
    ]) {
      await browser.setHash(route[1]);
      await wait(1800);
      const result = await audit(`passenger-${route[0]}-390x844`);
      assertNav(route[0], result.navLabels, ["Home", "Requests", "Trips", "Messages", "Profile"]);
      await shot(`passenger-${route[0]}-390x844`);
    }

    await browser.evaluate(`(async () => { const { ThemeService } = await import('/src/services/theme.js'); ThemeService.setTheme('dark'); })()`);
    await browser.setHash("#customer");
    await wait(1200);
    const darkAudit = await audit("passenger-home-dark-390x844");
    if (darkAudit.theme !== "dark" || darkAudit.textMain !== "#f8fbff" || darkAudit.welcomeColor !== "rgb(248, 251, 255)") {
      throw new Error(`dark theme contrast mismatch: ${JSON.stringify(darkAudit)}`);
    }
    await shot("passenger-home-dark-390x844");
    await browser.evaluate(`(async () => { const { ThemeService } = await import('/src/services/theme.js'); ThemeService.setTheme('light'); })()`);

    await logout();
    await login("driver");
    for (const route of [
      ["home", "#driver"],
      ["requests", "#driver?tab=available"],
      ["jobs", "#driver?tab=offers"],
      ["earnings", "#driver?tab=earnings"],
      ["subscriptions", "#subscriptions"]
    ]) {
      await browser.setHash(route[1]);
      await wait(2800);
      const result = await audit(`driver-${route[0]}-390x844`);
      assertNav(route[0], result.navLabels, ["Home", "Requests", "Jobs", "Earnings", "Profile"]);
      await shot(`driver-${route[0]}-390x844`);
    }

    await logout();
    await login("admin");
    for (const route of [
      ["home", "#admin"],
      ["payments", "#admin?tab=payments"],
      ["ads", "#admin?tab=ads"]
    ]) {
      await browser.setHash(route[1]);
      await wait(2400);
      const result = await audit(`admin-${route[0]}-390x844`);
      const expectedAdminTab = { home: "analytics", payments: "financials", ads: "ads" }[route[0]];
      if (result.activeAdminTab !== expectedAdminTab) {
        throw new Error(`admin ${route[0]} did not activate ${expectedAdminTab}`);
      }
      await shot(`admin-${route[0]}-390x844`);
    }
    console.log(`RESPONSIVE UI PASS: ${sizes.length} exact viewports plus passenger, driver, dark-mode and admin routes`);
  } finally {
    await browser.close();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
