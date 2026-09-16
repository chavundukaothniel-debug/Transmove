import fs from 'fs';
import path from 'path';

function walkDir(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (file === 'node_modules' || file === '.git' || file === 'dist') continue;
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      walkDir(fullPath, fileList);
    } else if (file.endsWith('.js') || file.endsWith('.html') || file.endsWith('.env')) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

const allFiles = walkDir(process.cwd());
const results = [];

const patterns = [
  /supabase/i,
  /@supabase\/supabase-js/,
  /SUPABASE_/,
  /\.from\(/,
  /supabase\.auth/,
  /supabase\.storage/,
  /supabase\.channel/,
  /\.rpc\(/
];

for (const file of allFiles) {
  const content = fs.readFileSync(file, 'utf8');
  const relPath = path.relative(process.cwd(), file).replace(/\\/g, '/');
  
  let fileMatches = 0;
  for (const pat of patterns) {
    if (pat.test(content)) {
      fileMatches++;
    }
  }
  if (fileMatches > 0) {
    results.push(relPath);
  }
}

console.log('Files with Supabase references (' + results.length + ' files):');
results.sort().forEach(f => console.log(' - ' + f));
