// v0.13.0: world clock — a world-fitting date when the story writes none, time of day, time markers on screen (needs jsdom): node tests/ui.clock.js
const {JSDOM}=require('jsdom'),fs=require('fs'),assert=require('assert');
const src=fs.readFileSync(process.argv[2]||require('path').join(__dirname,'..','extension.js'),'utf8');
const dom=new JSDOM('<!doctype html><body></body>',{url:'https://local.test/gacha-forge',runScripts:'outside-only'});
const win=dom.window,doc=win.document;
win.HTMLDialogElement.prototype.showModal=function(){this.open=true};win.HTMLDialogElement.prototype.close=function(){this.open=false};
const confirms=[];win.alert=()=>{};win.confirm=m=>{confirms.push(m);return true;};let answer=null;win.prompt=()=>answer;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
win.fetch=async()=>({ok:false,status:404,json:async()=>({}),headers:{get:()=>''}});
const W0={quests:[],fields:[],items:[],history:[],gfRunId:'run-x',protagonist:'홍길동',gfDisplayName:'서울 각성자 월드',
  gfStorySamples:[{id:'s1',chapter:'3',index:'1',text:'2033년 봄, 벚꽃이 흩날리는 성수동. 홍길동은 공방 문을 열었다.'}],
  gfLedger:[{id:'L1',name:'위험 수당',amount:500000,unit:'원',state:'pending',timing:{text:'금일 오후 6시',anchor:'챕터 3 · 장면 1'},history:[]}]};
win.localStorage.setItem('gf-quest-v1',JSON.stringify({v:1,world:'w',worlds:{w:W0}}));
const host=doc.createElement('marinara-capability-gacha-forge');doc.body.append(host);
const sr=host.attachShadow({mode:'open'});
sr.innerHTML='<div class="bar"><button class="gf-fs-bar icon-button">⛶</button></div><div class="vn"><span class="vn-caption">공방3챕터 · 성수동 제1공방</span><p class="vn-line">…</p><span class="vn-count">01 / 10</span></div>';
win.__gfqNativeDialogs=true;
win.eval(src);
const W=()=>JSON.parse(win.localStorage.getItem('gf-quest-v1')).worlds.w;
const toasts=()=>[...doc.querySelectorAll('#gfq-01-toasts .gfq-toast,#gfq-01-qtoasts .gfq-toast')].map(e=>e.textContent);
const show=async(line,n)=>{sr.querySelector('.vn-line').textContent=line;sr.querySelector('.vn-count').textContent=String(n).padStart(2,'0')+' / 10';await sleep(1600);};
(async()=>{
  sr.querySelector('button[data-gfq="top"]').click();
  const panel=doc.getElementById('gfq-01-panel');
  const click=async sel=>{const e=panel.querySelector(sel);assert.ok(e,'missing '+sel);e.dispatchEvent(new win.MouseEvent('click',{bubbles:true}));await sleep(30);};
  await click('[data-tab="profile"]');
  assert.ok(panel.querySelector('[data-action="date-auto"]'),'offer a world-fitting date when the story writes none');
  assert.ok(panel.querySelector('[data-action="time-next"]').disabled,'no clock before a date');
  // No AI connection: the year and season written in the story decide the date.
  await click('[data-action="date-auto"]');await sleep(50);
  assert.ok(confirms.some(m=>m.includes('2033.04.01')&&m.includes('봄')),confirms.join(' | '));
  let w=W();assert.strictEqual(w.gfDateManual.date,'2033-04-01');assert.strictEqual(w.gfDateManual.by,'ai');assert.strictEqual(w.gfDateAnchor.date,'2033-04-01');
  assert.match(panel.querySelector('.gfq-tk-date').textContent,/2033\.04\.01.*시각 미정.*세계관 추정/);
  // Starting money: nothing written anywhere, no AI → a modest default for the currency, after a confirm.
  await click('[data-action="cash-auto"]');await sleep(50);
  assert.ok(confirms.some(m=>m.includes('300,000')),confirms.join(' | '));
  w=W();assert.deepStrictEqual([w.gfCashBase.amount,w.gfCashBase.by,w.gfCashBase.basis],[300000,'guess','자동 추정']);
  assert.match(panel.querySelector('.gfq-cash').textContent,/300,000.*자동 추정/);
  // Time passes by periods.
  await click('[data-action="time-next"]');w=W();assert.strictEqual(w.gfTimeManual.period,'아침');
  await click('[data-action="time-next"]');assert.match(panel.querySelector('.gfq-tk-clock').textContent,/오전/);
  // A typed date and time confirms the calendar; the estimate moves with it.
  answer='4월 4일 오후 3시';await click('[data-action="date-set"]');
  w=W();assert.strictEqual(w.gfDateManual.date,'2033-04-04');assert.strictEqual(w.gfTimeManual.time,'15:00');assert.ok(w.gfDateAnchor.confirmed);
  assert.match(panel.querySelector('.gfq-tk-clock').textContent,/오후 3시/);
  assert.ok(!panel.querySelector('[data-action="date-auto"]'),'a typed date is not an estimate');
  // Calendar: a promise for a set time shows that time.
  await click('[data-tab="calendar"]');await click('[data-action="cal-day"][data-id="2033-04-04"]');
  assert.ok([...panel.querySelectorAll('.gfq-cal-list li')].some(li=>li.textContent.includes('오후 6시 · 위험 수당')),panel.querySelector('.gfq-cal-list').textContent);
  assert.match(panel.querySelector('.gfq-cal-list h3').textContent,/오늘 오후 3시/);
  // Time markers on screen: '[밤]' moves the clock, then '[아침]' is the next morning.
  await show('[밤]',2);
  w=W();assert.strictEqual(w.gfReadingTime.period,'밤');assert.ok(toasts().some(t=>t.startsWith('시간 변경밤')),toasts().join(' | '));
  await show('[아침]',3);
  w=W();assert.strictEqual(w.gfReadingDate.date,'2033-04-05');assert.ok(w.gfReadingDate.est);
  assert.ok(toasts().some(t=>t.startsWith('날짜 변경2033.04.05 (화) 아침 · 하루가 지났습니다')),toasts().join(' | '));
  // A month-day marker uses the year in force; 'N일차' counts from it.
  await show('4월 7일 (목) 저녁',4);
  w=W();assert.strictEqual(w.gfReadingDate.date,'2033-04-07');assert.strictEqual(w.gfReadingTime.period,'저녁');
  await show('1일차',5);await show('3일차',6);
  w=W();assert.strictEqual(w.gfReadingDate.date,'2033-04-09');
  console.log('UI clock OK');process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
