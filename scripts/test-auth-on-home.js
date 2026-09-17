import { BrowserRunner } from './browser-runner.js';

async function testAuthOnHome() {
  console.log('Testing Authenticated User on #home...');
  const runner = new BrowserRunner({ port: 9226 });
  await runner.start();

  try {
    await runner.navigate('#home');
    await runner.waitForReady();
    await runner.waitForSelector('.hero-title', 10000);

    // Set authenticated profile on app instance and re-render
    const renderRes = await runner.evaluate(async () => {
      const app = window.__transmove_app;
      if (!app) return { error: 'App not initialized' };

      app.currentProfile = {
        id: 'test_user_passenger_123',
        user_id: 'test_user_passenger_123',
        full_name: 'Tatenda Mutasa',
        email: 'tatenda.passenger@transmove.test',
        role: 'customer',
        approvedRoles: ['customer']
      };

      app.currentRoute = 'home';
      await app.render();

      return {
        success: true,
        headerMounted: Boolean(document.getElementById('btn-header-notifications')),
        sidebarLogout: Boolean(document.getElementById('btn-sidebar-logout')),
        heroBanner: Boolean(document.querySelector('.hero-section .card'))
      };
    });

    console.log('  App render response:', renderRes);

    const authHomeCheck = await runner.evaluate(() => {
      const notifBtn = document.getElementById('btn-header-notifications');
      const messagesLink = document.querySelector('.header-messages-link');
      const logoutBtn = document.getElementById('btn-sidebar-logout');
      const profileLink = document.querySelector('.header-right a[href="#profile"]');
      const userText = profileLink?.innerText || '';
      const welcomeBanner = document.getElementById('home-welcome-banner');
      const welcomeText = welcomeBanner?.innerText?.trim();

      return {
        hasNotifications: Boolean(notifBtn),
        hasMessages: Boolean(messagesLink),
        hasLogout: Boolean(logoutBtn),
        hasProfile: Boolean(profileLink),
        userText,
        hasWelcomeBanner: Boolean(welcomeBanner),
        welcomeText
      };
    });

    console.log('  Authenticated check on #home:', authHomeCheck);

    const pass = authHomeCheck.hasNotifications
      && authHomeCheck.hasMessages
      && authHomeCheck.hasLogout
      && authHomeCheck.hasProfile
      && authHomeCheck.hasWelcomeBanner
      && authHomeCheck.userText.includes('Tatenda Mutasa')
      && authHomeCheck.userText.includes('Passenger');

    console.log('  Authenticated on #home PASS:', pass);

    if (!pass) throw new Error('Authenticated on #home verification failed');

  } finally {
    await runner.close();
  }
}

testAuthOnHome().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
