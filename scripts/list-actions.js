import fs from 'fs';
const content = fs.readFileSync('netlify/functions/trusted-api.js', 'utf8');
const regex = /action\s*===\s*["']([^"']+)["']/g;
let match;
const actions = [];
while ((match = regex.exec(content)) !== null) {
  actions.push(match[1]);
}
console.log('Actions in trusted-api.js:\n', [...new Set(actions)].join('\n'));
