import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import assert from 'node:assert/strict';
import {BrowserRunner} from './browser-runner.js';
const root=process.cwd();
const fixture=`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/assets/css/style.css"><script src="/assets/js/vendor/supabase.min.js"></script><script src="/assets/js/vendor/lucide.min.js"></script><main id="fixture" style="padding:16px"></main><script type="module">import {CustomerView as C} from '/src/views/CustomerView.js';import {SmartPopup as P} from '/src/components/SmartPopup.js';import {DriverView as D} from '/src/views/DriverView.js';window.location.hash='#customer?tab=search';document.querySelector('#fixture').innerHTML=await C.render({id:'test',full_name:'Test Passenger'});window.P=P;window.C=C;window.D=D;window.fixtureReady=true;</script>`;
const server=http.createServer((req,res)=>{if(req.url==='/'){res.setHeader('Content-Type','text/html');res.end(fixture);return;}const file=path.join(root,req.url.split('?')[0]);if(!file.startsWith(root)||!fs.existsSync(file)){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'application/octet-stream');res.end(fs.readFileSync(file));});
await new Promise(r=>server.listen(8098,'127.0.0.1',r));
const b=new BrowserRunner({userDataDir:path.join(root,'storage','transport-layout-browser'),port:9338,baseUrl:'http://localhost:8098'});
try {
 await b.start();await b.navigate();await b.waitForSelector('#create-request-form');
 for(const width of [320,375,768,1440]) {
  await b.setViewport(width,900,width<768);await b.wait(100);
  const result=await b.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:innerWidth,stepper:getComputedStyle(document.querySelector('.request-price-stepper')).display,gps:document.querySelector('#btn-cust-gps').getBoundingClientRect().width}));
  assert.ok(result.scroll<=width+1,JSON.stringify(result));assert.equal(result.stepper,'grid');assert.ok(result.gps>=44);console.log('PASS request form '+width);
  await b.evaluate(()=>P.open({title:'Driver offers',flowKey:'test',state:'offers',minimizable:true,html:C.renderSmartOfferList([{id:'bid',amount:12,driver:{full_name:'Test Driver',rating:4.8},vehicle:{make:'Toyota',model:'Corolla'},status:'pending'}]),actions:[{label:'Next step',primary:true,onClick:()=>P.update({title:'Booking confirmed',state:'confirmed',html:'<p>Your driver is on the way.</p>',actions:[{label:'View journey',primary:true}]})}]}));
  await b.wait(350);const popup=await b.evaluate(()=>{const r=document.querySelector('.smart-popup-card').getBoundingClientRect();return {left:r.left,right:r.right,bottom:r.bottom,scroll:document.querySelector('.smart-popup-card').scrollWidth,width:r.width};});
  assert.ok(popup.left>=0&&popup.right<=width+1&&popup.bottom<=901&&popup.scroll<=popup.width+1,JSON.stringify(popup));
  await b.evaluate(()=>document.querySelector('.smart-popup-action').click());await b.wait(100);assert.equal(await b.evaluate(()=>P.current?.title),'Booking confirmed');
  await b.evaluate(()=>{P.minimize();P.update({flowKey:'test',state:'confirmed',title:'Booking confirmed'});});assert.equal(await b.evaluate(()=>P.current.minimized),true);
  await b.evaluate(()=>P.clear());console.log('PASS popup layout, next-step persistence and background update '+width);
 }
 await b.evaluate(()=>{P.open({title:'Retry action',actions:[{label:'Stay here',primary:true,close:false,onClick:()=>false}]});document.querySelector('.smart-popup-action').click();});await b.wait(100);assert.equal(await b.evaluate(()=>document.querySelector('.smart-popup-action').disabled),false);await b.evaluate(()=>P.clear());
 await b.evaluate(()=>D.showDriverOfferSentState({request_id:'r'},12));assert.equal(await b.evaluate(()=>P.current.state),'offer_sent');assert.ok(await b.evaluate(()=>document.querySelector('.smart-popup-body').textContent.includes('Passenger review')));assert.equal(await b.evaluate(()=>document.querySelectorAll('.smart-popup-action').length),2);console.log('PASS driver offer sent next actions and retry controls');await b.setViewport(1440,1000);await b.evaluate(()=>P.clear());await b.wait(100);const shot=await b.sendSession('Page.captureScreenshot',{format:'png'});fs.writeFileSync('storage/transport-form-preview.png',Buffer.from(shot.result.data,'base64'));
}catch(e){console.log(b.consoleErrors,b.networkErrors);console.log(await b.evaluate(()=>document.body.innerHTML.slice(0,300)));throw e;}finally{await b.close();server.close();}




