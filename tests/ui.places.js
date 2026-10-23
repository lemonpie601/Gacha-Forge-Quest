// Protagonist avatar and places captured from game replies the extension only observes (needs jsdom): node tests/ui.places.js
const {JSDOM}=require('jsdom'),fs=require('fs'),assert=require('assert');
const src=fs.readFileSync(process.argv[2]||require('path').join(__dirname,'..','extension.js'),'utf8');
const dom=new JSDOM('<!doctype html><body></body>',{url:'https://local.test/gacha-forge',runScripts:'outside-only'});
const win=dom.window,doc=win.document;
win.HTMLDialogElement.prototype.showModal=function(){this.open=true};win.HTMLDialogElement.prototype.close=function(){this.open=false};
const alerts=[];win.alert=m=>alerts.push(m);win.confirm=()=>true;win.prompt=()=>null;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const reply=body=>({ok:true,status:200,headers:{get:()=>'application/json'},clone(){return this},json:async()=>body});
const seen=[];
win.fetch=async(url,opts={})=>{
  const u=String(url);seen.push(u);
  if(u.includes('/api/gacha-forge/state'))return reply({activeRunId:'run-x',runs:[{runId:'run-x',name:'서울 각성자 월드',protagonist:{name:'홍길동',personaId:'p 1',avatarPath:''}}]});
  if(u.includes('/api/gacha-forge/chapter-plan'))return reply({ok:true,plan:{title:'t',premise:'p',nodes:[{index:1,type:'story',title:'오염 경보',goal:'오염원을 찾는다',location:'제1공방'},{index:2,type:'combat',title:'전투'},{index:3,type:'story',title:'보고',goal:'',location:'각성자 관리국'},{index:4,type:'story',title:'복귀',goal:'',location:'제1공방 '}]}});
  if(u.includes('/api/gacha-forge/locations'))return reply({ok:true,places:{a:{name:'제1공방',url:'/api/bg/a.png'}}});
  if(u.includes('/api/characters/personas/'))return reply({id:'p 1',avatarPath:'/api/avatars/p1.png'});
  return reply({});
};
win.localStorage.setItem('gf-quest-v1',JSON.stringify({v:1,world:'w',worlds:{w:{quests:[{id:'q',title:'제1공방 긴급 방어 작전',claimed:false,target:1,progress:0}],fields:[],items:[],history:[],gfRunId:'run-x',gfDisplayName:'서울 각성자 월드'}}}));
const host=doc.createElement('marinara-capability-gacha-forge');doc.body.append(host);
const sr=host.attachShadow({mode:'open'});sr.innerHTML='<div><button class="gf-fs-bar icon-button">⛶</button></div>';
win.__gfqNativeDialogs=true; // v0.12.0: answer the in-page dialogs with the stubbed confirm/prompt above
win.eval(src);
const W=()=>JSON.parse(win.localStorage.getItem('gf-quest-v1')).worlds.w;
(async()=>{
  await win.fetch('/api/gacha-forge/state');await sleep(30);
  assert.strictEqual(W().protagonist,'홍길동','empty protagonist filled from the game');assert.strictEqual(W().gfHero.personaId,'p 1');
  await win.fetch('/api/gacha-forge/chapter-plan',{method:'POST',body:JSON.stringify({runId:'run-x',chapter:3})});await sleep(30);
  let P=W().gfPlaces;assert.deepStrictEqual(Object.keys(P),['제1공방','각성자 관리국'],'combat nodes skipped, same place merged');
  assert.deepStrictEqual(P['제1공방'].chapters,[3]);assert.strictEqual(P['제1공방'].scenes.length,2);
  await win.fetch('/api/gacha-forge/chapter-plan',{method:'POST',body:JSON.stringify({runId:'run-x',chapter:3})});await sleep(30);
  assert.strictEqual(W().gfPlaces['제1공방'].scenes.length,2,'same plan twice adds nothing');
  await win.fetch('/api/gacha-forge/locations',{method:'POST',body:JSON.stringify({runId:'run-x'})});await sleep(30);
  assert.strictEqual(W().gfPlaces['제1공방'].url,'/api/bg/a.png');
  // Profile asks Marinara for the persona avatar once.
  sr.querySelector('button[data-gfq="top"]').click();
  const panel=doc.getElementById('gfq-01-panel');const click=sel=>panel.querySelector(sel).dispatchEvent(new win.MouseEvent('click',{bubbles:true}));
  click('[data-tab="profile"]');await sleep(30);
  assert.ok(seen.some(u=>u.includes('/api/characters/personas/p%201')),'persona fetched by id');
  assert.strictEqual(W().gfHero.avatar,'/api/avatars/p1.png');assert.ok(panel.querySelector('.gfq-photo img[src="/api/avatars/p1.png"]'),'avatar shown');
  click('[data-tab="profile"]');await sleep(30);assert.strictEqual(seen.filter(u=>u.includes('/personas/')).length,1,'no repeat fetch');
  // Current place follows the scene background once a line settles.
  sr.innerHTML+='<div data-bg="a" style="background-image:url(&quot;/api/bg/a.png&quot;)"></div><div class="vn">대사</div><div class="vn-caption">3챕터 · 오염 경보</div><div class="vn-count">01 / 20</div>';
  await sleep(1600);
  assert.strictEqual(W().gfPlaceNow?.key,'제1공방','current place from background');
  click('[data-tab="places"]');
  assert.strictEqual(panel.querySelectorAll('.gfq-pinbox').length,2);assert.ok(panel.querySelector('.gfq-pinbox.here'));
  assert.ok(panel.innerHTML.includes('제1공방 긴급 방어 작전'),'related quest by name');
  click('.gfq-pinbox:not(.here)');assert.ok(panel.querySelector('.gfq-placeinfo h4').textContent==='각성자 관리국');
  // Related quest opens on the quest tab; the quest shows its place.
  click('.gfq-pinbox.here');click('[data-action="open-quest"]');assert.ok(panel.querySelector('.gfq-qdetail h3').textContent.includes('제1공방 긴급 방어 작전'));
  assert.ok(panel.querySelector('.gfq-qplace')?.textContent.includes('제1공방'),'quest shows its place');
  // Item icons are chosen from the name.
  assert.ok(src.includes("건틀릿|장갑"),'icon keywords');
  console.log('UI places OK');process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
