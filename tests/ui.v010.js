// v0.10.1: auto snapshots stay cheap and never block the real save; reward inbox counts (needs jsdom): node tests/ui.v010.js
const {JSDOM}=require('jsdom'),fs=require('fs'),assert=require('assert');
const src=fs.readFileSync(process.argv[2]||require('path').join(__dirname,'..','extension.js'),'utf8');
const dom=new JSDOM('<!doctype html><body></body>',{url:'https://local.test/gacha-forge',runScripts:'outside-only'});
const win=dom.window,doc=win.document;
win.HTMLDialogElement.prototype.showModal=function(){this.open=true};win.HTMLDialogElement.prototype.close=function(){this.open=false};
const alerts=[];win.alert=m=>alerts.push(m);win.confirm=()=>true;win.prompt=()=>null;
win.fetch=async()=>({ok:true,status:200,headers:{get:()=>'application/json'},clone(){return this},json:async()=>({})});
const W0={quests:[{id:'q1',title:'방어',type:'의뢰',steps:['a'],stepDone:[false],claimed:false,rewardDetails:[{kind:'money',name:'보수 총액',amount:1400000,unit:'원',certainty:'pending'},{kind:'money',name:'세후 총액',amount:1400000,unit:'원',certainty:'confirmed'},{kind:'money',name:'중도 철수 시 최소 보장',amount:300000,unit:'원'},{kind:'reputation',name:'명성',amount:2}]}],
  fields:[],items:[],history:[],gfDisplayName:'월드'};
win.localStorage.setItem('gf-quest-v1',JSON.stringify({v:1,world:'w',worlds:{w:W0}}));
const host=doc.createElement('marinara-capability-gacha-forge');doc.body.append(host);
const sr=host.attachShadow({mode:'open'});sr.innerHTML='<div><button class="gf-fs-bar icon-button">⛶</button></div>';
win.__gfqNativeDialogs=true; // v0.12.0: answer the in-page dialogs with the stubbed confirm/prompt above
win.eval(src);
(async()=>{
  sr.querySelector('button[data-gfq="top"]').click();
  const panel=doc.getElementById('gfq-01-panel');const click=sel=>{const e=panel.querySelector(sel);assert.ok(e,'missing '+sel);e.dispatchEvent(new win.MouseEvent('click',{bubbles:true}));};
  click('[data-tab="quests"]');
  const inbox=[...panel.querySelectorAll('summary')].map(s=>s.textContent).find(t=>t.includes('보상 수령함'));
  assert.ok(/확인 필요 2건/.test(inbox),'duplicate pay counted once, guarantee skipped: '+inbox);
  // Snapshots: the backup key is written once, then ordinary saves don't read it again.
  const LS=win.localStorage,proto=Object.getPrototypeOf(LS),get0=proto.getItem;let reads=0;
  proto.getItem=function(k){if(k==='gf-quest-snapshots-v1')reads++;return get0.call(this,k);};
  click('[data-action="toggle-step"]');click('[data-action="toggle-step"]');click('[data-action="toggle-step"]');
  assert.ok(LS.getItem('gf-quest-snapshots-v1'),'snapshot written');const r0=reads;
  click('[data-action="toggle-step"]');click('[data-action="toggle-step"]');
  assert.strictEqual(reads,r0+0,'no snapshot reads on ordinary saves');
  // Quota: when the main save fails, snapshots are dropped and the save still lands.
  const set0=proto.setItem;let fail=true;
  proto.setItem=function(k,v){if(k==='gf-quest-v1'&&fail&&get0.call(this,'gf-quest-snapshots-v1')){fail=false;throw new win.DOMException('full','QuotaExceededError');}return set0.call(this,k,v);};
  click('[data-action="toggle-step"]');
  assert.ok(!alerts.some(a=>a.includes('저장하지 못했습니다')),'no save failure');assert.strictEqual(LS.getItem('gf-quest-snapshots-v1'),null);
  assert.strictEqual(JSON.parse(LS.getItem('gf-quest-v1')).worlds.w.quests[0].stepDone[0],false,'sixth toggle saved');
  console.log('UI v0.10 OK');process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
