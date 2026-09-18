import { spawn } from 'child_process';
import os from 'os';
import path from 'path';

const tempDir = path.join(os.tmpdir(), 'chrome-test-profile-' + Date.now());
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

console.log('Launching Chrome with temp profile:', tempDir);
const chrome = spawn(chromePath, [
  '--headless=new',
  '--remote-debugging-port=9222',
  `--user-data-dir=${tempDir}`,
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-gpu',
  'about:blank'
], {
  detached: true,
  stdio: 'ignore'
});
chrome.unref();

console.log('Spawned Chrome PID:', chrome.pid);
