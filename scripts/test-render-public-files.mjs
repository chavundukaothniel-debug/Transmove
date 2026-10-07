import assert from 'node:assert/strict';
import path from 'node:path';
import { resolvePublicFile } from '../src/server/public-files.js';
const root=process.cwd();
for(const base of [root,path.join(root,'site-dist')]) {
  for(const url of ['/','/about.html','/privacy.html','/terms.html','/googlea4ceea99234e80f4.html','/install-ios.html','/assets/css/style.css','/src/components/PortalGuide.js','/downloads/transmove-android.apk']) assert.ok(resolvePublicFile(url,base),url);
  for(const url of ['/.env','/.git/config','/server.js','/package.json','/src/server/supabase-backend.js','/assets/../../server.js','/assets/%2e%2e/%2e%2e/server.js','/assets/%5c..%5cserver.js','/bad%ZZ','/sql/schema.sql']) assert.equal(resolvePublicFile(url,base),null,url);
}
console.log('PASS: Render public files and downloads resolve; private files and traversal are blocked.');
