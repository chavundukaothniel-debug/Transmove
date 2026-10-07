import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import assert from 'node:assert/strict';
import { BrowserRunner } from './browser-runner.js';
import { googleDriveStorage as storage } from '../src/server/google-drive-storage.js';

const original = storage._uploadFile;
try {
  storage._uploadFile = async () => { throw Object.assign(new Error('invalid_grant'), {response:{data:{error:'invalid_grant'}}}); };
  await assert.rejects(storage.uploadFile({}), error => error.code === 'DRIVE_AUTH_EXPIRED' && !error.message.includes('invalid_grant'));
  storage._uploadFile = async () => { throw new Error('Unsupported file type'); };
  await assert.rejects(storage.uploadFile({}), /Unsupported file type/);
  storage._uploadFile = async options => ({id:'test',name:options.originalFilename});
  assert.deepEqual(await storage.uploadFile({originalFilename:'photo.jpg'}), {id:'test',name:'photo.jpg'});
  console.log('PASS expired authorization mapping, other errors and successful upload');
} finally { storage._uploadFile = original; }

const root=process.cwd();
const fixture=`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/assets/css/style.css"><script src="/assets/js/vendor/supabase.min.js"></script><script src="/assets/js/vendor/lucide.min.js"></script><main id="fixture" style="padding:16px"></main><script type="module">import {ProfileView as P} from '/src/views/ProfileView.js';window.P=P;document.querySelector('#fixture').innerHTML=await P.render({role:'driver'});document.querySelector('#photo-preview-notice').style.display='flex';P.showUploadMessage('photo','invalid_grant');P.showUploadMessage('document','invalid_grant');</script>`;
const server=http.createServer((req,res)=>{
  if(req.url==='/'){res.setHeader('Content-Type','text/html');res.end(fixture);return;}
  const file=path.join(root,req.url.split('?')[0]);
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'application/octet-stream');res.end(fs.readFileSync(file));
});
await new Promise(r=>server.listen(8096,'127.0.0.1',r));
const b=new BrowserRunner({userDataDir:path.join(root,'storage','profile-brand-browser'),port:9336,baseUrl:'http://localhost:8096'});
try {
  await b.start();await b.navigate();await b.waitForSelector('#profile-photo-upload-message');
  for(const width of [320,375,768,1440]) {
    await b.setViewport(width,900,width<768);await b.wait(100);
    const layout=await b.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:innerWidth,buttons:[...document.querySelectorAll('#photo-preview-notice button')].map(e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom};}),colour:getComputedStyle(document.querySelector('#prof-avatar-container')).backgroundColor}));
    assert.ok(layout.scroll<=width+1,JSON.stringify(layout));
    const [a,c]=layout.buttons;
    assert.ok(a.right<=c.left || a.bottom<=c.top || c.bottom<=a.top,JSON.stringify(layout));
    assert.equal(layout.colour,'rgb(8, 127, 91)');
    console.log('PASS profile brand and upload actions width '+width);
  }
  await b.evaluate(()=>{P.showUploadMessage('photo','<img src=x onerror=alert(1)>');});
  assert.equal(await b.evaluate(()=>document.querySelector('#profile-photo-upload-message img')===null),true);
  await b.evaluate(()=>P.showUploadMessage('photo','Uploads are temporarily unavailable. TransMove’s Google Drive connection needs to be reconnected.'));
  await b.setViewport(375,900,true);
  await b.evaluate(()=>{document.documentElement.dataset.theme='dark';});
  await b.wait(400);
  assert.notEqual(await b.evaluate(()=>getComputedStyle(document.querySelector('.provider-profile-page > .card')).backgroundColor),'rgb(255, 255, 255)');
  await b.evaluate(()=>{document.documentElement.dataset.theme='light';document.querySelector('#photo-preview-img').src='/assets/images/logo.png';});
  await b.wait(100);
  const shot=await b.sendSession('Page.captureScreenshot',{format:'png'});
  fs.writeFileSync(path.join(root,'storage','profile-brand-mobile.png'),Buffer.from(shot.result.data,'base64'));
  console.log('PASS feedback uses text content and remains on page');
} finally {await b.close();server.close();}
