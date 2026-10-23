// End-to-end analysis flow with a mocked AI connection (needs jsdom): npm i --no-save jsdom@24 && node tests/ui.flow.js
const {JSDOM}=require('jsdom'),fs=require('fs'),assert=require('assert');
const src=fs.readFileSync(process.argv[2]||require('path').join(__dirname,'..','extension.js'),'utf8');
const dom=new JSDOM('<!doctype html><body></body>',{url:'https://local.test/gacha-forge',runScripts:'outside-only'});
const win=dom.window,doc=win.document;
win.HTMLDialogElement.prototype.showModal=function(){this.open=true};win.HTMLDialogElement.prototype.close=function(){this.open=false};
const alerts=[];win.alert=m=>alerts.push(m);win.confirm=()=>true;win.prompt=()=>null;
const S1='채서래 씨는 임무 완료 시 세후 총 1,400,000원을 등록 계좌로 정산받게 됩니다.';
const S2='맞춤 경량 건틀릿을 내일 이 시간에 수령하시게 됩니다.';
const S3='채서래의 계좌에 1,400,000원이 입금됐다는 알림이 울렸다.';
const S4='채서래는 공방 창구에서 맞춤 경량 건틀릿 1개를 건네받았다.';
const samples=[S1,S2,...Array.from({length:10},(_,i)=>'채서래는 공방 복도를 걸었다. 평범한 장면 '+i+'입니다.')].map((text,i)=>({id:'s'+i,chapter:'3',index:String(i+1),text}))
  .concat([{id:'s20',chapter:'4',index:'1',text:S3},{id:'s21',chapter:'4',index:'2',text:S4}]);
const prompts=[];
win.fetch=async(url,opts)=>{
  const u=String(url);
  if(u.includes('/api/connections'))return {ok:true,json:async()=>[{id:'c1',name:'test'}],headers:{get:()=>'application/json'}};
  if(!u.includes('/api/generate/raw'))return {ok:false,status:404,json:async()=>({}),headers:{get:()=>''}};
  const user=JSON.parse(opts.body).messages[1].content;prompts.push(user);
  let out;
  if(user.includes('[새 퀘스트 후보]'))out={groups:[]};
  else if(!user.includes('[이전 맥락]'))out={events:[
    {category:'contract',name:'긴급 설비 방어 보수',status:'confirmed',financialStatus:'pending',evidence:'임무 완료 시 세후 총 1,400,000원을 등록 계좌로 정산받게 됩니다',amount:1400000,unit:'원',owner:'player',source:'챕터 3 · 장면 1'},
    {category:'item',name:'맞춤 경량 건틀릿',status:'active',financialStatus:'pending',evidence:'맞춤 경량 건틀릿을 내일 이 시간에 수령하시게 됩니다',amount:1,unit:'개',owner:'player',source:'챕터 3 · 장면 2'}]};
  else{
    const t=user.match(/\[(t\d+)\] 거래 · 긴급 설비 방어 보수/)[1],i=user.match(/\[(i\d+)\] 물품 · 맞춤 경량 건틀릿/)[1];
    out={events:[
    {category:'asset',name:'방어 보수 입금',status:'confirmed',financialStatus:'received',evidence:'계좌에 1,400,000원이 입금됐다',amount:1400000,unit:'원',owner:'player',source:'챕터 4 · 장면 1',linkTo:t},
    {category:'item',name:'맞춤 경량 건틀릿',status:'confirmed',financialStatus:'ownership',evidence:'맞춤 경량 건틀릿 1개를 건네받았다',amount:1,unit:'개',owner:'player',source:'챕터 4 · 장면 2',linkTo:i}]};}
  return {ok:true,status:200,json:async()=>({content:JSON.stringify(out)}),headers:{get:()=>'application/json'}};
};
win.localStorage.setItem('gf-quest-v1',JSON.stringify({v:1,world:'run-x',aiConnectionId:'c1',worlds:{'run-x':{quests:[],fields:[],items:[],history:[],gfStorySamples:samples}}}));
const host=doc.createElement('marinara-capability-gacha-forge');doc.body.append(host);
host.attachShadow({mode:'open'}).innerHTML='<div><button class="gf-fs-bar icon-button">⛶</button></div>';
win.__gfqNativeDialogs=true; // v0.12.0: answer the in-page dialogs with the stubbed confirm/prompt above
win.eval(src);
(async()=>{
  host.shadowRoot.querySelector('button[data-gfq="top"]').click();
  const panel=doc.getElementById('gfq-01-panel');
  const click=async sel=>{const el=panel.querySelector(sel);assert.ok(el,'missing '+sel);el.dispatchEvent(new win.MouseEvent('click',{bubbles:true}));await new Promise(r=>setTimeout(r,0));};
  await click('[data-tab="history"]');await click('[data-action="invoke-quest-bridge"]');
  for(let k=0;k<100&&!alerts.some(a=>a.startsWith('AI 분석이 완료'));k++)await new Promise(r=>setTimeout(r,20));
  assert.ok(alerts.some(a=>a.startsWith('AI 분석이 완료')),'analysis finished: '+alerts.join(' | '));
  assert.strictEqual(prompts.length,2,'two extraction batches, no consolidation needed (no quests)');
  assert.ok(!prompts[0].includes('[이전 맥락]')&&prompts[1].includes('[이전 맥락]'),'context only from earlier batches');
  assert.match(alerts.at(-1),/이전 기록 연결: 2개/);
  const html=panel.innerHTML;assert.ok(html.includes('이전 기록 연결: 긴급 설비 방어 보수 (지급 예정 → 입금 확인)'));
  await click('[data-action="select-all-ai"]');await click('[data-action="approve-selected-ai"]');
  const w=JSON.parse(win.localStorage.getItem('gf-quest-v1')).worlds['run-x'];
  assert.strictEqual(w.gfLedger.length,1,'one payment, not two');
  assert.strictEqual(w.gfLedger[0].state,'received');assert.strictEqual(w.gfLedger[0].history.length,2);
  assert.strictEqual(w.items.length,1);assert.strictEqual(w.items[0].state,undefined,'gauntlet now owned');
  assert.strictEqual(w.aiProposals.length,0);
  assert.deepStrictEqual(Object.keys(w.gfAnalyzed).sort(),['3','4'],'chapters fingerprinted after success');
  // Second run with the default range: nothing new, so no AI call is made.
  const calls=prompts.length;await click('[data-tab="history"]');await click('[data-action="invoke-quest-bridge"]');
  await new Promise(r=>setTimeout(r,50));
  assert.strictEqual(prompts.length,calls);assert.match(alerts.at(-1),/새로 추가되거나 바뀐 챕터가 없습니다/);
  console.log('UI flow OK');process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
