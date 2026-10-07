import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import assert from 'node:assert/strict';
import {resolvePublicFile} from '../src/server/public-files.js';
import {BrowserRunner} from './browser-runner.js';
const root=process.cwd();
const server=http.createServer((req,res)=>{
 const file=resolvePublicFile(new URL(req.url,'http://localhost').pathname,path.join(root,'site-dist'));
 if(!file){res.writeHead(404);res.end();return;}
 res.setHeader('Content-Type',file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.png')?'image/png':'text/plain');res.end(fs.readFileSync(file));
});
await new Promise(r=>server.listen(8095,'127.0.0.1',r));
const b=new BrowserRunner({userDataDir:path.join(root,'storage','public-pages-browser'),port:9335,baseUrl:'http://localhost:8095'});
try {
 for(const name of ['about.html','privacy.html','terms.html']) {
  const response=await fetch(`http://localhost:8095/${name}`);assert.equal(response.status,200);const html=await response.text();
  assert.ok(html.includes('<h1>'));assert.ok(html.includes('/privacy.html'));assert.ok(html.includes('/terms.html'));assert.ok(!/<script\b/i.test(html));
 }
 const verification=await fetch('http://localhost:8095/googlea4ceea99234e80f4.html');assert.equal(verification.status,200);assert.equal((await verification.text()).trim(),'google-site-verification: googlea4ceea99234e80f4.html');
 console.log('PASS public HTML pages and exact ownership verification response');
 await b.start();
 for(const name of ['about.html','privacy.html','terms.html']) {
  await b.sendSession('Page.navigate',{url:`http://localhost:8095/${name}`});await b.waitForSelector('article h1');
  for(const width of [320,375,768,1440]) {
   await b.setViewport(width,900,width<768);await b.wait(100);
   const layout=await b.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));assert.ok(layout.scroll<=width+1,JSON.stringify(layout));
  }
  if(name==='privacy.html') assert.ok(await b.evaluate(()=>document.querySelector('article').textContent.includes('chavundukaothniel@gmail.com')));
  console.log('PASS '+name+' across phone, tablet and desktop widths');
 }
 await b.sendSession('Page.navigate',{url:'http://localhost:8095/about.html'});await b.waitForSelector('article h1');
 const shot=await b.sendSession('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(root,'storage','public-homepage.png'),Buffer.from(shot.result.data,'base64'));
}finally {await b.close();server.close();}
