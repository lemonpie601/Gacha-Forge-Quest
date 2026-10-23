// v0.7.7: hand edits (quest form, place/character rename·merge·delete, transaction edit), merged rewards, storage meter (needs jsdom): node tests/ui.v077.js
const {JSDOM}=require('jsdom'),fs=require('fs'),assert=require('assert');
const src=fs.readFileSync(process.argv[2]||require('path').join(__dirname,'..','extension.js'),'utf8');
const dom=new JSDOM('<!doctype html><body></body>',{url:'https://local.test/gacha-forge',runScripts:'outside-only'});
const win=dom.window,doc=win.document;
win.HTMLDialogElement.prototype.showModal=function(){this.open=true};win.HTMLDialogElement.prototype.close=function(){this.open=false};
let answers=[],confirms=0,alerts=[];win.alert=m=>alerts.push(m);win.confirm=()=>{confirms++;return true;};win.prompt=()=>answers.shift()??null;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const reply=body=>({ok:true,status:200,headers:{get:()=>'application/json'},clone(){return this},json:async()=>body});
win.fetch=async(url)=>{const u=String(url);
  if(u.includes('/api/gacha-forge/beat'))return reply({ok:true,segments:[{speaker:'도윤',text:'가자.',place:'공방'},{speaker:'한도윤',text:'응.'}]});
  if(u.includes('/api/gacha-forge/locations'))return reply({ok:true,places:{a:{name:'제1 공방',url:'/bg/a2.png'},b:{name:'폐창고',url:'/bg/x.png'}}});
  return reply({});};
const samples=[];for(let ch=1;ch<=5;ch++)for(let i=0;i<4;i++)samples.push({id:'s'+ch+i,chapter:ch,index:i,text:'장면 '+ch+'-'+i});
const W0={quests:[{id:'q1',title:'설비 방어',type:'의뢰',detail:'공방을 지킨다',steps:['정찰','방어'],stepDone:[true,false],target:1,progress:0,claimed:false,
    rewardDetails:[{kind:'money',name:'긴급 설비 방어 보수 총액',amount:1400000,unit:'원',certainty:'pending'},{kind:'money',name:'세후 총액',amount:1400000,unit:'원',certainty:'confirmed'},{kind:'money',name:'중도 철수 시 최소 보장',amount:300000,unit:'원'},{kind:'item',name:'방패',certainty:'pending'}]}],
  fields:[],items:[],history:Array.from({length:260},(_,i)=>({at:'T',text:'기록 '+i})),gfRunId:'run-x',protagonist:'홍길동',gfDisplayName:'월드',gfStorySamples:samples,
  gfPlaces:{'제1공방':{name:'제1공방',chapters:[3],scenes:[{chapter:3,index:1,title:'출근'}],url:'/bg/a.png'},'제1 공방':{name:'제1 공방',chapters:[4],scenes:[{chapter:4,index:2,title:'수리'}]},'관리국':{name:'관리국',chapters:[3],scenes:[]}},gfPlaceNow:{key:'제1 공방'},
  gfCast:{'한도윤':{name:'한도윤',sc:{'3:1':2},scp:{'3:1':'공방'},art:'/p/han.png',roster:true},'도윤':{name:'도윤',sc:{'3:1':1,'4:1':3},scp:{},note:'말이 짧다'},'공방장':{name:'공방장',sc:{'3:2':1},scp:{}}},
  gfLedger:[{id:'L1',name:'위험 수당',amount:500000,unit:'원',state:'pending',history:[]}]};
win.localStorage.setItem('gf-quest-v1',JSON.stringify({v:1,world:'w',worlds:{w:W0}}));
const host=doc.createElement('marinara-capability-gacha-forge');doc.body.append(host);
const sr=host.attachShadow({mode:'open'});sr.innerHTML='<div><button class="gf-fs-bar icon-button">⛶</button></div>';
win.__gfqNativeDialogs=true; // v0.12.0: answer the in-page dialogs with the stubbed confirm/prompt above
win.eval(src);
const W=()=>JSON.parse(win.localStorage.getItem('gf-quest-v1')).worlds.w;
(async()=>{
  sr.querySelector('button[data-gfq="top"]').click();
  const panel=doc.getElementById('gfq-01-panel');const q=sel=>panel.querySelector(sel);const click=async sel=>{const e=q(sel);assert.ok(e,'missing '+sel);e.dispatchEvent(new win.MouseEvent('click',{bubbles:true}));await new Promise(r=>setTimeout(r,0));};
  // Duplicate money rewards: one row, labelled as a bundle; the conditional guarantee stays separate.
  await click('[data-tab="quests"]');
  const rows=[...panel.querySelectorAll('.gfq-rw-row')].map(e=>e.textContent);
  assert.strictEqual(rows.length,2,'1,400,000 twice → one row, plus the guarantee: '+rows.join(' | '));
  assert.ok(rows[0].includes('같은 보상 2건 묶음')&&rows[0].includes('1,400,000'));assert.ok(rows[1].includes('최소'));
  // Quest edit form.
  await click('[data-action="quest-edit"]');assert.ok(q('.gfq-qform'),'form shown');
  q('.gfq-qform [data-f="title"]').value='긴급 설비 방어';
  q('.gfq-qform [data-f="steps"]').value='정찰\n방어\n보고';
  const rw=[...panel.querySelectorAll('.gfq-qf-rw')];assert.strictEqual(rw.length,5,'4 rewards + a blank row');
  rw[0].querySelector('[data-f="del"]').checked=true;
  rw[3].querySelector('[data-f="name"]').value='강화 방패';
  rw[4].querySelector('[data-f="name"]').value='명성';rw[4].querySelector('[data-f="kind"]').value='reputation';rw[4].querySelector('[data-f="amount"]').value='2';
  // A background re-render keeps the draft.
  await win.fetch('/api/gacha-forge/beat',{method:'POST',body:JSON.stringify({runId:'run-x',chapter:5,storyIndex:0})});await sleep(30);
  assert.strictEqual(q('.gfq-qform [data-f="title"]').value,'긴급 설비 방어','draft survives re-render');
  await click('[data-action="quest-edit-save"]');
  let Q=W().quests[0];assert.strictEqual(Q.title,'긴급 설비 방어');assert.deepStrictEqual(Q.steps,['정찰','방어','보고']);assert.deepStrictEqual(Q.stepDone,[true,false,false]);
  assert.strictEqual(Q.rewardDetails.length,4);assert.ok(!Q.rewardDetails.some(r=>r.name==='긴급 설비 방어 보수 총액'));
  assert.ok(Q.rewardDetails.some(r=>r.name==='강화 방패'&&r.kind==='item'));assert.ok(Q.rewardDetails.some(r=>r.kind==='reputation'&&r.amount===2&&r.manual));
  assert.ok(Q.rewardDetails.find(r=>r.name==='중도 철수 시 최소 보장').conditional,'guarantee keeps conditional');
  assert.ok(!q('.gfq-qform'),'form closed');assert.strictEqual(W().gfLedger.length,1,'quest edit never adds money');
  // Bad amount is refused.
  await click('[data-action="quest-edit"]');panel.querySelectorAll('.gfq-qf-rw')[0].querySelector('[data-f="amount"]').value='많이';await click('[data-action="quest-edit-save"]');
  assert.ok(alerts.pop().includes('숫자'));await click('[data-action="quest-edit-cancel"]');
  // Place merge: '제1 공방' into '제1공방'; the game's old name then lands in the merged place.
  await click('[data-tab="places"]');await click('[data-action="select-place"][data-id="제1 공방"]');
  answers=['제1공방'];await click('[data-action="place-rename"]');
  let P=W().gfPlaces;assert.ok(!P['제1 공방']);assert.deepStrictEqual(P['제1공방'].chapters,[3,4]);assert.strictEqual(P['제1공방'].scenes.length,2);assert.strictEqual(W().gfPlaceNow.key,'제1공방');
  // Place delete: stays deleted when the game sends it again.
  await click('[data-action="select-place"][data-id="관리국"]');await click('[data-action="place-delete"]');
  answers=['폐창고 B'];
  await win.fetch('/api/gacha-forge/locations',{method:'POST',body:JSON.stringify({runId:'run-x'})});await sleep(30);
  P=W().gfPlaces;assert.ok(!P['제1 공방'],'alias followed');assert.strictEqual(P['제1공방'].url,'/bg/a2.png');assert.ok(P['폐창고']);
  // Plain rename keeps the key.
  for(const b of [...panel.querySelectorAll('.gfq-pager-tabs [data-action="place-page"]')].map(b=>b.dataset.id)){if(q('[data-action="select-place"][data-id="폐창고"]'))break;await click('.gfq-pager-tabs [data-action="place-page"][data-id="'+b+'"]');}
  await click('[data-action="select-place"][data-id="폐창고"]');await click('[data-action="place-rename"]');assert.strictEqual(W().gfPlaces['폐창고'].name,'폐창고 B');
  // Character merge and delete.
  await click('[data-tab="cast"]');await click('[data-action="select-cast"][data-id="도윤"]');
  answers=['한도윤'];await click('[data-action="cast-rename"]');
  let C=W().gfCast;assert.ok(!C['도윤']);assert.strictEqual(C['한도윤'].sc['3:1'],3);assert.strictEqual(C['한도윤'].sc['4:1'],3);assert.strictEqual(C['한도윤'].note,'말이 짧다');assert.strictEqual(C['한도윤'].roster,true);
  await click('[data-action="select-cast"][data-id="공방장"]');await click('[data-action="cast-delete"]');assert.ok(!W().gfCast['공방장']);
  await win.fetch('/api/gacha-forge/beat',{method:'POST',body:JSON.stringify({runId:'run-x',chapter:6,storyIndex:0})});await sleep(30);
  C=W().gfCast;assert.ok(!C['도윤'],'merged name stays merged');assert.strictEqual(C['한도윤'].sc['6:1'],2,'both names count into one person');
  // Transaction edit: name and amount, with a history line; state untouched.
  await click('[data-tab="profile"]');answers=['위험 수당(수정)','450,000'];{const row=panel.querySelector('details[data-tx="L1"]');row.open=true;row.dispatchEvent(new win.Event('toggle'));} // v0.12.0: row body is filled on open
  await click('[data-action="ledger-edit"][data-id="L1"]');
  const L=W().gfLedger[0];assert.strictEqual(L.name,'위험 수당(수정)');assert.strictEqual(L.amount,450000);assert.strictEqual(L.state,'pending');assert.ok(L.history.at(-1).evidence.includes('직접 수정'));
  // Storage meter and confirm-only cleanup.
  await click('[data-tab="settings"]');assert.ok(q('.gfq-meter'),'meter shown');assert.ok(q('.gfq-store').textContent.includes('스토리 장면'));
  const c0=confirms;await click('[data-action="storage-clean"]');assert.strictEqual(confirms,c0+1,'asks first');
  const w=W();assert.deepStrictEqual([...new Set(w.gfStorySamples.map(x=>x.chapter))],[3,4,5]);assert.ok(w.history.length<=200);
  assert.strictEqual(w.quests.length,1);assert.strictEqual(w.gfLedger.length,1);
  console.log('UI v0.7.7 OK');process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
