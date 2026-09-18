// Verification test for DriverRequestCard timer, persistence, queueing, and dismiss
import { DriverRequestCard } from "../src/components/DriverRequestCard.js";

// Mock document and window for Node environment testing
const listeners = new Map();
class MockElement {
  constructor(id = "", className = "") {
    this.id = id;
    this.className = className;
    this.children = [];
    this.style = {};
    this.textContent = "";
    this.innerHTML = "";
    this._attrs = {};
  }
  setAttribute(k, v) { this._attrs[k] = v; }
  getAttribute(k) { return this._attrs[k]; }
  appendChild(child) { this.children.push(child); }
  remove() {
    if (this.parentNode) {
      this.parentNode.children = this.parentNode.children.filter(c => c !== this);
    }
  }
  querySelector(sel) {
    return new MockElement(sel.replace(/^[#.]/, ""));
  }
  addEventListener(event, fn) {
    listeners.set(`${this.id || this.className}:${event}`, fn);
  }
}

globalThis.document = {
  body: new MockElement("body"),
  createElement: (tag) => new MockElement(),
  getElementById: (id) => globalThis.document.body.querySelector(`#${id}`)
};

console.log("--- TEST 1: Show single request & initial 10s countdown ---");
const job1 = {
  id: "job-101",
  pickup_address: "MSU Batanai Campus",
  destination_address: "Southdowns",
  service_type: "ride",
  suggested_price: 10
};

let offerOpened = false;
let dismissedLocally = false;
let timedOutLocally = false;

DriverRequestCard.show(job1, {
  onMakeOffer: (j) => { offerOpened = true; },
  onDismiss: (j) => { dismissedLocally = true; },
  onTimeout: (j) => { timedOutLocally = true; }
});

const remaining1 = DriverRequestCard.getRemainingMs("job-101");
console.log(`Initial remaining ms for job-101: ${remaining1}ms (<= 10000ms)`);
if (remaining1 > 0 && remaining1 <= 10000) {
  console.log("✓ PASS: Initial 10-second countdown registered");
} else {
  console.error("FAIL: Timer not started correctly");
  process.exit(1);
}

console.log("\n--- TEST 2: Timer persistence across polling ticks ---");
const firstTime = DriverRequestCard.timers.get("job-101");
// Simulate 2 seconds passing
DriverRequestCard.timers.set("job-101", firstTime - 2000);
const remainingAfter2s = DriverRequestCard.getRemainingMs("job-101");
console.log(`After 2s elapsed, remaining: ${remainingAfter2s}ms (~8000ms)`);

// Simulate polling arrives again with same job
DriverRequestCard.show(job1);
const remainingAfterPoll = DriverRequestCard.getRemainingMs("job-101");
console.log(`After polling tick arrives, remaining: ${remainingAfterPoll}ms`);

if (remainingAfterPoll <= 8000 && remainingAfterPoll > 7000) {
  console.log("✓ PASS: Timer did NOT reset to 10s upon polling tick");
} else {
  console.error("FAIL: Timer reset unexpectedly on polling tick!");
  process.exit(1);
}

console.log("\n--- TEST 3: Multi-request queueing ---");
const job2 = {
  id: "job-102",
  pickup_address: "Gweru CBD",
  destination_address: "Mkoba 6",
  service_type: "ride",
  suggested_price: 5
};
DriverRequestCard.show(job2);
console.log(`Queue length after adding job-102: ${DriverRequestCard.queue.length}`);
if (DriverRequestCard.queue.length === 1) {
  console.log("✓ PASS: Multiple requests are queued, not stacked on top of each other");
} else {
  console.error("FAIL: Queue handling failed");
  process.exit(1);
}

console.log("\n--- TEST 4: Make an offer stops timer immediately ---");
DriverRequestCard.handleMakeOffer();
if (offerOpened && DriverRequestCard.active === null && DriverRequestCard.isComposing === true) {
  console.log("✓ PASS: 'Make offer' stopped countdown immediately and opened quotation editor");
} else {
  console.error("FAIL: Make offer did not stop timer or transition state");
  process.exit(1);
}

// Complete quotation
DriverRequestCard.onQuotationClosed();
console.log("Quotation closed, next job in queue presented...");
if (DriverRequestCard.active && (DriverRequestCard.active.job.id === "job-102")) {
  console.log("✓ PASS: Next request in queue (job-102) presented after quotation finished");
} else {
  console.error("FAIL: Next request was not presented");
  process.exit(1);
}

console.log("\n--- TEST 5: Timeout (0s) dismisses only for current driver ---");
DriverRequestCard.handleTimeout();
if (DriverRequestCard.locallyDismissed.has("job-102") && DriverRequestCard.active === null) {
  console.log("✓ PASS: 0s timeout dismissed job-102 locally without global state interference");
} else {
  console.error("FAIL: Timeout did not dismiss locally");
  process.exit(1);
}

console.log("\nALL DRIVER REQUEST CARD LOGIC TESTS PASSED SUCCESSFULLY! ✓");
