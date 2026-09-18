import { execSync } from 'child_process';

const commands = ['winget --version', 'choco --version', 'scoop --version'];
for (const cmd of commands) {
  try {
    const out = execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    console.log(`${cmd}: ${out.trim()}`);
  } catch (e) {
    console.log(`${cmd}: not available`);
  }
}
