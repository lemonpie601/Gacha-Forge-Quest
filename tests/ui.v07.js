// v0.7.0: characters, place check-in, schedule, chapter log, achievements (needs jsdom): node tests/ui.v07.js
const {JSDOM}=require('jsdom'),fs=require('fs'),assert=require('assert');
const src=fs.readFileSync(process.argv[2]||require('path').join(__dirname,'..','extension.js'),'utf8');
const dom=new JSDOM('<!doctype html><body></body>',{url:'https://local.test/gacha-forge',runScripts:'outside-only'});
const win=dom.window,doc=win.document;
win.HTMLDialogElement.prototype.showModal=function(){this.open=true};win.HTMLDialogElement.prototype.close=function(){this.open=false};
win.alert=()=>{};win.confirm=()=>true;let answer=null;win.prompt=()=>answer;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const reply=body=>({ok:true,status:200,headers:{get:()=>'application/json'},clone(){return this},json:async()=>body});
let extra=null;
win.fetch=async(url)=>{const u=String(url);if(extra){const r=extra(u);if(r)return r;}
  if(u.includes('/api/gacha-forge/beat'))return reply({ok:true,segments:[{speaker:'',text:'바람이 분다.'},{speaker:'한도윤',text:'가자.',place:'제1공방'},{speaker:'한도윤',text:'서둘러.',place:'제1공방'},{speaker:'홍길동',text:'응.'},{speaker:'공방장',text:'늦었군.',place:'제1공방'}],cast:[{name:'한도윤',art:'/p/han.png',prota:false},{name:'홍길동',art:'/p/me.png',prota:true}]});
  if(u.includes('/api/gacha-forge/roster'))return reply({ok:true,cards:[{id:'u1',name:'한도윤',kind:'character',rarity:4,role:'방어 담당',portrait:'/p/han2.png',level:12,bond:3},{id:'u2',name:'성검',kind:'weapon'},{id:'u3',name:'홍길동',isProtagonist:true}]});
  if(u.includes('/api/gacha-forge/unit'))return reply({ok:true,unit:{name:'한도윤',kind:'character',portrait:'/p/base.png',wornOutfit:'',outfits:[{id:'o1',name:'정장',url:'/p/suit.png'},{id:'o2',name:'전투복',url:'/p/combat.png'}]}});
  return reply({});};
const W0={quests:[],fields:[],items:[],history:[],gfRunId:'run-x',protagonist:'홍길동',gfDisplayName:'월드',
  gfPlaces:{'제1공방':{name:'제1공방',chapters:[3],scenes:[],url:'/bg/a.png'},'관리국':{name:'관리국',chapters:[3],scenes:[],url:'/bg/b.png'}},gfPlaceNow:{key:'관리국'},
  gfLedger:[{id:'L1',name:'위험 수당',amount:500000,unit:'원',state:'pending',timing:{text:'내일',base:'2033-04-09'},history:[]}],gfDates:{'3':{date:'2033-04-09'}}};
win.localStorage.setItem('gf-quest-v1',JSON.stringify({v:1,world:'w',worlds:{w:W0}}));
const host=doc.createElement('marinara-capability-gacha-forge');doc.body.append(host);
const sr=host.attachShadow({mode:'open'});sr.innerHTML='<div><button class="gf-fs-bar icon-button">⛶</button></div>';
win.__gfqNativeDialogs=true; // v0.12.0: answer the in-page dialogs with the stubbed confirm/prompt above
win.eval(src);
const W=()=>JSON.parse(win.localStorage.getItem('gf-quest-v1')).worlds.w;
const toasts=()=>[...doc.querySelectorAll('#gfq-01-toasts .gfq-toast,#gfq-01-qtoasts .gfq-toast')].map(e=>e.textContent);
(async()=>{
  // Characters from a scene: speakers counted once per scene, narration and the protagonist skipped.
  const beat=()=>win.fetch('/api/gacha-forge/beat',{method:'POST',body:JSON.stringify({runId:'run-x',chapter:3,storyIndex:0})});
  await beat();await sleep(30);await beat();await sleep(30);
  let C=W().gfCast;assert.deepStrictEqual(Object.keys(C).sort(),['공방장','한도윤']);
  assert.deepStrictEqual(C['한도윤'].sc,{'3:1':2},'same scene twice counts once');assert.strictEqual(C['한도윤'].scp['3:1'],'제1공방');assert.strictEqual(C['한도윤'].art,'/p/han.png');
  await win.fetch('/api/gacha-forge/roster',{method:'POST',body:JSON.stringify({runId:'run-x'})});await sleep(30);
  C=W().gfCast;assert.strictEqual(C['한도윤'].roster,true);assert.strictEqual(C['한도윤'].level,12);assert.ok(!C['성검'],'weapons skipped');
  sr.querySelector('button[data-gfq="top"]').click();
  const panel=doc.getElementById('gfq-01-panel');const click=async sel=>{const e=panel.querySelector(sel);assert.ok(e,'missing '+sel);e.dispatchEvent(new win.MouseEvent('click',{bubbles:true}));await new Promise(r=>setTimeout(r,0));};
  await click('[data-tab="cast"]');assert.strictEqual(panel.querySelectorAll('.gfq-face').length,2);assert.ok(panel.querySelector('.gfq-castcard h4').textContent==='한도윤');
  await sleep(50);
  assert.strictEqual(W().gfCast['한도윤'].outfits.length,2,'outfits fetched once for a roster hero');
  assert.strictEqual(panel.querySelectorAll('[data-action="cast-outfit"]').length,4,'game look, base and two outfits');
  await click('[data-action="cast-outfit"][data-o="o1"]');assert.strictEqual(W().gfCast['한도윤'].pick,'o1');
  assert.ok(panel.querySelector('.gfq-face.on img').getAttribute('src')==='/p/suit.png','picked outfit shown');
  await click('[data-action="cast-outfit"][data-o=""]');assert.strictEqual(W().gfCast['한도윤'].pick,undefined);
  answer='믿을 만한 동료';await click('[data-action="cast-note"]');assert.strictEqual(W().gfCast['한도윤'].note,'믿을 만한 동료');
  await click('[data-action="cast-filter"][data-id="등장인물"]');assert.strictEqual(panel.querySelectorAll('.gfq-face').length,1);
  // Place check-in: a new scene background announces the place.
  sr.innerHTML+='<div data-bg="a" style="background-image:url(&quot;/bg/a.png&quot;)"></div><div class="vn">대사</div><div class="vn-caption">3챕터 · x</div><div class="vn-count">01 / 20</div>';
  await sleep(1600);
  assert.strictEqual(W().gfPlaceNow.key,'제1공방');assert.ok(toasts().some(t=>t.startsWith('장소 이동제1공방')),'check-in toast: '+toasts().join('|'));
  // Schedule: the payment promised for 'tomorrow' of 2033-04-09 is due on 04-10; moving the date announces it.
  await click('[data-tab="calendar"]');assert.ok(panel.querySelector('.gfq-cal-day[data-id="2033-04-10"] i.k-pay'),'due day marked');
  answer='2033-04-10';await click('[data-tab="profile"]');await click('[data-action="date-set"]');
  assert.ok(toasts().some(t=>t.startsWith('오늘 예정')&&t.includes('위험 수당')),'due toast');
  answer='2033-04-12';await click('[data-action="date-set"]');await click('[data-tab="calendar"]');
  assert.ok(panel.querySelector('.gfq-late')?.textContent.includes('위험 수당'),'overdue listed');
  // v0.12.0: achievements were removed: nothing is recorded, shown or announced.
  extra=u=>u.includes('/locations')?reply({ok:true,places:{a:{name:'역',url:'/bg/c.png'},b:{name:'시장',url:'/bg/d.png'},c:{name:'옥상',url:'/bg/e.png'}}}):null;
  await win.fetch('/api/gacha-forge/locations',{method:'POST',body:JSON.stringify({runId:'run-x'})});await sleep(30);
  assert.strictEqual(W().gfAch,undefined,'no achievement record');
  await click('[data-tab="profile"]');assert.ok(!panel.querySelector('.gfq-ach')&&!panel.innerHTML.includes('<h3>업적</h3>'),'no achievement section');
  assert.ok(!toasts().some(t=>t.startsWith('업적')),'no achievement toast');
  // Chapter cards: chapter 3 shows its places and people.
  await click('[data-tab="history"]');const card=panel.querySelector('.gfq-chcard');assert.ok(card.textContent.includes('제1공방')&&card.textContent.includes('한도윤'),'chapter card');
  // Themes are per world and also colour the popups.
  await click('[data-tab="settings"]');await click('[data-action="pick-theme"][data-id="east"]');
  assert.strictEqual(W().gfTheme,'east');assert.strictEqual(panel.dataset.theme,'east');assert.strictEqual(doc.getElementById('gfq-01-toasts').dataset.theme||'east','east');
  assert.ok(!panel.innerHTML.includes('스토리 분석 후보'),'keyword candidates removed');
  console.log('UI v0.7 OK');process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
