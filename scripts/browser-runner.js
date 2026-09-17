import { spawn } from 'child_process';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

export class BrowserRunner {
  constructor(options = {}) {
    this.port = options.port || 9222;
    this.baseUrl = options.baseUrl || 'http://localhost:8080';
    this.chromeProcess = null;
    this.ws = null;
    this.msgId = 1;
    this.pending = new Map();
    this.sessionId = null;
    this.consoleLogs = [];
    this.consoleErrors = [];
    this.networkErrors = [];
  }

  async start() {
    this.chromeProcess = spawn(CHROME_PATH, [
      '--headless=new',
      `--remote-debugging-port=${this.port}`,
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      '--window-size=1280,800',
      'about:blank'
    ]);

    let wsUrl = null;
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 400));
      try {
        const res = await fetch(`http://localhost:${this.port}/json/version`);
        if (res.ok) {
          const data = await res.json();
          wsUrl = data.webSocketDebuggerUrl;
          break;
        }
      } catch (_) {}
    }

    if (!wsUrl) {
      this.chromeProcess.kill();
      throw new Error(`Could not connect to Chrome CDP on port ${this.port}`);
    }

    this.ws = new WebSocket(wsUrl);
    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.pending.has(msg.id)) {
        this.pending.get(msg.id)(msg);
        this.pending.delete(msg.id);
      } else if (msg.method === 'Runtime.consoleAPICalled') {
        const type = msg.params.type;
        const text = msg.params.args.map((a) => (a.value !== undefined ? String(a.value) : a.description || '')).join(' ');
        this.consoleLogs.push({ type, text });
        if (type === 'error') {
          this.consoleErrors.push(text);
        }
      } else if (msg.method === 'Runtime.exceptionThrown') {
        const text = msg.params.exceptionDetails?.text || 'Uncaught exception';
        const desc = msg.params.exceptionDetails?.exception?.description || '';
        this.consoleErrors.push(`${text}: ${desc}`);
      } else if (msg.method === 'Network.responseReceived') {
        const status = msg.params.response?.status;
        const url = msg.params.response?.url;
        if (status >= 400) {
          this.networkErrors.push({ url, status });
        }
      }
    };

    await new Promise((r) => (this.ws.onopen = r));

    // Create and attach to page
    const target = await this.sendRoot('Target.createTarget', { url: 'about:blank' });
    const targetId = target.result.targetId;
    const session = await this.sendRoot('Target.attachToTarget', { targetId, flatten: true });
    this.sessionId = session.result.sessionId;

    await this.sendSession('Page.enable');
    await this.sendSession('Runtime.enable');
    await this.sendSession('Network.enable');
    await this.sendSession('DOM.enable');

    return this;
  }

  sendRoot(method, params = {}) {
    return new Promise((resolve) => {
      const id = this.msgId++;
      this.pending.set(id, resolve);
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  sendSession(method, params = {}) {
    return new Promise((resolve) => {
      const id = this.msgId++;
      this.pending.set(id, resolve);
      this.ws.send(JSON.stringify({ id, sessionId: this.sessionId, method, params }));
    });
  }

  async navigate(hash = '') {
    const fullUrl = `${this.baseUrl}/${hash.startsWith('#') ? hash : '#' + hash}`;
    await this.sendSession('Page.navigate', { url: fullUrl });
    await this.waitForReady();
  }

  async setHash(hash) {
    const cleanHash = hash.startsWith('#') ? hash : '#' + hash;
    await this.evaluate(`window.location.hash = '${cleanHash}'`);
    await this.wait(400);
    await this.waitForReady();
  }

  async waitForReady(timeoutMs = 5000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const ready = await this.evaluate(`document.readyState === 'complete' && Boolean(document.getElementById('app-root'))`);
      if (ready) {
        await this.wait(200);
        return true;
      }
      await this.wait(100);
    }
    return false;
  }

  async evaluate(expression) {
    const res = await this.sendSession('Runtime.evaluate', {
      expression: typeof expression === 'function' ? `(${expression.toString()})()` : String(expression),
      returnByValue: true,
      awaitPromise: true
    });
    if (res.result?.exceptionDetails) {
      throw new Error(res.result.exceptionDetails.exception?.description || res.result.exceptionDetails.text);
    }
    return res.result?.result?.value;
  }

  async waitForSelector(selector, timeoutMs = 5000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const found = await this.evaluate(`Boolean(document.querySelector('${selector}'))`);
      if (found) return true;
      await this.wait(100);
    }
    throw new Error(`Selector '${selector}' not found within ${timeoutMs}ms`);
  }

  async click(selector) {
    await this.waitForSelector(selector, 5000);
    return this.evaluate(`
      (() => {
        const el = document.querySelector('${selector}');
        if (!el) throw new Error('Element not found: ${selector}');
        el.scrollIntoView({ behavior: 'instant', block: 'center' });
        el.click();
        return true;
      })()
    `);
  }

  async type(selector, text) {
    await this.waitForSelector(selector, 5000);
    return this.evaluate(`
      (() => {
        const el = document.querySelector('${selector}');
        if (!el) throw new Error('Element not found: ${selector}');
        el.focus();
        el.value = ${JSON.stringify(text)};
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      })()
    `);
  }

  async selectOption(selector, value) {
    await this.waitForSelector(selector, 5000);
    return this.evaluate(`
      (() => {
        const el = document.querySelector('${selector}');
        if (!el) throw new Error('Element not found: ${selector}');
        el.value = ${JSON.stringify(value)};
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      })()
    `);
  }

  async getText(selector) {
    return this.evaluate(`
      (() => {
        const el = document.querySelector('${selector}');
        return el ? el.innerText.trim() : null;
      })()
    `);
  }

  async exists(selector) {
    return this.evaluate(`Boolean(document.querySelector('${selector}'))`);
  }

  async getCurrentHash() {
    return this.evaluate(`window.location.hash`);
  }

  async setViewport(width, height, isMobile = false) {
    await this.sendSession('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: isMobile
    });
  }

  clearErrors() {
    this.consoleErrors = [];
    this.networkErrors = [];
  }

  wait(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  async close() {
    if (this.ws) {
      try {
        this.ws.close();
      } catch (_) {}
    }
    if (this.chromeProcess) {
      try {
        this.chromeProcess.kill();
      } catch (_) {}
    }
  }
}
