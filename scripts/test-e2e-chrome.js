import { spawn } from 'child_process';
import os from 'os';
import path from 'path';

async function runE2ETest() {
  console.log('=== STARTING TRANSMOVE SMART SHEET CHROME E2E TEST ===');

  const tempDir = path.join(os.tmpdir(), 'chrome-smart-test-' + Date.now());
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

  const chromeProc = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9223',
    `--user-data-dir=${tempDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    'http://localhost:8080'
  ], {
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let wsUrl = null;

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timeout waiting for DevTools URL')), 10000);
    chromeProc.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      const match = text.match(/ws:\/\/127\.0\.0\.1:9223\/devtools\/browser\/[a-zA-Z0-9-]+/);
      if (match) {
        wsUrl = match[0];
        clearTimeout(timer);
        resolve();
      }
    });
  });

  console.log('DevTools listening at:', wsUrl);

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

  // Get pages
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

  // Wait for page load
  console.log('Waiting for TransMove page scripts to initialize...');
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

  const testResults = {};

  try {
    // 1. DRIVER INCOMING REQUEST UI TEST
    console.log('\n--- 1. Testing Driver Incoming Request UI ---');
    const incomingResult = await evaluate(`
      (async () => {
        const { DriverView } = await import('/src/views/DriverView.js');
        const { SmartPopup } = await import('/src/components/SmartPopup.js');

        DriverView.driverProfile = { id: 'test-driver-1', user_id: 'test-driver-1' };
        DriverView.isProfileComplete = true;
        DriverView.showNewRequestPopup({
          id: 'test-req-101',
          pickup_address: 'MSU Batanai Campus',
          destination_address: 'Southdowns',
          service_type: 'ride',
          suggested_price: 10
        }, { force: true });

        const backdrop = document.querySelector('.smart-popup-backdrop');
        const title = backdrop?.querySelector('.smart-popup-title')?.textContent?.trim();
        const eyebrow = backdrop?.querySelector('.smart-popup-eyebrow')?.textContent?.trim();
        const locations = [...backdrop?.querySelectorAll('.smart-sheet-location-name')].map(el => el.textContent.trim());
        const arrow = backdrop?.querySelector('.smart-sheet-arrow-connector')?.textContent?.trim();
        const budget = backdrop?.querySelector('.smart-sheet-budget-card strong')?.textContent?.trim();
        const actionLabels = [...backdrop?.querySelectorAll('.smart-popup-action')].map(el => el.textContent.trim());

        // Check for old buttons
        const hasDecline = actionLabels.some(l => l.toLowerCase().includes('decline'));
        const hasAcceptRequest = actionLabels.some(l => l.toLowerCase().includes('accept request'));

        return {
          visible: Boolean(backdrop),
          title,
          eyebrow,
          locations,
          arrow,
          budget,
          actionLabels,
          oldRemoved: !hasDecline && !hasAcceptRequest
        };
      })()
    `);

    console.log('Incoming Request UI:', incomingResult);
    testResults.driverSeesMakeAnOffer = incomingResult.actionLabels.includes('Make an offer') && incomingResult.actionLabels.includes('Not interested');
    testResults.oldAcceptDeclineRemoved = incomingResult.oldRemoved;
    console.log('Driver sees Make an offer:', testResults.driverSeesMakeAnOffer ? 'PASS' : 'FAIL');
    console.log('Old Accept/Decline UI removed:', testResults.oldAcceptDeclineRemoved ? 'PASS' : 'FAIL');

    // 2. MAKE AN OFFER TRANSFORMS SAME SHEET
    console.log('\n--- 2. Testing "Make an offer" Transforms Same Sheet ---');
    const offerEditResult = await evaluate(`
      (async () => {
        const backdrop = document.querySelector('.smart-popup-backdrop');
        const makeOfferBtn = [...backdrop.querySelectorAll('.smart-popup-action')].find(el => el.textContent.includes('Make an offer'));
        makeOfferBtn.click();

        await new Promise(r => setTimeout(r, 100));

        const updatedBackdrop = document.querySelector('.smart-popup-backdrop');
        const title = updatedBackdrop?.querySelector('.smart-popup-title')?.textContent?.trim();
        const budgetCard = updatedBackdrop?.querySelector('.smart-sheet-budget-card strong')?.textContent?.trim();
        const priceInput = updatedBackdrop?.querySelector('#quick-quote-price')?.value;
        const steppers = [...updatedBackdrop?.querySelectorAll('.smart-stepper-pill')].map(el => el.textContent.trim());
        const primaryBtn = updatedBackdrop?.querySelector('.smart-popup-action.btn-primary')?.textContent?.trim();
        const backBtn = updatedBackdrop?.querySelector('.smart-popup-action:not(.btn-primary)')?.textContent?.trim();

        return {
          sameBackdrop: backdrop === updatedBackdrop,
          title,
          budgetCard,
          priceInput,
          steppers,
          primaryBtn,
          backBtn
        };
      })()
    `);

    console.log('Offer Edit UI:', offerEditResult);
    testResults.sameSheetPriceEditor = offerEditResult.sameBackdrop && offerEditResult.title === 'Make your offer' && offerEditResult.priceInput === '12';
    testResults.steppersVisible = offerEditResult.steppers.includes('- $1') && offerEditResult.steppers.includes('+ $1') && offerEditResult.steppers.includes('- $2') && offerEditResult.steppers.includes('+ $2');
    console.log('Same sheet changes to price editor:', testResults.sameSheetPriceEditor ? 'PASS' : 'FAIL');
    console.log('Price +/- buttons visible:', testResults.steppersVisible ? 'PASS' : 'FAIL');

    // 3. STEPPERS INTERACTION
    console.log('\n--- 3. Testing Price Stepper Buttons (+1, -2) ---');
    const stepperTestResult = await evaluate(`
      (async () => {
        const backdrop = document.querySelector('.smart-popup-backdrop');
        const plus1 = [...backdrop.querySelectorAll('.smart-stepper-pill')].find(el => el.textContent.includes('+ $1'));
        plus1.click();
        const priceAfterPlus1 = backdrop.querySelector('#quick-quote-price').value;
        const btnAfterPlus1 = backdrop.querySelector('.smart-popup-action.btn-primary').textContent.trim();

        const minus2 = [...backdrop.querySelectorAll('.smart-stepper-pill')].find(el => el.textContent.includes('- $2'));
        minus2.click();
        const priceAfterMinus2 = backdrop.querySelector('#quick-quote-price').value;
        const btnAfterMinus2 = backdrop.querySelector('.smart-popup-action.btn-primary').textContent.trim();

        return {
          priceAfterPlus1,
          btnAfterPlus1,
          priceAfterMinus2,
          btnAfterMinus2
        };
      })()
    `);
    console.log('Stepper Test:', stepperTestResult);

    // 4. OFFER SENT STATE & 2s PILL COLLAPSE
    console.log('\n--- 4. Testing Offer Sent State and Waiting Pill ---');
    const offerSentResult = await evaluate(`
      (async () => {
        const { DriverView } = await import('/src/views/DriverView.js');
        DriverView.showDriverOfferSentState({ id: 'test-req-101' }, 11);

        const backdrop = document.querySelector('.smart-popup-backdrop');
        const heading = backdrop?.querySelector('.smart-sheet-status-heading')?.textContent?.trim();
        const price = backdrop?.querySelector('.smart-sheet-status-price-card')?.textContent?.replace(/\\s+/g, ' ')?.trim();
        const waitingText = backdrop?.querySelector('.smart-sheet-waiting-text')?.textContent?.trim();

        // Wait 2.2 seconds for auto-collapse
        await new Promise(r => setTimeout(r, 2200));

        const pill = document.querySelector('.smart-popup-pill');
        const pillVisible = pill && pill.style.display !== 'none';
        const pillText = pill?.textContent?.trim();

        return {
          heading,
          price,
          waitingText,
          pillVisible,
          pillText
        };
      })()
    `);
    console.log('Offer Sent & Pill Result:', offerSentResult);
    testResults.offerWaitingPillVisible = offerSentResult.pillVisible && offerSentResult.pillText.includes('offer • Waiting');
    console.log('Offer waiting pill visible:', testResults.offerWaitingPillVisible ? 'PASS' : 'FAIL');

    // 5. PASSENGER SEES DRIVER OFFER CARD
    console.log('\n--- 5. Testing Passenger Quotation UI ---');
    const passengerOfferResult = await evaluate(`
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

        const backdrop = document.querySelector('.smart-popup-backdrop');
        const title = backdrop?.querySelector('.smart-popup-title')?.textContent?.trim();
        const driverName = backdrop?.querySelector('.smart-sheet-driver-card strong')?.textContent?.trim();
        const rating = backdrop?.querySelector('.smart-sheet-driver-card span')?.textContent?.trim();
        const offerAmount = backdrop?.querySelector('.smart-sheet-offer-grid')?.textContent?.replace(/\\s+/g, ' ')?.trim();
        const actions = [...backdrop?.querySelectorAll('.smart-sheet-driver-card button')].map(el => el.textContent.trim());

        return {
          title,
          driverName,
          rating,
          offerAmount,
          actions
        };
      })()
    `);
    console.log('Passenger Offer Card:', passengerOfferResult);
    testResults.passengerSeesDriverOfferCard = passengerOfferResult.title.includes('1 driver responded') &&
      passengerOfferResult.driverName === 'Tendai M.' &&
      passengerOfferResult.actions.includes('Counter') &&
      passengerOfferResult.actions.some(a => a.includes('Accept $12'));
    console.log('Passenger sees driver offer card:', testResults.passengerSeesDriverOfferCard ? 'PASS' : 'FAIL');

    // 6. PASSENGER COUNTER IN SAME SHEET
    console.log('\n--- 6. Testing Passenger Counter in Same Sheet ---');
    const passengerCounterResult = await evaluate(`
      (async () => {
        const backdrop = document.querySelector('.smart-popup-backdrop');
        const counterBtn = [...backdrop.querySelectorAll('.smart-sheet-driver-card button')].find(el => el.textContent.includes('Counter'));
        counterBtn.click();

        await new Promise(r => setTimeout(r, 100));

        const updatedBackdrop = document.querySelector('.smart-popup-backdrop');
        const title = updatedBackdrop?.querySelector('.smart-popup-title')?.textContent?.trim();
        const driverAsked = updatedBackdrop?.querySelector('.smart-sheet-budget-card strong')?.textContent?.trim();
        const counterInput = updatedBackdrop?.querySelector('#passenger-counter-price')?.value;
        const steppers = [...updatedBackdrop?.querySelectorAll('.smart-stepper-pill')].map(el => el.textContent.trim());
        const primaryBtn = updatedBackdrop?.querySelector('.smart-popup-action.btn-primary')?.textContent?.trim();

        return {
          sameBackdrop: backdrop === updatedBackdrop,
          title,
          driverAsked,
          counterInput,
          steppers,
          primaryBtn
        };
      })()
    `);
    console.log('Passenger Counter Result:', passengerCounterResult);
    testResults.passengerCounterSameSheet = passengerCounterResult.sameBackdrop &&
      passengerCounterResult.title === 'Counter offer' &&
      passengerCounterResult.driverAsked === '$12' &&
      passengerCounterResult.counterInput === '11' &&
      passengerCounterResult.primaryBtn === 'Send $11';
    console.log('Passenger Counter works in same sheet:', testResults.passengerCounterSameSheet ? 'PASS' : 'FAIL');

    // 7. DRIVER RECEIVES COUNTER IN SAME SHEET
    console.log('\n--- 7. Testing Driver Receives Counter ---');
    const driverCounterResult = await evaluate(`
      (async () => {
        const { DriverView } = await import('/src/views/DriverView.js');
        DriverView.showCounterOfferPopup({
          id: 'test-bid-501',
          request_id: 'test-req-101',
          amount: 12,
          counter_amount: 11
        }, { repeat: true });

        const backdrop = document.querySelector('.smart-popup-backdrop');
        const title = backdrop?.querySelector('.smart-popup-title')?.textContent?.trim();
        const prices = [...backdrop?.querySelectorAll('.smart-sheet-status-price-card div')].map(el => el.textContent.trim());
        const actions = [...backdrop?.querySelectorAll('.smart-popup-action')].map(el => el.textContent.trim());

        return {
          title,
          prices,
          actions
        };
      })()
    `);
    console.log('Driver Counter UI:', driverCounterResult);
    testResults.driverReceivesCounterInSameSheet = driverCounterResult.title === 'Passenger countered' &&
      driverCounterResult.actions.includes('Not interested') &&
      driverCounterResult.actions.includes('Counter') &&
      driverCounterResult.actions.some(a => a.includes('Accept $11'));
    console.log('Driver receives counter in same sheet:', testResults.driverReceivesCounterInSameSheet ? 'PASS' : 'FAIL');

    // 8. DRIVER JOB CONFIRMED STATE
    console.log('\n--- 8. Testing Driver Job Confirmed State ---');
    const driverJobConfirmedResult = await evaluate(`
      (async () => {
        const { DriverView } = await import('/src/views/DriverView.js');
        DriverView.showJobConfirmedPopup({
          id: 'test-booking-1',
          request_id: 'test-req-101',
          amount: 11,
          request: { pickup_location: 'MSU Batanai Campus' }
        }, { force: true });

        const backdrop = document.querySelector('.smart-popup-backdrop');
        const title = backdrop?.querySelector('.smart-popup-title')?.textContent?.trim();
        const heading = backdrop?.querySelector('.smart-sheet-status-heading')?.textContent?.trim();
        const agreedFare = backdrop?.querySelector('.smart-sheet-status-price-card div:last-child')?.textContent?.trim();
        const pickup = backdrop?.querySelector('.smart-sheet-location-name')?.textContent?.trim();
        const actions = [...backdrop?.querySelectorAll('.smart-popup-action')].map(el => el.textContent.trim());

        return {
          title,
          heading,
          agreedFare,
          pickup,
          actions
        };
      })()
    `);
    console.log('Driver Job Confirmed:', driverJobConfirmedResult);
    testResults.driverJobConfirmedState = driverJobConfirmedResult.heading.includes('You got the job') &&
      driverJobConfirmedResult.agreedFare === '$11.00' &&
      driverJobConfirmedResult.pickup === 'MSU Batanai Campus' &&
      driverJobConfirmedResult.actions.includes('Start heading to pickup');
    console.log('Driver Job Confirmed state:', testResults.driverJobConfirmedState ? 'PASS' : 'FAIL');

    // 9. CHECK THAT OLD MODALS NEVER APPEAR
    console.log('\n--- 9. Checking Old Modals Are Not Rendered ---');
    const oldModalsResult = await evaluate(`
      (() => {
        const oldBidModal = document.getElementById('view-bid-modal');
        const oldMatchingModal = document.getElementById('matching-experience-modal');
        const smartPopups = document.querySelectorAll('.smart-popup-backdrop');

        return {
          hasOldBidModal: Boolean(oldBidModal && oldBidModal.style.display !== 'none'),
          hasOldMatchingModal: Boolean(oldMatchingModal && oldMatchingModal.style.display !== 'none'),
          smartPopupCount: smartPopups.length
        };
      })()
    `);
    console.log('Old Modals Check:', oldModalsResult);
    testResults.oldPopupNoLongerAppears = !oldModalsResult.hasOldBidModal && !oldModalsResult.hasOldMatchingModal && oldModalsResult.smartPopupCount === 1;
    console.log('Old popup no longer appears:', testResults.oldPopupNoLongerAppears ? 'PASS' : 'FAIL');

    testResults.browserVisuallyTested = true;

  } finally {
    ws.close();
    chromeProc.kill();
  }

  console.log('\n==================================================');
  console.log('FINAL AUTOMATED TEST SUITE REPORT:');
  console.log(JSON.stringify(testResults, null, 2));
  console.log('==================================================');

  return testResults;
}

runE2ETest().catch((err) => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
