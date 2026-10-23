// Automatic mode end-to-end, driven only by simulated game traffic (needs jsdom): npm i --no-save jsdom@24 && node tests/ui.auto.js
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
    {category:'contract',name:'긴급 설비 방어 보수',status:'confirmed',financialStatus:'pending',evidence:'임무 완료 시 세후 총 1,400,000원을 등록 계좌로 정산해 드립니다',amount:1400000,unit:'원',owner:'player',source:'챕터 3 · 장면 1'},
    {category:'item',name:'맞춤 경량 건틀릿',status:'active',financialStatus:'pending',evidence:'맞춤 경량 건틀릿은 내일 이 시간에 수령하시게 됩니다',amount:1,unit:'개',owner:'player',source:'챕터 3 · 장면 2'},
    {category:'quest',name:'제1공방 방어',status:'completed',financialStatus:'not_applicable',evidence:'비상 냉각 밸브를 열어 용해로 폭발을 막아 냈다',owner:'player',source:'챕터 3 · 장면 3',questTitle:'제1공방 방어',questObjective:'폭발을 막는다'}]};
  return reply({content:JSON.stringify(out)});
};
const MODE=process.argv[3]||'chapter';
win.localStorage.setItem('gf-quest-v1',JSON.stringify({v:1,world:'',aiConnectionId:'c1',aiMode:MODE,autoApply:true,sceneTimed:false,worlds:{}}));
const host=doc.createElement('marinara-capability-gacha-forge');doc.body.append(host);
host.attachShadow({mode:'open'}).innerHTML='<div><button class="gf-fs-bar icon-button">⛶</button></div>';
win.__gfqNativeDialogs=true; // v0.12.0: answer the in-page dialogs with the stubbed confirm/prompt above
win.eval(src);
(async()=>{
  // Game traffic goes through the page's fetch, which the extension observes.
  const send=async(chapter,index,text)=>{nextBody={beat:{chapter,storyIndex:index,segments:[{text}]}};await win.fetch('/api/gacha-forge/beat',{method:'POST',body:JSON.stringify({runId:'run-abc',chapter,storyIndex:index})});await new Promise(r=>setTimeout(r,30));};
  await send(3,1,S1);await send(3,2,S2);await send(3,3,S3);
  await new Promise(r=>setTimeout(r,6600));
  if(MODE==='scene'){
    // Generation-complete mode: chapter 3 is analysed as soon as its responses go quiet.
    for(let k=0;k<200;k++){const d=JSON.parse(win.localStorage.getItem('gf-quest-v1'));if(d.worlds[d.world]?.gfLastAnalysis)break;await new Promise(r=>setTimeout(r,50));}
    let d=JSON.parse(win.localStorage.getItem('gf-quest-v1')),w=d.worlds[d.world];
    assert.deepStrictEqual(w.gfLastAnalysis.chapters,['3'],'chapter 3 analysed right after generation');
    assert.strictEqual(w.quests.length,1);assert.strictEqual(w.quests[0].claimed,true);
    const calls=prompts.filter(p=>!p.includes('[새 퀘스트 후보]')).length;
    assert.strictEqual(calls,1,'one extraction call for the whole chapter');
    // Chapter 4 arrives: only its new scene is sent, with chapter 3 results as context.
    await send(4,1,S4);await new Promise(r=>setTimeout(r,6600));
    for(let k=0;k<200;k++){d=JSON.parse(win.localStorage.getItem('gf-quest-v1'));if(d.worlds[d.world].gfLastAnalysis.chapters[0]==='4')break;await new Promise(r=>setTimeout(r,50));}
    const last=prompts.filter(p=>!p.includes('[새 퀘스트 후보]')).at(-1);
    assert.ok(last.includes(S4)&&!last.includes(S1),'only the new chapter is analysed');
    assert.ok(last.includes('[이전 맥락]'),'earlier results passed as context');
    console.log('UI auto (generation-complete mode) OK');process.exit(0);
  }
  assert.strictEqual(prompts.length,0,'chapter 3 is still the latest chapter, nothing analysed yet');
  await send(4,1,S4);
  for(let k=0;k<200&&!JSON.parse(win.localStorage.getItem('gf-quest-v1')).worlds[Object.keys(JSON.parse(win.localStorage.getItem('gf-quest-v1')).worlds)[0]]?.gfLastAnalysis;k++)await new Promise(r=>setTimeout(r,50));
  const d=JSON.parse(win.localStorage.getItem('gf-quest-v1')),w=d.worlds[d.world];
  assert.ok(w.gfLastAnalysis?.auto,'auto analysis ran');
  assert.deepStrictEqual(w.gfLastAnalysis.chapters,['3'],'only the finished chapter');
  assert.ok(!prompts[0].includes(S4),'chapter 4 text not sent');
  assert.strictEqual(w.quests.length,1);const q=w.quests[0];
  assert.strictEqual(q.claimed,true);assert.deepStrictEqual(q.stepDone,[true,true]);
  assert.strictEqual(w.fields.find(f=>f.name==='명성').value,'2');
  assert.strictEqual(w.gfLedger.length,1);assert.strictEqual(w.gfLedger[0].state,'pending');
  assert.strictEqual(q.rewardDetails.find(r=>r.kind==='money').txId,w.gfLedger[0].id,'reward linked to ledger');
  assert.strictEqual(w.items[0].state,'pending');
  assert.strictEqual(w.aiProposals.length,0);assert.ok(w.gfUndo);
  const toasts=[...doc.querySelectorAll('#gfq-01-toasts .gfq-toast,#gfq-01-qtoasts .gfq-toast')].map(e=>e.textContent);
  assert.ok(toasts.some(t=>t.startsWith('퀘스트 완료제1공방 긴급 방어 작전')),'quest toast: '+toasts.join(' | '));
  assert.ok(toasts.some(t=>t.includes('지급 예정')&&t.includes('1,400,000')));
  // Undo restores the state before the automatic application.
  host.shadowRoot.querySelector('button[data-gfq="top"]').click();
  const panel=doc.getElementById('gfq-01-panel');
  panel.querySelector('[data-tab="history"]').dispatchEvent(new win.MouseEvent('click',{bubbles:true}));
  panel.querySelector('[data-action="undo-auto"]').dispatchEvent(new win.MouseEvent('click',{bubbles:true}));await new Promise(r=>setTimeout(r,0));
  const u=JSON.parse(win.localStorage.getItem('gf-quest-v1')).worlds[d.world];
  assert.strictEqual(u.quests.length,0);assert.strictEqual(u.gfLedger.length,0);assert.ok(u.aiProposals.length>=3);assert.ok(!u.gfUndo);
  console.log('UI auto OK');process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
