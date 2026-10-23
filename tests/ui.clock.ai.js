// v0.13.0: analysis picks a world-fitting date when the story writes none, then follows the clock (needs jsdom): node tests/ui.clock.ai.js
const {JSDOM}=require('jsdom'),fs=require('fs'),assert=require('assert');
const src=fs.readFileSync(process.argv[2]||require('path').join(__dirname,'..','extension.js'),'utf8');
const dom=new JSDOM('<!doctype html><body></body>',{url:'https://local.test/gacha-forge',runScripts:'outside-only'});
const win=dom.window,doc=win.document;
win.HTMLDialogElement.prototype.showModal=function(){this.open=true};win.HTMLDialogElement.prototype.close=function(){this.open=false};
win.alert=()=>{};win.confirm=()=>true;win.prompt=()=>null;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const reply=body=>({ok:true,status:200,headers:{get:k=>k==='content-type'?'application/json':null},clone(){return this},json:async()=>body});
const prompts=[];
win.fetch=async(url,opts)=>{
  const u=String(url);
  if(u.includes('/api/connections'))return reply([{id:'c1',name:'test'}]);
  if(u.includes('/api/lorebooks/lb1/entries'))return reply([{name:'홍길동',content:'22세 신입 각성자. 소지금 35만 원, 월세에 쫓긴다.',enabled:true},{name:'꺼진 항목',content:'소지금 1억 원',enabled:false}]);
  if(!u.includes('generate'))return reply({});
  const user=JSON.parse(opts.body).messages[1].content;prompts.push(user);
  if(user.includes('시작 설정을 정합니다'))return reply({content:JSON.stringify({startCash:350000,cashUnit:'원',cashEvidence:'소지금 35만 원',cashReason:'로어북의 주인공 설정'})});
  const timeline=user.includes('[챕터 1')?{worldDate:'2026-05-01',worldDateReason:'근미래 서울의 늦봄',timeOfDay:'저녁',timeOfDayEvidence:'해가 지고'}
    :{daysPassed:1,daysEvidence:'다음 날 아침',timeOfDay:'아침',timeOfDayEvidence:'다음 날 아침'};
  return reply({content:JSON.stringify({timeline,events:[]})});
};
const W0={quests:[],fields:[],items:[],history:[],gfRunId:'run-x',gfRunLore:{worldIds:['lb1'],castIds:[],worldBudget:null,castBudget:null,beat:true},protagonist:'홍길동',gfDisplayName:'서울 각성자 월드',
  gfStorySamples:[{id:'a',chapter:'1',index:'1',text:'게이트가 열린 지 십 년째인 2033년. 해가 지고 성수동 거리에 불이 켜졌다.'},
    {id:'b',chapter:'2',index:'1',text:'다음 날 아침, 홍길동은 공방으로 향했다.'}]};
win.localStorage.setItem('gf-quest-v1',JSON.stringify({v:1,world:'w',aiConnectionId:'c1',aiRange:'all',worlds:{w:W0}}));
const host=doc.createElement('marinara-capability-gacha-forge');doc.body.append(host);
const sr=host.attachShadow({mode:'open'});sr.innerHTML='<div class="bar"><button class="gf-fs-bar icon-button">⛶</button></div>';
win.__gfqNativeDialogs=true;
win.eval(src);
const W=()=>JSON.parse(win.localStorage.getItem('gf-quest-v1')).worlds.w;
(async()=>{
  sr.querySelector('button[data-gfq="top"]').click();
  const panel=doc.getElementById('gfq-01-panel');
  await sleep(50);
  const b=doc.createElement('button');b.dataset.action='invoke-quest-bridge';panel.append(b);b.dispatchEvent(new win.MouseEvent('click',{bubbles:true}));
  for(let k=0;k<200&&!W().gfLastAnalysis;k++)await sleep(30);
  const w=W();
  assert.ok(prompts[0].includes('"worldDate"'),'first chapter: no date yet, ask for one');
  assert.ok(!prompts[1].includes('"worldDate"'),'second chapter: the date is known');
  assert.match(prompts[1],/\[세계관 날짜\] 2033-05-01 저녁/);
  assert.deepStrictEqual([w.gfDateAnchor.date,w.gfDateAnchor.reason,w.gfDateAnchor.by],['2033-05-01','근미래 서울의 늦봄','ai'],'the year written in the story wins over the AI\'s');
  assert.deepStrictEqual([w.gfDates['1'].date,w.gfDates['1'].period],['2033-05-01','저녁']);
  assert.deepStrictEqual([w.gfDates['2'].date,w.gfDates['2'].basis,w.gfDates['2'].period],['2033-05-02','추정','아침']);
  assert.match(w.gfLastAnalysis.anchored,/2033\.05\.01/);
  const setup=prompts.find(p=>p.includes('시작 설정을 정합니다'));
  assert.ok(setup&&setup.includes('소지금 35만 원')&&!setup.includes('1억'),'the enabled world lorebook entries are sent');
  assert.ok(!setup.includes('"worldDate"'),'the date was already set during the run');
  assert.deepStrictEqual([w.gfCashBase.amount,w.gfCashBase.unit,w.gfCashBase.basis,w.gfCashBase.by],[350000,'원','원문','ai']);
  assert.match(w.gfLastAnalysis.cashSet,/350,000/);
  await new Promise(r=>setTimeout(r,0));
  const tab=panel.querySelector('[data-tab="profile"]');tab.dispatchEvent(new win.MouseEvent('click',{bubbles:true}));await sleep(30);
  const block=panel.querySelector('.gfq-tk-date').textContent;
  assert.match(block,/2033\.05\.02/);assert.match(block,/아침/);
  const cash=panel.querySelector('.gfq-cash').textContent;
  assert.match(cash,/350,000/);assert.match(cash,/원문 금액/);assert.ok(panel.querySelector('[data-action="cash-auto"]'),'an estimate can be redone');
  console.log('UI clock (analysis) OK');process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
