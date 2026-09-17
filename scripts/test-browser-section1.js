import { BrowserRunner } from './browser-runner.js';

async function runSection1() {
  console.log('\n=======================================================');
  console.log('TRANSMOVE BROWSER ACCEPTANCE: SECTION 1 — PUBLIC ROUTES');
  console.log('=======================================================\n');

  const browser = new BrowserRunner({ port: 9223 });
  await browser.start();

  const results = [];
  function record(route, name, passed, details = '') {
    results.push({ route, name, passed, details });
    console.log(`${passed ? '✅ PASS' : '❌ FAIL'} [${route}] ${name} ${details ? `(${details})` : ''}`);
  }

  try {
    // 1. #home
    await browser.navigate('#home');
    await browser.evaluate('localStorage.clear(); sessionStorage.clear();');
    await browser.wait(500);
    const homeText = await browser.evaluate(`document.body.innerText`);
    const homeHasHero = homeText.includes('TransMove') || homeText.includes('Ride');
    const homeHash = await browser.getCurrentHash();
    record('#home', 'Page Load & Content Render', homeHasHero, `Hash: ${homeHash}`);

    // 2. #login
    await browser.setHash('#login');
    const loginHasEmail = await browser.exists('#auth-email, input[type="email"]');
    const loginHasPass = await browser.exists('#auth-password, input[type="password"]');
    record('#login', 'Login Form & Inputs Render', loginHasEmail && loginHasPass, 'Email & Password inputs active');

    // 3. #register
    await browser.setHash('#register');
    const regHasName = await browser.exists('#reg-fullname, #auth-fullname, input[name="name"], #reg-name');
    const regHasRole = await browser.exists('#reg-role, select');
    record('#register', 'Register Form & Inputs Render', regHasName || regHasRole, 'Registration controls active');

    // 4. #forgot-password
    await browser.setHash('#forgot-password');
    const forgotEmail = await browser.exists('input[type="email"]');
    record('#forgot-password', 'Forgot Password View Render', forgotEmail, 'Email recovery input present');

    // 5. #reset-password
    await browser.setHash('#reset-password');
    const resetPass = await browser.exists('input[type="password"]');
    record('#reset-password', 'Reset Password View Render', resetPass, 'New password inputs present');

    // 6. #verify-email
    await browser.setHash('#verify-email');
    const verifyView = await browser.exists('#app-root');
    const verifyText = await browser.getText('#app-root');
    record('#verify-email', 'Verify Email View Render', verifyText.toLowerCase().includes('verif'), 'Verification screen active');

    // 7. #equipment
    await browser.setHash('#equipment');
    const equipText = await browser.getText('#app-root');
    record('#equipment', 'Equipment View Render', equipText.includes('Equipment') || equipText.includes('Machinery'), 'Equipment catalog active');

    // 8. #subscriptions (Private route - should redirect to #login when unauthenticated)
    await browser.setHash('#subscriptions');
    await browser.wait(400);
    const subHash = await browser.getCurrentHash();
    record('#subscriptions', 'Unauthenticated Protection Redirect', subHash === '#login', `Redirected to ${subHash}`);

    // 9. #advertise
    await browser.setHash('#advertise');
    const adText = await browser.getText('#app-root');
    record('#advertise', 'Advertise View Render', adText.includes('Advertis') || adText.includes('Partner'), 'Advertising view active');

    // 10. #contact
    await browser.setHash('#contact');
    const contactInput = await browser.exists('input, textarea');
    record('#contact', 'Contact View Render', contactInput, 'Contact form inputs present');

    // 11. #support
    await browser.setHash('#support');
    const supportText = await browser.getText('#app-root');
    record('#support', 'Support View Render', supportText.includes('Support') || supportText.includes('Help'), 'Support view active');

    // 12. #help
    await browser.setHash('#help');
    const helpText = await browser.getText('#app-root');
    record('#help', 'Help View Render', helpText.includes('Help') || helpText.includes('FAQ'), 'Help view active');

    // 13. #safety
    await browser.setHash('#safety');
    const safetyText = await browser.getText('#app-root');
    record('#safety', 'Safety View Render', safetyText.includes('Safety') || safetyText.includes('Protection'), 'Safety view active');

    // 14. #status
    await browser.setHash('#status');
    const statusText = await browser.getText('#app-root');
    record('#status', 'Status View Render', statusText.includes('Status') || statusText.includes('Operational') || statusText.includes('Live'), 'Status view active');

    // 15. #legal
    await browser.setHash('#legal');
    const legalText = await browser.getText('#app-root');
    record('#legal', 'Legal/Terms View Render', legalText.includes('Terms') || legalText.includes('Privacy') || legalText.includes('Legal'), 'Legal view active');

    // 16. #owner (Privileged route - MUST redirect to #login)
    await browser.setHash('#owner');
    await browser.wait(400);
    const ownerHash = await browser.getCurrentHash();
    record('#owner', 'Privileged Owner Route Redirect to #login', ownerHash === '#login', `Redirected unauthenticated to ${ownerHash}`);

    // 17. Aliases
    await browser.setHash('#terms');
    const termsText = await browser.getText('#app-root');
    record('#terms', 'Alias: #terms -> Legal View', termsText.includes('Terms'), 'Legal terms displayed');

    await browser.setHash('#privacy');
    const privText = await browser.getText('#app-root');
    record('#privacy', 'Alias: #privacy -> Legal View', privText.includes('Privacy') || privText.includes('Policy'), 'Privacy policy displayed');

    await browser.setHash('#about');
    const aboutText = await browser.getText('#app-root');
    record('#about', 'Alias: #about -> Contact View', aboutText.includes('Contact') || aboutText.includes('TransMove'), 'About/contact displayed');

    await browser.setHash('#admin-login');
    const adminLoginPass = await browser.exists('#admin-login-password, input[type="password"]');
    record('#admin-login', 'Alias: #admin-login -> Admin Login Screen', adminLoginPass, 'Admin password input rendered');

    // Check Console Errors
    const errors = browser.consoleErrors;
    record('Console', 'Zero Breaking Console Errors in Public Routes', errors.length === 0, errors.length ? `Errors: ${errors.join(', ')}` : 'Zero errors');

  } catch (err) {
    console.error('Section 1 Exception:', err);
    record('Exception', 'Unexpected Failure', false, err.message);
  } finally {
    await browser.close();
  }

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log('\n=======================================================');
  console.log(`SECTION 1 SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('=======================================================\n');
}

runSection1();
