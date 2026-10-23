// v0.12.0: sync regressions (needs jsdom): node tests/ui.sync2.js
// 1) a new game run must not take the previous run's name; 2) a stale device must not win over newer edits.
const {JSDOM}=require('jsdom'),fs=require('fs'),assert=require('assert');
const src=fs.readFileSync(process.argv[2]||require('path').join(__dirname,'..','extension.js'),'utf8');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const reply=body=>({ok:true,status:200,headers:{get:k=>k==='content-type'?'application/json':null},clone(){return this},json:async()=>body});
function device({local,meta,storage}={}){
  const dom=new JSDOM('<!doctype html><body></body>',{url:'https://local.test/gacha-forge',runScripts:'outside-only'});
  const win=dom.window,doc=win.document;
  win.HTMLDialogElement.prototype.showModal=function(){this.open=true};win.HTMLDialogElement.prototype.close=function(){this.open=false};
  win.alert=()=>{};win.confirm=()=>true;win.prompt=()=>null;
  const game={};// url path -> reply body
  win.fetch=async url=>{const p=String(url).replace(/^https?:\/\/[^/]+/,'');return reply(game[p]||{});};
  if(storage)win.marinara={storage};
  if(local)win.localStorage.setItem('gf-quest-v1',typeof local==='string'?local:JSON.stringify(local));
  if(meta)win.localStorage.setItem('gf-quest-sync-v1',meta);
  const host=doc.createElement('marinara-capability-gacha-forge');doc.body.append(host);
  host.attachShadow({mode:'open'}).innerHTML='<div><button class="gf-fs-bar icon-button">⛶</button></div>';
  win.__gfqNativeDialogs=true;win.eval(src);
  const W=()=>JSON.parse(win.localStorage.getItem('gf-quest-v1'));
  const send=async(path,req,body)=>{game[path]=body;await win.fetch(path,{method:'POST',body:JSON.stringify(req)});await sleep(30);};
  const click=async sel=>{if(!doc.getElementById('gfq-01-panel'))host.shadowRoot.querySelector('button[data-gfq="top"]').click();
    const e=doc.getElementById('gfq-01-panel').querySelector(sel);assert.ok(e,'missing '+sel);e.dispatchEvent(new win.MouseEvent('click',{bubbles:true}));await sleep(0);};
  return {win,W,send,click};
}
(async()=>{
  // 1) Run A reports its name; run B has not reported one yet.
  const D=device();
  await D.send('/api/gacha-forge/state',{runId:'run-aaaa1111'},{activeRun:{runId:'run-aaaa1111',name:'신선무협'}});
  await D.send('/api/gacha-forge/state',{runId:'run-bbbb2222'},{});
  const byRun=r=>Object.entries(D.W().worlds).find(([,w])=>w.gfRunId===r);
  assert.strictEqual(byRun('run-aaaa1111')[1].gfDisplayName,'신선무협');
  const [bKey,bWorld]=byRun('run-bbbb2222');
  assert.ok(!bKey.includes('신선무협')&&bWorld.gfDisplayName!=='신선무협','run B must not take run A\'s name: '+bKey+' / '+bWorld.gfDisplayName);

  // 2) A and B share a world. B goes away; A edits and uploads. B comes back and the game sends a scene
  // before B has pulled: B must end up with A's edit, not its own stale copy.
  const server={value:{}};
  const storage={get:async()=>JSON.parse(JSON.stringify(server.value)),patch:async v=>{server.value={...server.value,...JSON.parse(JSON.stringify(v))};return server.value;}};
  const world={quests:[{id:'q1',title:'등대 수리',type:'의뢰',steps:['자재 운반'],stepDone:[false],claimed:false,rewardDetails:[]}],fields:[],items:[],history:[{at:'T',text:'기록'}],gfRunId:'run-1',gfDisplayName:'은빛 항구',gfUpd:1};
  const A=device({local:{v:1,world:'은빛 항구',worlds:{'은빛 항구':world}},storage});await sleep(900);
  const B=device({storage});await sleep(900);
  assert.strictEqual(B.W().worlds['은빛 항구'].quests[0].stepDone[0],false);
  const bLocal=B.win.localStorage.getItem('gf-quest-v1'),bMeta=B.win.localStorage.getItem('gf-quest-sync-v1');
  await sleep(20);
  await A.click('[data-tab="quests"]');await A.click('[data-action="toggle-step"]');
  await A.click('[data-tab="settings"]');await A.click('[data-action="sync-now"]');await sleep(200);
  assert.strictEqual(A.W().worlds['은빛 항구'].quests[0].stepDone[0],true,'A edited');
  const B2=device({local:bLocal,meta:bMeta,storage});
  await B2.send('/api/gacha-forge/beat',{runId:'run-1',chapter:3,storyIndex:1},{activeRun:{runId:'run-1',name:'은빛 항구'},beat:{chapter:3,storyIndex:1,segments:[{text:'윤세라는 등대 언덕으로 자재를 옮겼다.'}]}});
  await sleep(1500);
  const b=B2.W().worlds['은빛 항구'];
  assert.ok(b,'world kept: '+Object.keys(B2.W().worlds).join(', '));
  assert.strictEqual(b.quests[0].stepDone[0],true,'B came back with A\'s newer edit, not its stale copy');
  assert.deepStrictEqual(Object.keys(B2.W().worlds),['은빛 항구'],'no duplicate world');

  // 3) Saving the same records again is not an edit: no new edit time, no upload.
  const before=JSON.parse(B2.win.localStorage.getItem('gf-quest-v1')).worlds['은빛 항구'].gfUpd;const rev=server.value.gfq.rev;
  await B2.click('[data-tab="quests"]');await B2.click('[data-tab="settings"]');await B2.click('[data-tab="quests"]');
  B2.win.eval("void 0");await sleep(50);
  assert.strictEqual(JSON.parse(B2.win.localStorage.getItem('gf-quest-v1')).worlds['은빛 항구'].gfUpd,before,'edit time unchanged');
  console.log('UI sync2 OK');process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
