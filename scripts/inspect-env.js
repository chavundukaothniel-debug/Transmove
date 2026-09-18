import fs from 'fs';
import path from 'path';

console.log('=== ENVIRONMENT INSPECTION ===');
const checkPaths = [
  'C:\\Program Files\\Java',
  'C:\\Program Files (x86)\\Java',
  'C:\\Program Files\\Eclipse Adoptium',
  'C:\\Program Files\\Microsoft',
  'C:\\Program Files\\Android',
  'C:\\Program Files\\Android\\Android Studio',
  'C:\\Users\\PC\\AppData\\Local\\Android',
  'C:\\Users\\PC\\AppData\\Local\\Android\\Sdk',
  'C:\\Users\\PC\\.jdks',
  'C:\\Users\\PC\\.gradle',
  'C:\\Android',
  'C:\\tools'
];

for (const p of checkPaths) {
  try {
    if (fs.existsSync(p)) {
      console.log('FOUND:', p);
      const items = fs.readdirSync(p);
      console.log('  Contents:', items.slice(0, 10).join(', '));
    }
  } catch (e) {
    console.log('Error checking', p, e.message);
  }
}

// Check PATH
console.log('\n=== PATH SEARCH ===');
const pathDirs = (process.env.PATH || '').split(';');
for (const dir of pathDirs) {
  if (/java|jdk|android|sdk|gradle/i.test(dir)) {
    console.log('Matching PATH dir:', dir);
  }
}
