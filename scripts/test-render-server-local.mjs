import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
const child=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:'8127',SUPABASE_URL:'',SUPABASE_SERVICE_ROLE_KEY:'',SUPABASE_ANON_KEY:''},stdio:['ignore','ignore','pipe']});
child.stderr.on('data',data=>process.stderr.write(data));
try {
  let ready=false;
  for(let i=0;i<300;i++){try{const r=await fetch('http://127.0.0.1:8127/healthz',{signal:AbortSignal.timeout(1000)});if(r.ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,300));}
  assert.ok(ready,'Server did not become ready');
  for(const url of ['/','/install-ios.html','/src/components/PortalGuide.js']){const r=await fetch('http://127.0.0.1:8127'+url);assert.equal(r.status,200,url);assert.equal(r.headers.get('cache-control'),'no-cache');}
  const apk=await fetch('http://127.0.0.1:8127/downloads/transmove-android.apk');assert.equal(apk.status,200);assert.match(apk.headers.get('content-type'),/android/);assert.match(apk.headers.get('content-disposition'),/attachment/);await apk.body.cancel();
  for(const url of ['/.env','/server.js','/src/server/supabase-backend.js','/package.json']){const r=await fetch('http://127.0.0.1:8127'+url);assert.equal(r.status,404,url);}
  const config=await fetch('http://127.0.0.1:8127/api/public-config');assert.equal(config.status,200);assert.ok((await config.json()).supabaseUrl);
  console.log('PASS: Render health, public app, iPhone install page, APK download, cache revalidation, config endpoint and private file isolation.');
} finally {child.kill();}
