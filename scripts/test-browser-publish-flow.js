import { spawn } from 'child_process';
import os from 'os';
import path from 'path';
import fs from 'fs';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const tempDir = path.join(os.tmpdir(), 'chrome-pub-test-' + Date.now());

// Load setup env
const envPath = path.resolve(process.cwd(), '.env.appwrite.setup');
const conf = {};
fs.readFileSync(envPath, 'utf8').split('\n').forEach((l) => {
  const p = l.split('=');
  if (p.length >= 2) conf[p[0].trim()] = p.slice(1).join('=').trim();
});

const serverHeaders = {
  'X-Appwrite-Project': conf.APPWRITE_PROJECT_ID,
  'X-Appwrite-Key': conf.APPWRITE_API_KEY,
  'Content-Type': 'application/json'
};

async function run() {
  console.log('--- Launching Chrome for Browser E2E Request Publish Flow ---');
  const chromeProcess = spawn(CHROME_PATH, [
    '--headless=new',
    '--remote-debugging-port=9224',
    `--user-data-dir=${tempDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    'http://localhost:8080/#customer'
  ], {
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let wsUrl = null;
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timeout waiting for DevTools URL')), 10000);
    chromeProcess.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      const match = text.match(/ws:\/\/127\.0\.0\.1:9224\/devtools\/browser\/[a-zA-Z0-9-]+/);
      if (match) {
        wsUrl = match[0];
        clearTimeout(timer);
        resolve();
      }
    });
  });

  console.log('Connected to DevTools:', wsUrl);
  const ws = new WebSocket(wsUrl);
  let idCounter = 1;
  const pendingRequests = new Map();

  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data.toString());
    if (msg.id && pendingRequests.has(msg.id)) {
      const { resolve, reject } = pendingRequests.get(msg.id);
      pendingRequests.delete(msg.id);
      if (msg.error) reject(msg.error);
      else resolve(msg.result);
    }
  });

  await new Promise((resolve) => ws.addEventListener('open', resolve, { once: true }));

  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = idCounter++;
      pendingRequests.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  const targets = await send('Target.getTargets');
  let pageTarget = targets.targetInfos.find((t) => t.type === 'page' && t.url.includes('8080'));
  if (!pageTarget) {
    const res = await send('Target.createTarget', { url: 'http://localhost:8080/#customer' });
    pageTarget = { targetId: res.targetId };
  }

  const { sessionId } = await send('Target.attachToTarget', { targetId: pageTarget.targetId, flatten: true });

  function sendSession(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = idCounter++;
      pendingRequests.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, sessionId, method, params }));
    });
  }

  await sendSession('Page.enable');
  await sendSession('Runtime.enable');

  // Intercept and track any alert dialogs
  let alertDialogShown = null;
  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data.toString());
    if (msg.method === 'Page.javascriptDialogOpening') {
      alertDialogShown = msg.params?.message;
      console.error('ALERT DETECTED:', alertDialogShown);
      sendSession('Page.handleJavaScriptDialog', { accept: true });
    }
  });

  async function evaluate(expression) {
    const res = await sendSession('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    if (res.exceptionDetails) {
      throw new Error(res.exceptionDetails.exception?.description || res.exceptionDetails.text);
    }
    return res.result?.value;
  }

  console.log('Waiting for initial scripts to load...');
  await new Promise((r) => setTimeout(r, 2000));

  // 1. Authenticate test passenger in browser session
  console.log('Setting up passenger session in browser...');
  const authRes = await evaluate(`
    (async () => {
      const { AuthService } = await import('/src/services/auth.js');
      const testEmail = "test.browser.passenger." + Date.now() + "@transmove.test";
      const reg = await AuthService.register({
        email: testEmail,
        password: "TestPassword123!",
        fullName: "Test Browser Passenger",
        phoneNumber: "+263771000099",
        role: "passenger",
        city: "Gweru"
      });
      return { userId: reg.user?.$id, email: testEmail };
    })()
  `);
  console.log('Passenger authenticated in browser:', authRes.userId);

  // 2. Open Customer View & switch to new-request tab
  console.log('Navigating to #customer?tab=new-request...');
  await evaluate(`
    (async () => {
      const { CustomerView } = await import('/src/views/CustomerView.js');
      const { AuthService } = await import('/src/services/auth.js');
      const profile = await AuthService.getCurrentProfile();
      window.location.hash = "#customer?tab=new-request";
      const main = document.getElementById("app-root");
      main.innerHTML = await CustomerView.render(profile);
      await CustomerView.init();
      CustomerView.switchTab("new-request");
    })()
  `);
  await new Promise((r) => setTimeout(r, 1000));

  // 3. Test rapid typing in pickup and destination inputs
  console.log('Testing rapid typing in address fields (debounce check)...');
  const debounceCheck = await evaluate(`
    (async () => {
      const { LocationService } = await import('/src/services/location.js');
      const input = document.getElementById("req-pickup");
      let calls = 0;
      const originalSearch = LocationService.searchAddress.bind(LocationService);
      LocationService.searchAddress = async (q) => { calls++; return originalSearch(q); };

      // Rapidly fire input events
      input.value = "M";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.value = "Mid";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.value = "Midlands";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.value = "Midlands State";
      input.dispatchEvent(new Event("input", { bubbles: true }));

      // Wait 100ms (within debounce)
      await new Promise(r => setTimeout(r, 100));
      const callsBeforeDebounce = calls;

      // Wait 500ms (after debounce)
      await new Promise(r => setTimeout(r, 500));
      const callsAfterDebounce = calls;

      LocationService.searchAddress = originalSearch;
      return { callsBeforeDebounce, callsAfterDebounce };
    })()
  `);
  console.log('Debounce result:', debounceCheck);

  // 4. Select Pickup: "Midlands State University Batanai Campus"
  // Destination: "Sunningdale, Gweru"
  console.log('Setting Pickup and Destination coordinates...');
  const setupTrip = await evaluate(`
    (async () => {
      const { CustomerView } = await import('/src/views/CustomerView.js');
      // Set pickup
      await CustomerView.setPickup(-19.4977, 29.8410, "Midlands State University Batanai Campus");
      // Set destination
      await CustomerView.setDestination(-19.4280, 29.8320, "Sunningdale, Gweru");

      // Verify route was drawn and price auto-calculated
      const priceInput = document.getElementById("req-suggested-price");
      const distInput = document.getElementById("req-distance");
      const submitBtn = document.getElementById("btn-submit-request");

      return {
        distanceKm: CustomerView.distanceKm,
        durationMins: CustomerView.durationMins,
        suggestedPrice: priceInput?.value,
        distanceText: distInput?.value,
        buttonDisabled: submitBtn?.disabled,
        buttonText: submitBtn?.innerText
      };
    })()
  `);
  console.log('Resolved Trip Details on Screen:', setupTrip);

  // 5. Test Double-Click Publish Protection
  console.log('Pressing Publish button with double-click simulation...');
  const publishResult = await evaluate(`
    (async () => {
      const { CustomerView } = await import('/src/views/CustomerView.js');
      const submitBtn = document.getElementById("btn-submit-request");
      const form = document.getElementById("create-request-form");

      // Count route calculations during publish
      const { LocationService } = await import('/src/services/location.js');
      let routeRecalcCalls = 0;
      const origCalcRoute = LocationService.calculateRoute.bind(LocationService);
      LocationService.calculateRoute = async (...args) => { routeRecalcCalls++; return origCalcRoute(...args); };

      let geocodeCalls = 0;
      const origSearch = LocationService.searchAddress.bind(LocationService);
      LocationService.searchAddress = async (...args) => { geocodeCalls++; return origSearch(...args); };

      // Trigger first click
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

      // Button state immediately after first click
      const immediateBtnDisabled = submitBtn.disabled;
      const immediateBtnText = submitBtn.innerText;

      // Immediately attempt second click (double click)
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

      // Wait for submission to finish
      for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 200));
        if (CustomerView.matchingRequestId) break;
      }

      LocationService.calculateRoute = origCalcRoute;
      LocationService.searchAddress = origSearch;

      return {
        immediateBtnDisabled,
        immediateBtnText,
        matchingRequestId: CustomerView.matchingRequestId,
        routeRecalcCalls,
        geocodeCalls
      };
    })()
  `);
  console.log('Publish Execution Result:', publishResult);

  // 6. Verify Appwrite document creation
  console.log('Verifying Appwrite Database document...');
  const reqDocId = publishResult.matchingRequestId;
  let appwriteDoc = null;
  if (reqDocId) {
    const res = await fetch(`${conf.APPWRITE_ENDPOINT}/databases/transmove/collections/service_requests/documents/${reqDocId}`, {
      headers: serverHeaders
    });
    if (res.ok) {
      appwriteDoc = await res.json();
      console.log('Appwrite document verified:', appwriteDoc.$id, appwriteDoc.pickup_location, '->', appwriteDoc.destination);
    }
  }

  // 7. Verify no browser alert was shown
  console.log('Alert dialog shown:', alertDialogShown || 'None (PASS - toasts used)');

  // 8. Capture screenshot of the matching experience
  const screenshot = await sendSession('Page.captureScreenshot', { format: 'png' });
  const screenshotPath = 'C:\\Users\\PC\\.gemini\\antigravity-ide\\brain\\ae0487d9-6ec2-43d3-8f9d-b24dc7d17341\\request_publish_success.png';
  fs.writeFileSync(screenshotPath, Buffer.from(screenshot.data, 'base64'));
  console.log('Saved success screenshot to:', screenshotPath);

  // 9. Cleanup created request and user
  if (reqDocId) {
    await fetch(`${conf.APPWRITE_ENDPOINT}/databases/transmove/collections/service_requests/documents/${reqDocId}`, {
      method: 'DELETE',
      headers: serverHeaders
    });
    console.log('Cleaned up test request:', reqDocId);
  }

  if (authRes.userId) {
    await fetch(`${conf.APPWRITE_ENDPOINT}/users/${authRes.userId}`, {
      method: 'DELETE',
      headers: serverHeaders
    });
    console.log('Cleaned up test passenger:', authRes.userId);
  }

  chromeProcess.kill();

  console.log('\n--- BROWSER TEST COMPLETE ---');
  console.log('Double-click prevented:', publishResult.immediateBtnDisabled && publishResult.immediateBtnText === 'Publishing...');
  console.log('Zero route recalculations on publish:', publishResult.routeRecalcCalls === 0);
  console.log('Zero geocoding calls on publish:', publishResult.geocodeCalls === 0);
  console.log('Request document created:', Boolean(appwriteDoc));
  console.log('No alert popup:', alertDialogShown === null);
}

run().catch((err) => {
  console.error('Browser Test Error:', err);
  process.exit(1);
});
