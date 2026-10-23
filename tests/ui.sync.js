// v0.11.0: cross-device sync through marinara.storage (needs jsdom): node tests/ui.sync.js
const {JSDOM}=require('jsdom'),fs=require('fs'),assert=require('assert');
const src=fs.readFileSync(process.argv[2]||require('path').join(__dirname,'..','extension.js'),'utf8');
const server={value:{},gets:0,patches:0};
const storage={get:async()=>{server.gets++;return JSON.parse(JSON.stringify(server.value));},patch:async v=>{server.patches++;const n={...server.value,...JSON.parse(JSON.stringify(v))};if(JSON.stringify(n).length>1e6)throw Error('too big');server.value=n;return n;}};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function device(local){
  const dom=new JSDOM('<!doctype html><body></body>',{url:'https://local.test/gacha-forge',runScripts:'outside-only'});
  const win=dom.window,doc=win.document;
  win.HTMLDialogElement.prototype.showModal=function(){this.open=true};win.HTMLDialogElement.prototype.close=function(){this.open=false};
  win.alert=()=>{};win.confirm=()=>true;win.prompt=()=>null;
  win.fetch=async()=>({ok:true,status:200,headers:{get:()=>'application/json'},clone(){return this},json:async()=>({})});
  win.marinara={storage};
  if(local)win.localStorage.setItem('gf-quest-v1',JSON.stringify(local));
  const host=doc.createElement('marinara-capability-gacha-forge');doc.body.append(host);
  host.attachShadow({mode:'open'}).innerHTML='<div><button class="gf-fs-bar icon-button">⛶</button></div>';
  win.__gfqNativeDialogs=true;win.eval(src);
  const W=()=>JSON.parse(win.localStorage.getItem('gf-quest-v1'));
  const open=()=>{if(!doc.getElementById('gfq-01-panel'))host.shadowRoot.querySelector('button[data-gfq="top"]').click();};
  const click=sel=>{open();const e=doc.getElementById('gfq-01-panel').querySelector(sel);assert.ok(e,'missing '+sel);e.dispatchEvent(new win.MouseEvent('click',{bubbles:true}));};
  return {win,doc,W,click,open};
}
const world=(name,run,q,h)=>({quests:q.map((t,i)=>({id:'q'+i+name,title:t,type:'의뢰',steps:['a'],stepDone:[false],claimed:false,rewardDetails:[]})),fields:[],items:[],history:h.map(t=>({at:'T',text:t})),gfRunId:run,gfDisplayName:name});
(async()=>{
  // gzip+base64 round trip for Korean text (Node has the same CompressionStream as browsers).
  const pick=n=>{const i=src.indexOf('  async function '+n+'(');let d=0,j=src.indexOf('{',i);for(;j<src.length;j++){if(src[j]==='{')d++;else if(src[j]==='}'){d--;if(!d)break;}}return src.slice(i,j+1);};
  const Z=new Function(pick('gfqGzip')+pick('gfqGunzip')+'return {gfqGzip,gfqGunzip};')();
  const big=JSON.stringify({t:'윤세라는 등대 언덕으로 자재를 옮겼다. '.repeat(4000)});const z=await Z.gfqGzip(big);
  assert.ok(/^[A-Za-z0-9+/=]+$/.test(z)&&z.length<big.length/5,'compressed to ascii');assert.strictEqual(await Z.gfqGunzip(z),big);
  // Device A has records; the server is empty: start-up pushes them.
  const A=device({v:1,world:'은빛 항구',aiConnectionId:'c1',worlds:{'은빛 항구':world('은빛 항구','run-1',['등대 수리'],['기록 1','기록 2'])}});
  await sleep(900);
  assert.ok(server.value.gfq&&server.value.gfq.rev,'first device uploads');assert.strictEqual(server.value.gfq.world,undefined);
  // Device B is fresh: it takes the server copy.
  const B=device(null);await sleep(900);
  assert.deepStrictEqual(Object.keys(B.W().worlds),['은빛 항구']);assert.strictEqual(B.W().worlds['은빛 항구'].quests[0].title,'등대 수리');
  // B edits and syncs; A pulls the change because A has nothing new.
  B.click('[data-tab="quests"]');B.click('[data-action="toggle-step"]');
  B.click('[data-tab="settings"]');B.click('[data-action="sync-now"]');await sleep(200);
  assert.strictEqual(JSON.parse(server.value.gfq.enc==='json'?server.value.gfq.data:'{}').worlds['은빛 항구'].quests[0].stepDone[0],true,'B pushed the step');
  A.click('[data-tab="settings"]');A.click('[data-action="sync-now"]');await sleep(200);
  assert.strictEqual(A.W().worlds['은빛 항구'].quests[0].stepDone[0],true,'A received B edit');
  // Both change different worlds before syncing: nothing is lost, the merge keeps both and a backup.
  const C=device({v:1,world:'붉은 사막',worlds:{'붉은 사막':world('붉은 사막','run-2',['오아시스 찾기'],['기록'])}});await sleep(900);
  const c=C.W();assert.deepStrictEqual(Object.keys(c.worlds).sort(),['붉은 사막','은빛 항구'],'worlds merged');
  assert.ok(C.win.localStorage.getItem('gf-quest-sync-backup-v1'),'pre-merge backup kept');
  C.click('[data-tab="settings"]');C.click('[data-action="sync-now"]');await sleep(200);
  A.click('[data-action="sync-now"]');await sleep(200);
  assert.deepStrictEqual(Object.keys(A.W().worlds).sort(),['붉은 사막','은빛 항구'],'A sees the merged worlds');
  assert.strictEqual(A.W().world,'은빛 항구','each device keeps its own current world');
  // Turning sync off on a device stops its uploads.
  const p0=server.patches;A.click('[data-action="sync-toggle"]');A.click('[data-tab="quests"]');A.click('[data-action="toggle-step"]');await sleep(100);
  A.click('[data-tab="settings"]');assert.ok(A.doc.querySelector('[data-action="sync-now"][disabled]'),'sync now disabled when off');
  assert.strictEqual(server.patches,p0,'no upload while off');
  console.log('UI sync OK');process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
