import { spawn } from 'child_process';
import os from 'os';
import path from 'path';
import fs from 'fs';

const artifactDir = 'C:\\Users\\PC\\.gemini\\antigravity-ide\\brain\\ae0487d9-6ec2-43d3-8f9d-b24dc7d17341';

async function captureScreenshots() {
  console.log('=== CAPTURING SMART SHEET SCREENSHOTS VIA CHROME CDP ===');

  const tempDir = path.join(os.tmpdir(), 'chrome-screens-' + Date.now());
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

  const chromeProc = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9224',
    `--user-data-dir=${tempDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    '--window-size=430,932',
    'http://localhost:8080'
  ], {
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let wsUrl = null;
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timeout waiting for DevTools URL')), 10000);
    chromeProc.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      const match = text.match(/ws:\/\/127\.0\.0\.1:9224\/devtools\/browser\/[a-zA-Z0-9-]+/);
      if (match) {
        wsUrl = match[0];
        clearTimeout(timer);
        resolve();
      }
    });
  });

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
    const res = await send('Target.createTarget', { url: 'http://localhost:8080' });
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
  await sendSession('Emulation.setDeviceMetricsOverride', {
    width: 412,
    height: 892,
    deviceScaleFactor: 2,
    mobile: true
  });

  await new Promise((r) => setTimeout(r, 2000));

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

  async function takeScreenshot(name) {
    const { data } = await sendSession('Page.captureScreenshot', { format: 'png' });
    const filePath = path.join(artifactDir, `${name}.png`);
    fs.writeFileSync(filePath, Buffer.from(data, 'base64'));
    console.log(`Saved screenshot: ${name}.png`);
  }

  try {
    // 1. Driver Incoming Request
    await evaluate(`
      (async () => {
        const { DriverView } = await import('/src/views/DriverView.js');
        const { SmartPopup } = await import('/src/components/SmartPopup.js');
        SmartPopup.clear();
        DriverView.driverProfile = { id: 'test-driver-1', user_id: 'test-driver-1' };
        DriverView.isProfileComplete = true;
        DriverView.showNewRequestPopup({
          id: 'test-req-101',
          pickup_address: 'MSU Batanai Campus',
          destination_address: 'Southdowns',
          service_type: 'ride',
          suggested_price: 10
        }, { force: true });
      })()
    `);
    await new Promise((r) => setTimeout(r, 400));
    await takeScreenshot('driver_incoming_request');

    // 2. Driver Make an Offer / Price Editor
    await evaluate(`
      (async () => {
        const backdrop = document.querySelector('.smart-popup-backdrop');
        const makeOfferBtn = [...backdrop.querySelectorAll('.smart-popup-action')].find(el => el.textContent.includes('Make an offer'));
        makeOfferBtn?.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 400));
    await takeScreenshot('driver_make_offer_editor');

    // 3. Driver Offer Sent State
    await evaluate(`
      (async () => {
        const { DriverView } = await import('/src/views/DriverView.js');
        DriverView.showDriverOfferSentState({ id: 'test-req-101' }, 12);
      })()
    `);
    await new Promise((r) => setTimeout(r, 400));
    await takeScreenshot('driver_offer_sent');

    // 4. Passenger Sees Driver Offer Card
    await evaluate(`
      (async () => {
        const { CustomerView } = await import('/src/views/CustomerView.js');
        const { SmartPopup } = await import('/src/components/SmartPopup.js');
        SmartPopup.clear();
        CustomerView.currentProfile = { id: 'test-passenger-1', user_id: 'test-passenger-1' };
        CustomerView.showQuotationPopup({
          id: 'test-bid-501',
          request_id: 'test-req-101',
          status: 'pending',
          amount: 12,
          estimated_arrival_mins: 8,
          driver: { full_name: 'Tendai M.', rating: 4.8 },
          vehicle: { make: 'Toyota', model: 'Aqua', registration_number: 'ABC 1234' }
        }, false, { force: true });
      })()
    `);
    await new Promise((r) => setTimeout(r, 400));
    await takeScreenshot('passenger_offer_card');

    // 5. Passenger Counter Price Editor
    await evaluate(`
      (async () => {
        const backdrop = document.querySelector('.smart-popup-backdrop');
        const counterBtn = [...backdrop.querySelectorAll('.smart-sheet-driver-card button')].find(el => el.textContent.includes('Counter'));
        counterBtn?.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 400));
    await takeScreenshot('passenger_counter_editor');

    // 6. Driver Receives Counter
    await evaluate(`
      (async () => {
        const { DriverView } = await import('/src/views/DriverView.js');
        DriverView.showCounterOfferPopup({
          id: 'test-bid-501',
          request_id: 'test-req-101',
          amount: 12,
          counter_amount: 11
        }, { repeat: true });
      })()
    `);
    await new Promise((r) => setTimeout(r, 400));
    await takeScreenshot('driver_passenger_countered');

    // 7. Passenger Driver Confirmed
    await evaluate(`
      (async () => {
        const { CustomerView } = await import('/src/views/CustomerView.js');
        CustomerView.showDriverConfirmedPopup({
          id: 'test-booking-1',
          request_id: 'test-req-101',
          amount: 11,
          driver: { full_name: 'Tendai M.' },
          vehicle: { make: 'Toyota', model: 'Aqua', registration_number: 'ABC 1234' }
        }, { force: true });
      })()
    `);
    await new Promise((r) => setTimeout(r, 400));
    await takeScreenshot('passenger_driver_confirmed');

    // 8. Driver Job Confirmed
    await evaluate(`
      (async () => {
        const { DriverView } = await import('/src/views/DriverView.js');
        DriverView.showJobConfirmedPopup({
          id: 'test-booking-1',
          request_id: 'test-req-101',
          amount: 11,
          request: { pickup_location: 'MSU Batanai Campus' }
        }, { force: true });
      })()
    `);
    await new Promise((r) => setTimeout(r, 400));
    await takeScreenshot('driver_job_confirmed');

  } finally {
    ws.close();
    chromeProc.kill();
  }

  console.log('=== ALL SCREENSHOTS CAPTURED SUCCESSFULLY ===');
}

captureScreenshots().catch((err) => {
  console.error('Screenshot capture failed:', err);
  process.exit(1);
});
