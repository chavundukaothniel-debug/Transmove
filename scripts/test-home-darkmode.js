import { BrowserRunner } from './browser-runner.js';

async function runHomeDarkModeTests() {
  console.log('================================================================');
  console.log('TRANSMOVE HOME PAGE + GUEST CONTROLS + DARK MODE ACCEPTANCE SUITE');
  console.log('================================================================\n');

  const runner = new BrowserRunner({ port: 9225 });
  await runner.start();

  const results = {};

  try {
    // -------------------------------------------------------------------------
    // TEST 1: HOME PAGE LOADS AS GUEST
    // -------------------------------------------------------------------------
    console.log('[1/10] Loading #home as guest...');
    await runner.navigate('#home');
    await runner.evaluate(() => {
      localStorage.removeItem('transmove_session');
      localStorage.removeItem('transmove_user');
      sessionStorage.clear();
      window.location.hash = '#home';
    });
    await runner.wait(500);

    // Reload to ensure guest state initializes cleanly
    await runner.sendSession('Page.reload');
    await runner.waitForSelector('.hero-title', 10000);
    await runner.waitForSelector('#btn-theme-toggle', 10000);
    await runner.waitForSelector('.sidebar-nav', 10000);

    const homeTitle = await runner.getText('.hero-title');
    console.log('  Hero Title found:', homeTitle?.replace(/\s+/g, ' ').slice(0, 60));
    results.homeLoaded = Boolean(homeTitle && homeTitle.includes('Fair Rides'));

    // -------------------------------------------------------------------------
    // TEST 2: GUEST SIDEBAR CONTROLS
    // -------------------------------------------------------------------------
    console.log('[2/10] Verifying Guest Sidebar controls...');
    const guestSidebarCheck = await runner.evaluate(() => {
      const logoutBtn = document.getElementById('btn-sidebar-logout');
      const roleTag = document.querySelector('.sidebar-role-tag .role-name')?.innerText?.trim();
      const userCard = document.querySelector('.sidebar-user-card');
      const userName = document.querySelector('.sidebar-user-card .user-name')?.innerText?.trim();
      const userEmail = document.querySelector('.sidebar-user-card .user-email')?.innerText?.trim();
      const userCardHref = userCard?.getAttribute('href');

      const links = Array.from(document.querySelectorAll('.sidebar-nav .sidebar-link')).map(a => ({
        href: a.getAttribute('href'),
        text: a.querySelector('.link-text')?.innerText?.trim()
      }));

      return {
        hasLogout: Boolean(logoutBtn),
        roleTag,
        userName,
        userEmail,
        userCardHref,
        links
      };
    });

    console.log('  Sidebar role:', guestSidebarCheck.roleTag);
    console.log('  Sidebar has logout:', guestSidebarCheck.hasLogout);
    console.log('  Sidebar user email:', guestSidebarCheck.userEmail);
    console.log('  Sidebar user href:', guestSidebarCheck.userCardHref);
    console.log('  Sidebar link count:', guestSidebarCheck.links.length);

    results.guestSidebarLogoutRemoved = !guestSidebarCheck.hasLogout;
    results.guestSidebarLinksPass = guestSidebarCheck.links.some(l => l.href === '#home')
      && guestSidebarCheck.links.some(l => l.href === '#equipment')
      && guestSidebarCheck.links.some(l => l.href === '#business')
      && guestSidebarCheck.links.some(l => l.href === '#subscriptions')
      && guestSidebarCheck.links.some(l => l.href === '#advertise')
      && guestSidebarCheck.links.some(l => l.href === '#support')
      && guestSidebarCheck.links.some(l => l.href === '#login')
      && guestSidebarCheck.links.some(l => l.href === '#register');
    results.guestSidebarCardPass = guestSidebarCheck.userCardHref === '#login' && guestSidebarCheck.userName === 'Guest Account';

    // -------------------------------------------------------------------------
    // TEST 3: GUEST HEADER CONTROLS
    // -------------------------------------------------------------------------
    console.log('[3/10] Verifying Guest Header controls...');
    const guestHeaderCheck = await runner.evaluate(() => {
      const notifBtn = document.getElementById('btn-header-notifications');
      const messagesLink = document.querySelector('.header-messages-link');
      const themeToggle = document.getElementById('btn-theme-toggle');
      const signInBtn = document.querySelector('.header-right a[href="#login"]');
      const registerBtn = document.querySelector('.header-right a[href="#register"]');
      const pageTitle = document.querySelector('.header-page-title')?.innerText?.trim();

      return {
        hasNotifications: Boolean(notifBtn),
        hasMessages: Boolean(messagesLink),
        hasThemeToggle: Boolean(themeToggle),
        hasSignIn: Boolean(signInBtn),
        hasRegister: Boolean(registerBtn),
        pageTitle
      };
    });

    console.log('  Header has notifications:', guestHeaderCheck.hasNotifications);
    console.log('  Header has messages:', guestHeaderCheck.hasMessages);
    console.log('  Header has theme toggle:', guestHeaderCheck.hasThemeToggle);
    console.log('  Header has sign in:', guestHeaderCheck.hasSignIn);
    console.log('  Header has register:', guestHeaderCheck.hasRegister);

    results.guestPrivateNotificationsHidden = !guestHeaderCheck.hasNotifications;
    results.guestPrivateMessagesHidden = !guestHeaderCheck.hasMessages;
    results.guestHeaderControlsPass = guestHeaderCheck.hasThemeToggle && guestHeaderCheck.hasSignIn && guestHeaderCheck.hasRegister;

    // -------------------------------------------------------------------------
    // TEST 4: QUICK REQUEST FORM & GUEST PERSISTENCE
    // -------------------------------------------------------------------------
    console.log('[4/10] Testing Quick Request form and guest persistence...');
    await runner.waitForSelector('#quick-pickup', 5000);
    await runner.type('#quick-pickup', 'Avondale Shopping Centre, Harare');
    await runner.type('#quick-dest', 'Robert Mugabe International Airport, Harare');
    await runner.selectOption('#quick-type', 'ride');
    await runner.type('#quick-price', '25.00');

    // Test GPS button click does not throw
    await runner.click('#btn-quick-gps');
    await runner.wait(400);

    // Re-fill pickup in case GPS cleared it
    await runner.type('#quick-pickup', 'Avondale Shopping Centre, Harare');

    // Click Post Request Now
    await runner.click('#btn-quick-post-request');
    for (let i = 0; i < 20; i++) {
      await runner.wait(100);
      const h = await runner.evaluate(() => window.location.hash);
      if (h === '#login') break;
    }

    const postHandoffCheck = await runner.evaluate(() => {
      const currentHash = window.location.hash;
      const stored = sessionStorage.getItem('transmove_pending_request');
      return {
        hash: currentHash,
        stored: stored ? JSON.parse(stored) : null
      };
    });

    console.log('  After Post Request, Hash:', postHandoffCheck.hash);
    console.log('  Stored pending request:', postHandoffCheck.stored);

    results.quickRequestFormPass = Boolean(postHandoffCheck.stored && postHandoffCheck.stored.pickup.includes('Avondale'));
    results.quickRequestPersistencePass = Boolean(postHandoffCheck.hash === '#login' && postHandoffCheck.stored.price === '25.00');

    // -------------------------------------------------------------------------
    // TEST 5: DARK MODE TOGGLE (LIGHT -> DARK -> LIGHT)
    // -------------------------------------------------------------------------
    console.log('[5/10] Testing Global Dark Mode toggle...');
    await runner.navigate('#home');
    await runner.waitForSelector('#btn-theme-toggle', 5000);

    // Ensure baseline is LIGHT
    const currentTheme = await runner.evaluate(() => document.documentElement.dataset.theme);
    if (currentTheme === 'dark') {
      await runner.click('#btn-theme-toggle');
      await runner.wait(300);
    }

    const baselineTheme = await runner.evaluate(() => document.documentElement.dataset.theme);
    console.log('  Baseline theme:', baselineTheme);

    // 1. Toggle to DARK
    await runner.click('#btn-theme-toggle');
    await runner.wait(300);

    const darkState = await runner.evaluate(() => {
      const meta = document.querySelector('meta[name="theme-color"]')?.getAttribute('content');
      const toggleTitle = document.getElementById('btn-theme-toggle')?.getAttribute('title');
      return {
        datasetTheme: document.documentElement.dataset.theme,
        dataThemeAttr: document.documentElement.getAttribute('data-theme'),
        localStorageTheme: localStorage.getItem('transmove-theme'),
        metaThemeColor: meta,
        toggleTitle
      };
    });
    console.log('  After toggle to dark:', darkState);
    results.toggleToDarkPass = darkState.datasetTheme === 'dark' && darkState.localStorageTheme === 'dark';

    // 2. Toggle back to LIGHT
    await runner.click('#btn-theme-toggle');
    await runner.wait(300);

    const lightState = await runner.evaluate(() => {
      const meta = document.querySelector('meta[name="theme-color"]')?.getAttribute('content');
      return {
        datasetTheme: document.documentElement.dataset.theme,
        localStorageTheme: localStorage.getItem('transmove-theme'),
        metaThemeColor: meta
      };
    });
    console.log('  After toggle to light:', lightState);
    results.toggleToLightPass = lightState.datasetTheme === 'light' && lightState.localStorageTheme === 'light';

    // -------------------------------------------------------------------------
    // TEST 6: THEME PERSISTENCE ACROSS RELOAD
    // -------------------------------------------------------------------------
    console.log('[6/10] Testing theme persistence across page reload...');
    // Set to dark
    await runner.click('#btn-theme-toggle');
    await runner.wait(300);

    // Reload page
    await runner.sendSession('Page.reload');
    await runner.waitForSelector('#btn-theme-toggle', 5000);

    const reloadThemeState = await runner.evaluate(() => {
      return {
        datasetTheme: document.documentElement.dataset.theme,
        dataThemeAttr: document.documentElement.getAttribute('data-theme'),
        localStorageTheme: localStorage.getItem('transmove-theme')
      };
    });
    console.log('  Theme after reload:', reloadThemeState);
    results.themePersistencePass = reloadThemeState.datasetTheme === 'dark' && reloadThemeState.localStorageTheme === 'dark';

    // -------------------------------------------------------------------------
    // TEST 7: THEME PERSISTENCE ACROSS ROUTES
    // -------------------------------------------------------------------------
    console.log('[7/10] Testing theme persistence across multiple routes...');
    const testRoutes = ['#login', '#register', '#equipment', '#subscriptions', '#support', '#home'];
    const routeThemes = {};

    for (const route of testRoutes) {
      await runner.setHash(route);
      await runner.wait(300);
      const t = await runner.evaluate(() => document.documentElement.dataset.theme);
      routeThemes[route] = t;
    }
    console.log('  Themes across routes:', routeThemes);
    results.themeAcrossRoutesPass = Object.values(routeThemes).every(t => t === 'dark');

    // -------------------------------------------------------------------------
    // TEST 8: FORM CONTROLS & MODAL IN DARK MODE
    // -------------------------------------------------------------------------
    console.log('[8/10] Testing form controls & modal styling in Dark Mode...');
    await runner.setHash('#home');
    await runner.waitForSelector('#quick-pickup', 5000);

    const darkStylesCheck = await runner.evaluate(() => {
      const input = document.getElementById('quick-pickup');
      const card = document.querySelector('.card');
      const header = document.querySelector('.app-header');

      const inputStyle = window.getComputedStyle(input);
      const cardStyle = window.getComputedStyle(card);
      const headerStyle = window.getComputedStyle(header);

      return {
        inputBg: inputStyle.backgroundColor,
        inputColor: inputStyle.color,
        cardBg: cardStyle.backgroundColor,
        headerBg: headerStyle.backgroundColor
      };
    });
    console.log('  Dark mode computed styles:', darkStylesCheck);

    // Test modal in dark mode
    const modalCheck = await runner.evaluate(async () => {
      const { Modal } = await import('./src/components/Modal.js');
      Modal.open('Theme Test Modal', '<p id="modal-test-content">Testing modal in dark mode</p>');
      const modalCard = document.querySelector('.modal-card');
      const cardStyle = window.getComputedStyle(modalCard);
      const res = {
        isOpen: Boolean(modalCard),
        bg: cardStyle.backgroundColor,
        color: cardStyle.color
      };
      Modal.close();
      return res;
    });
    console.log('  Modal in dark mode:', modalCheck);
    results.formsAndModalDarkPass = darkStylesCheck.inputBg.includes('11, 17, 32') && modalCheck.bg.includes('19, 30, 50');

    // -------------------------------------------------------------------------
    // TEST 9: PRINT RECEIPT STYLES
    // -------------------------------------------------------------------------
    console.log('[9/10] Testing Print Receipt ink-saving styles...');
    const printRulesCheck = await runner.evaluate(() => {
      let foundPrintRules = false;
      let whiteBg = false;
      for (const sheet of document.styleSheets) {
        try {
          for (const rule of sheet.cssRules || []) {
            if (rule.media && rule.media.mediaText.includes('print')) {
              foundPrintRules = true;
              const text = rule.cssText.toLowerCase();
              if (text.includes('rgb(255, 255, 255)') || text.includes('#ffffff') || text.includes('white')) {
                whiteBg = true;
              }
            }
          }
        } catch (_) {}
      }
      return { foundPrintRules, whiteBg };
    });
    console.log('  Print rules found:', printRulesCheck);
    results.printReceiptPass = printRulesCheck.foundPrintRules && printRulesCheck.whiteBg;

    // -------------------------------------------------------------------------
    // TEST 10: MOBILE RESPONSIVENESS & PWA META
    // -------------------------------------------------------------------------
    console.log('[10/10] Testing mobile responsiveness (375x667) & PWA meta...');
    await runner.sendSession('Emulation.setDeviceMetricsOverride', {
      width: 375,
      height: 667,
      deviceScaleFactor: 2,
      mobile: true
    });
    await runner.wait(400);

    const mobileCheck = await runner.evaluate(() => {
      const toggle = document.getElementById('btn-theme-toggle');
      const menuBtn = document.getElementById('btn-mobile-sidebar-trigger');
      const metaTheme = document.querySelector('meta[name="theme-color"]')?.getAttribute('content');
      const hero = document.querySelector('.hero-title');

      return {
        hasThemeToggle: Boolean(toggle && toggle.offsetParent !== null),
        hasMenuBtn: Boolean(menuBtn && menuBtn.offsetParent !== null),
        metaTheme,
        heroFontSize: window.getComputedStyle(hero).fontSize
      };
    });
    console.log('  Mobile check:', mobileCheck);
    results.mobileThemePass = mobileCheck.hasThemeToggle;
    results.pwaThemePass = Boolean(mobileCheck.metaTheme);

    // Reset viewport
    await runner.sendSession('Emulation.clearDeviceMetricsOverride');

    console.log('\n================================================================');
    console.log('ACCEPTANCE SUMMARY RESULTS');
    console.log('================================================================');
    console.log(JSON.stringify(results, null, 2));

  } finally {
    await runner.close();
  }
}

runHomeDarkModeTests().catch(err => {
  console.error('Test run failed:', err);
  process.exit(1);
});
