// UI smoke test (needs jsdom): npm i --no-save jsdom@24 && node tests/ui.smoke.js
const {JSDOM}=require('jsdom'),fs=require('fs'),assert=require('assert');
const src=fs.readFileSync(process.argv[2]||require('path').join(__dirname,'..','extension.js'),'utf8');
const dom=new JSDOM('<!doctype html><body></body>',{url:'https://local.test/gacha-forge',runScripts:'outside-only'});
const win=dom.window,doc=win.document;
win.HTMLDialogElement.prototype.showModal=function(){this.open=true};win.HTMLDialogElement.prototype.close=function(){this.open=false};
const alerts=[];win.alert=m=>alerts.push(m);win.confirm=()=>true;win.prompt=()=>null;
win.fetch=async()=>({ok:false,status:404,json:async()=>({}),headers:{get:()=>''}});
const story='채서래는 제1공방에서 오염원을 찾았다. 이후 냉각 밸브를 열어 폭발을 막았다.';
const world={quests:[{id:'q1',title:'제1공방 방어',type:'의뢰',detail:'d',target:1,progress:0,reward:'명성 상승',rewardDetails:[{name:'명성 상승',kind:'reputation',certainty:'suggested',amount:1,unit:'점'}],claimed:false,steps:['오염 원인 조사','냉각 밸브 개방']}],
  fields:[],items:[],history:[],gfDisplayName:'서울 각성자 월드',gfStorySamples:[{id:'e1',chapter:'3',index:'1',text:story}],
  aiProposals:[{id:'p1',category:'quest',name:'제1공방 방어',questTitle:'제1공방 방어',status:'completed',evidence:'냉각 밸브를 열어 폭발을 막았다',source:'챕터 3 · 장면 1',owner:'player',questRewards:[],questSteps:['냉각 밸브 개방','폭발 저지'],questStepDone:[true,true],updateOf:'q1',mergedCount:2}]};
win.localStorage.setItem('gf-quest-v1',JSON.stringify({v:1,world:'run-x',worlds:{'run-x':world}}));
const host=doc.createElement('marinara-capability-gacha-forge');doc.body.append(host);
const sr=host.attachShadow({mode:'open'});sr.innerHTML='<div class="bar"><button class="gf-fs-bar icon-button">⛶</button></div>';
win.__gfqNativeDialogs=true; // v0.12.0: answer the in-page dialogs with the stubbed confirm/prompt above
win.eval(src);
const top=sr.querySelector('button[data-gfq="top"]');assert.ok(top,'top button placed');
top.click();
const panel=doc.getElementById('gfq-01-panel');assert.ok(panel&&panel.open,'panel opened');
(async()=>{
const click=async sel=>{const el=panel.querySelector(sel);assert.ok(el,'missing '+sel);el.dispatchEvent(new win.MouseEvent('click',{bubbles:true}));await new Promise(r=>setTimeout(r,0));};
// quests tab: steps render as toggles
assert.strictEqual(panel.querySelectorAll('[data-action="toggle-step"]').length,2);
await click('[data-action="toggle-step"][data-step="0"]');
let d=JSON.parse(win.localStorage.getItem('gf-quest-v1'));assert.deepStrictEqual(d.worlds['run-x'].quests[0].stepDone,[true,false]);
// review list shows Korean labels + update target
await click('[data-tab="history"]');
const html=panel.innerHTML;
assert.ok(html.includes('기존 퀘스트 갱신: 제1공방 방어'),'update label');assert.ok(html.includes('통합된 후보 2개'));assert.ok(html.includes('✓ 냉각 밸브 개방'));
assert.ok(html.includes('퀘스트 · 제1공방 방어')&&html.includes('<small>완료</small>'),'korean labels');
await click('[data-action="approve-ai-proposal"]');
d=JSON.parse(win.localStorage.getItem('gf-quest-v1'));const w=d.worlds['run-x'];
assert.strictEqual(w.quests.length,1,'no duplicate quest');
assert.deepStrictEqual(w.quests[0].steps,['오염 원인 조사','냉각 밸브 개방','폭발 저지']);
assert.deepStrictEqual(w.quests[0].stepDone,[true,true,true]);
assert.strictEqual(w.quests[0].claimed,true);
assert.strictEqual(w.fields.find(f=>f.name==='명성')?.value,'1','reputation once (no other reward)');
assert.strictEqual(w.aiProposals.length,0);
assert.strictEqual(w.protagonist,'채서래');assert.strictEqual(w.gfRulePack,'legacy-0.3.4');
await click('[data-tab="profile"]');assert.ok(panel.querySelector('.gfq-ticket')&&panel.innerHTML.includes('거래 내역')&&panel.innerHTML.includes('소지품'),'profile tab merges assets and items');assert.ok(!panel.innerHTML.includes('원장'),'no 원장 wording');
await click('[data-tab="settings"]');assert.ok(panel.innerHTML.includes('현재 월드: <b>서울 각성자 월드</b>'));
console.log('UI smoke OK; alerts:',alerts.length?alerts:'none');process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
