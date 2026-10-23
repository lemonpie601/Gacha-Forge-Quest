// v0.12.0: scene-timed delivery with the caption Gacha Forge 1.8.12 really renders ('Chapter Three · …') (needs jsdom): node tests/ui.scene.en.js
const {JSDOM}=require('jsdom'),fs=require('fs'),assert=require('assert');
const src=fs.readFileSync(process.argv[2]||require('path').join(__dirname,'..','extension.js'),'utf8');
const dom=new JSDOM('<!doctype html><body></body>',{url:'https://local.test/gacha-forge',runScripts:'outside-only'});
const win=dom.window,doc=win.document;
win.HTMLDialogElement.prototype.showModal=function(){this.open=true};win.HTMLDialogElement.prototype.close=function(){this.open=false};
win.alert=()=>{};win.confirm=()=>true;win.prompt=()=>null;
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
root.innerHTML='<div class="bar"><button class="gf-fs-bar icon-button">⛶</button></div><div class="vn"><span class="vn-caption"><span class="loc">압수 폐기물의 출처</span><span class="mood">Chapter Three · 성수동 제1공방</span></span><p class="vn-line">…</p><span class="vn-count">01 / 10</span></div>';
win.__gfqNativeDialogs=true; // v0.12.0: answer the in-page dialogs with the stubbed confirm/prompt above
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
  // Line with the commission: a quest offer appears.
  await show(L0,2);
  const offer=doc.querySelector('#gfq-01-qtoasts .gfq-toast-offer');assert.ok(offer,'quest offer shown: '+toasts().join(' | '));
  assert.match(offer.textContent,/새 퀘스트제1공방 긴급 방어 작전/);
  offer.querySelector('[data-o="yes"]').click();
  w=state();assert.strictEqual(w.quests.length,1);const q=w.quests[0];
  assert.strictEqual(q.claimed,false);assert.deepStrictEqual(q.stepDone,[false,false],'accepted, nothing done yet');
  // Payment line: the promised fee is recorded at that moment.
  await show(L1,3);
  w=state();assert.strictEqual(w.gfLedger.length,1);assert.strictEqual(w.gfLedger[0].state,'pending');
  assert.ok(toasts().some(t=>t.startsWith('지급 예정1,400,000원')),toasts().join(' | '));
  // The reader moves on to chapter four: what chapter three still held back is settled now (needs the chapter read from the caption).
  root.querySelector('.vn-caption .mood').textContent='Chapter Four · 귀환';await show('새로운 아침이 밝았다. 공방은 조용했다.',1);
  w=state();assert.ok((w.aiProposals||[]).every(p=>!p.deferred),'nothing from chapter three is still waiting: '+JSON.stringify((w.aiProposals||[]).map(p=>[p.name,p.deferred])));
  console.log('UI scene (English caption) OK');process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
