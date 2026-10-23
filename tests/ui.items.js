// v0.12.0: items — [사용] (a box gives what was inside), owned items told to the AI, and a similar owned item asks first (needs jsdom): node tests/ui.items.js
const {JSDOM}=require('jsdom'),fs=require('fs'),assert=require('assert');
const src=fs.readFileSync(process.argv[2]||require('path').join(__dirname,'..','extension.js'),'utf8');
const dom=new JSDOM('<!doctype html><body></body>',{url:'https://local.test/gacha-forge',runScripts:'outside-only'});
const win=dom.window,doc=win.document;
win.HTMLDialogElement.prototype.showModal=function(){this.open=true};win.HTMLDialogElement.prototype.close=function(){this.open=false};
const alerts=[];win.alert=m=>alerts.push(m);win.confirm=()=>true;win.prompt=()=>null;
const S1='채서래 씨, 임무 완료 시 세후 총 1,400,000원을 등록 계좌로 정산해 드립니다.';
const S2='맞춤 경량 건틀릿은 내일 이 시간에 수령하시게 됩니다.';
const S3='채서래는 비상 냉각 밸브를 열어 용해로 폭발을 막아 냈다.';
const S4='다음 날 아침, 채서래는 새로운 의뢰서를 받아 들었다.';
const prompts=[];let nextBody=null;
const reply=body=>({ok:true,status:200,headers:{get:k=>k==='content-type'?'application/json':null},clone(){return this},json:async()=>body});
win.fetch=async(url,opts)=>{
  const u=String(url);
  if(u.includes('/api/connections'))return reply([{id:'c1',name:'test'}]);
  if(u.includes('/api/gacha-forge/'))return reply(nextBody||{ok:true});
  if(!u.includes('/api/generate/raw'))return {ok:false,status:404,json:async()=>({}),headers:{get:()=>''}};
  const user=JSON.parse(opts.body).messages[1].content;prompts.push(user);
  let out;
  if(user.includes('[새 퀘스트 후보]')){
    const id=n=>user.match(new RegExp('"id":"(r\\d+)","kind":"[^"]*","name":"'+n))[1];
    out={groups:[{memberIds:['c1'],rewardIds:[id('긴급 설비 방어 보수'),id('맞춤 경량 건틀릿')],title:'제1공방 긴급 방어 작전',objective:'용해로 폭발을 막는다',steps:[{text:'방어 용역 수락',done:true},{text:'비상 냉각 밸브 개방',done:true}],status:'completed',reputation:{amount:2,reason:'용해로 폭발을 막아 공방을 지킴'}}]};
  }else out={events:[
    {category:'item',name:'여분의 데뷔 응원 키트',status:'confirmed',financialStatus:'ownership',amount:2,unit:'개',evidence:'채서래는 비상 냉각 밸브를 열어',owner:'player',source:'챕터 3 · 장면 3'}]};
  return reply({content:JSON.stringify(out)});
};
const MODE='scene'; // the setting the player uses
win.localStorage.setItem('gf-quest-v1',JSON.stringify({v:1,world:'공방',aiConnectionId:'c1',aiMode:MODE,autoApply:true,sceneTimed:false,worlds:{'공방':{quests:[],fields:[],history:[],gfRunId:'run-abc',gfDisplayName:'공방',
  items:[{id:'k1',name:'데뷔 응원 키트',qty:2},{id:'b1',name:'단도가 든 상자',qty:1},{id:'b2',name:'편지 묶음',qty:2}]}}}));
let promptAnswer=null;win.prompt=()=>promptAnswer;
const host=doc.createElement('marinara-capability-gacha-forge');doc.body.append(host);
host.attachShadow({mode:'open'}).innerHTML='<div><button class="gf-fs-bar icon-button">⛶</button></div>';
win.__gfqNativeDialogs=true; // v0.12.0: answer the in-page dialogs with the stubbed confirm/prompt above
win.__gfqNoUpgrade=true; // v0.14.1: this test counts calls; the start-up upgrade is covered by ui.upgrade.js
win.eval(src);
(async()=>{
  // Game traffic goes through the page's fetch, which the extension observes.
  const send=async(chapter,index,text)=>{nextBody={beat:{chapter,storyIndex:index,segments:[{text}]}};await win.fetch('/api/gacha-forge/beat',{method:'POST',body:JSON.stringify({runId:'run-abc',chapter,storyIndex:index})});await new Promise(r=>setTimeout(r,30));};
  await send(3,1,S1);await send(3,2,S2);await send(3,3,S3);
  const W=()=>{const d=JSON.parse(win.localStorage.getItem('gf-quest-v1'));return d.worlds[d.world];};
  const names=()=>W().items.map(i=>[i.name,i.qty]);
  // [사용]: the box is used up and what was inside is added.
  host.shadowRoot.querySelector('button[data-gfq="top"]').click();const panel=doc.getElementById('gfq-01-panel');
  const click=async sel=>{const e=panel.querySelector(sel);assert.ok(e,'missing '+sel);e.dispatchEvent(new win.MouseEvent('click',{bubbles:true}));await new Promise(r=>setTimeout(r,0));};
  await click('[data-tab="profile"]');await click('[data-action="select-item"][data-id="b1"]');
  promptAnswer='단도';await click('[data-action="item-use"][data-id="b1"]');
  assert.deepStrictEqual(names(),[['데뷔 응원 키트',2],['편지 묶음',2],['단도',1]],'box gone, dagger added');
  assert.match(W().history[0].text,/소지품 사용: 단도가 든 상자 → 나온 물건: 단도/);
  await click('[data-action="select-item"][data-id="b2"]');promptAnswer='';await click('[data-action="item-use"][data-id="b2"]');
  assert.deepStrictEqual(names().find(n=>n[0]==='편지 묶음'),['편지 묶음',1],'one used, one left');
  promptAnswer=null;await click('[data-action="item-use"][data-id="b2"]');assert.deepStrictEqual(names().find(n=>n[0]==='편지 묶음'),['편지 묶음',1],'cancel changes nothing');
  await click('[data-action="close"]');
  await new Promise(r=>setTimeout(r,6600));
  for(let k=0;k<100&&!doc.querySelector('#gfq-01-qtoasts .gfq-toast-offer');k++)await new Promise(r=>setTimeout(r,50));
  const ext=prompts.filter(p=>!p.includes('[새 퀘스트 후보]'));
  assert.ok(ext.length&&ext[0].includes('[이미 가진 소지품]')&&ext[0].includes('데뷔 응원 키트 ×2'),'the AI is told what is already owned');
  const offer=doc.querySelector('#gfq-01-qtoasts .gfq-toast-offer');assert.ok(offer,'popup shown');
  assert.ok(offer.textContent.includes("이미 가진 '데뷔 응원 키트 ×2'과(와) 같은 물건인가요"),offer.textContent);
  assert.ok(offer.querySelector('[data-o="same"]')&&offer.querySelector('[data-o="new"]')&&!offer.querySelector('[data-o="yes"]'));
  assert.deepStrictEqual(names().find(n=>n[0].includes('응원')),['데뷔 응원 키트',2],'not added automatically');
  offer.querySelector('[data-o="same"]').dispatchEvent(new win.MouseEvent('click',{bubbles:true}));await new Promise(r=>setTimeout(r,20));
  assert.deepStrictEqual(names().filter(n=>n[0].includes('응원')),[['데뷔 응원 키트',2]],'same thing: count unchanged');
  assert.strictEqual(W().aiProposals.length,0);
  console.log('UI items OK');process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
