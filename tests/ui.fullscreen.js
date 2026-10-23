// v0.12.0 fullscreen: quest popups and question dialogs stay clickable without native dialogs (needs jsdom): npm i --no-save jsdom@24 && node tests/ui.fullscreen.js
const {JSDOM}=require('jsdom'),fs=require('fs'),assert=require('assert');
const src=fs.readFileSync(process.argv[2]||require('path').join(__dirname,'..','extension.js'),'utf8');
const dom=new JSDOM('<!doctype html><body></body>',{url:'https://local.test/gacha-forge',runScripts:'outside-only'});
const win=dom.window,doc=win.document;
win.HTMLDialogElement.prototype.showModal=function(){this.open=true};win.HTMLDialogElement.prototype.close=function(){this.open=false};
const native=[];win.alert=m=>native.push(m);win.confirm=m=>{native.push(m);return true;};win.prompt=m=>{native.push(m);return null;};
let fsEl=null;Object.defineProperty(doc,'fullscreenElement',{configurable:true,get:()=>fsEl});
const setFs=el=>{fsEl=el;doc.dispatchEvent(new win.Event('fullscreenchange'));};
const L0='공방장: 홍길동 씨, 정식 긴급 설비 방어 용역을 위촉하고자 합니다!';
const L1='공방장: 임무 완료 시 세후 총 1,400,000원을 등록 계좌로 정산해 드립니다.';
const L2='홍길동은 비상 냉각 밸브를 열어 용해로 폭발을 막아 냈다.';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let nextBody=null;
const reply=body=>({ok:true,status:200,headers:{get:k=>k==='content-type'?'application/json':null},clone(){return this},json:async()=>body});
win.fetch=async(url,opts)=>{
  const u=String(url);
  if(u.includes('/api/connections'))return reply([{id:'c1',name:'test'}]);
  if(u.includes('/api/gacha-forge/'))return reply(nextBody||{ok:true});
  const user=JSON.parse(opts.body).messages[1].content;let out;
  if(user.includes('[새 퀘스트 후보]')){
    const c=t=>user.match(new RegExp('"id":"(c\\d+)","title":"'+t))[1],r=n=>user.match(new RegExp('"id":"(r\\d+)","kind":"[^"]*","name":"'+n))[1];
    out={groups:[{memberIds:[c('긴급 설비 방어 용역 수락'),c('비상 냉각 밸브 개방')],rewardIds:[r('긴급 설비 방어 보수')],title:'제1공방 긴급 방어 작전',objective:'용해로 폭발을 막는다',steps:[{text:'방어 용역 수락',done:true},{text:'비상 냉각 밸브 개방',done:true}],status:'completed',reputation:{amount:2,reason:'용해로 폭발을 막음'}}]};
  }else out={events:[
    {category:'quest',name:'긴급 설비 방어 용역 수락',questTitle:'긴급 설비 방어 용역 수락',status:'active',evidence:'정식 긴급 설비 방어 용역을 위촉하고자 합니다',owner:'player',source:'챕터 3 · 장면 1'},
    {category:'contract',name:'긴급 설비 방어 보수',status:'confirmed',financialStatus:'pending',evidence:'임무 완료 시 세후 총 1,400,000원을 등록 계좌로 정산해 드립니다',amount:1400000,unit:'원',owner:'player',source:'챕터 3 · 장면 2'},
    {category:'quest',name:'비상 냉각 밸브 개방',questTitle:'비상 냉각 밸브 개방',status:'completed',evidence:'비상 냉각 밸브를 열어 용해로 폭발을 막아 냈다',owner:'player',source:'챕터 3 · 장면 3'}]};
  return reply({content:JSON.stringify(out)});
};
win.localStorage.setItem('gf-quest-v1',JSON.stringify({v:1,world:'',aiConnectionId:'c1',aiMode:'scene',autoApply:true,worlds:{}}));
const host=doc.createElement('marinara-capability-gacha-forge');doc.body.append(host);
const root=host.attachShadow({mode:'open'});
root.innerHTML='<div class="bar"><button class="gf-fs-bar icon-button">⛶</button></div><div class="vn"><span class="vn-caption">압수 폐기물의 출처3챕터 · 성수동 제1공방</span><p class="vn-line">…</p><span class="vn-count">01 / 10</span></div>';
const gameHtml=root.innerHTML;
win.eval(src);
const show=async(line,n)=>{root.querySelector('.vn-line').textContent=line;root.querySelector('.vn-count').textContent=String(n).padStart(2,'0')+' / 10';await sleep(400);};
const state=()=>{const d=JSON.parse(win.localStorage.getItem('gf-quest-v1'));return d.worlds[d.world];};
const toasts=()=>[...doc.querySelectorAll('#gfq-01-toasts .gfq-toast,#gfq-01-qtoasts .gfq-toast')].map(e=>e.textContent);
(async()=>{
  // The whole chapter is generated (observed traffic), then analysed while the reader is still on line 1.
  for(const [i,t] of [L0,L1,L2].entries()){nextBody={beat:{chapter:3,storyIndex:i+1,segments:[{text:t}]}};await win.fetch('/api/gacha-forge/beat',{method:'POST',body:JSON.stringify({runId:'run-x',chapter:3,storyIndex:i+1})});await sleep(20);}
  for(let k=0;k<300&&!state()?.gfLastAnalysis;k++)await sleep(50);
  let w=state();
  assert.strictEqual(w.quests.length,0,'nothing is shown before its line');assert.strictEqual((w.gfLedger||[]).length,0);
  assert.strictEqual(w.gfLastAnalysis.deferred,2);assert.ok(w.aiProposals.every(p=>p.deferred));
  // The game goes fullscreen (Gacha Forge calls requestFullscreen on its own element).
  setFs(host);
  let gameClicks=0;host.addEventListener('click',()=>gameClicks++);
  await show(L0,2);
  assert.ok(!doc.querySelector('body > #gfq-01-qtoasts .gfq-toast-offer'),'offer is not left outside the fullscreen element');
  const offer=root.querySelector('#gfq-01-qtoasts .gfq-toast-offer');assert.ok(offer,'offer inside the game element');
  assert.ok(root.getElementById('gfq-01-tstyle'),'popup styles copied into the game element');
  offer.querySelector('[data-o="yes"]').dispatchEvent(new win.MouseEvent('click',{bubbles:true,composed:true}));
  w=state();assert.strictEqual(w.quests.length,1,'accept works in fullscreen');
  assert.strictEqual(gameClicks,0,'the click does not also reach the game');
  // The game re-renders its shadow root: the popup box comes back.
  await show(L1,3);root.innerHTML=gameHtml;await sleep(50);
  assert.ok(root.getElementById('gfq-01-toasts')||root.getElementById('gfq-01-qtoasts'),'popup box restored after re-render');
  // Leaving fullscreen moves the popups back to the page.
  setFs(null);
  assert.ok(doc.querySelector('body > #gfq-01-qtoasts')&&!root.getElementById('gfq-01-qtoasts'),'back in body');
  // Question dialogs are in-page (the browser's own confirm would end fullscreen).
  setFs(host);
  await sleep(200); // the game re-render above removed the quest button; it is placed again shortly
  doc.querySelector('marinara-capability-gacha-forge').shadowRoot.querySelector('button[data-gfq="top"]').click();
  const panel=doc.getElementById('gfq-01-panel');assert.ok(panel?.open,'panel open');
  const del=()=>panel.querySelector('[data-action="delete-quest"]');
  if(!del()){const sel=panel.querySelector('[data-action="select-quest"]');if(sel)sel.dispatchEvent(new win.MouseEvent('click',{bubbles:true}));}
  assert.ok(del(),'delete button');
  del().dispatchEvent(new win.MouseEvent('click',{bubbles:true}));await sleep(0);
  let ask=doc.querySelector('dialog.gfq-01-ask');assert.ok(ask&&ask.open,'in-page confirm shown');assert.match(ask.textContent,/퀘스트를 삭제하시겠습니까/);
  ask.querySelector('button[value=no]').click();await sleep(0);
  assert.ok(!doc.querySelector('dialog.gfq-01-ask'),'dialog closed');assert.strictEqual(state().quests.length,1,'cancel keeps the quest');
  del().dispatchEvent(new win.MouseEvent('click',{bubbles:true}));await sleep(0);
  ask=doc.querySelector('dialog.gfq-01-ask');ask.querySelector('button[type=submit]').click();await sleep(0);
  assert.strictEqual(state().quests.length,0,'OK deletes');
  assert.deepStrictEqual(native,[],'no native alert/confirm/prompt: '+native.join(' | '));
  console.log('UI fullscreen OK');process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
