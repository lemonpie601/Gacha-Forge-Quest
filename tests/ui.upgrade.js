// v0.14.1: a world already in progress is brought up to date when the updated extension starts (needs jsdom): node tests/ui.upgrade.js
const {JSDOM}=require('jsdom'),fs=require('fs'),assert=require('assert');
const src=fs.readFileSync(process.argv[2]||require('path').join(__dirname,'..','extension.js'),'utf8');
const dom=new JSDOM('<!doctype html><body></body>',{url:'https://local.test/gacha-forge',runScripts:'outside-only'});
const win=dom.window,doc=win.document;
win.HTMLDialogElement.prototype.showModal=function(){this.open=true};win.HTMLDialogElement.prototype.close=function(){this.open=false};
win.alert=()=>{};win.confirm=()=>true;win.prompt=()=>null;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const reply=body=>({ok:true,status:200,headers:{get:k=>k==='content-type'?'application/json':null},clone(){return this},json:async()=>body});
const prompts=[];
win.fetch=async(url,opts)=>{const u=String(url);
  if(u.includes('/api/connections'))return reply([{id:'c1',name:'test'}]);
  if(u.includes('/api/lorebooks/lb1/entries'))return reply([{name:'세계',content:'대륙력 812년. 용병 길드가 도시를 지킨다. 신입 용병의 지갑은 늘 가볍다.',enabled:true}]);
  if(!u.includes('generate'))return reply({});
  const user=JSON.parse(opts.body).messages[1].content;prompts.push(user);
  return reply({content:JSON.stringify({startCash:40,cashUnit:'골드',cashEvidence:'',cashReason:'신입 용병의 가벼운 지갑'})});};
// Saved by v0.12: chapters 1–2 analysed already, a '4월 3일 저녁' marker the old version could not read, no starting money.
const W0={quests:[],fields:[],items:[],history:[],gfRunId:'run-x',gfRunLore:{worldIds:['lb1'],castIds:[]},protagonist:'레온',gfDisplayName:'용병 월드',
  gfDates:{'1':{date:'0812-04-01',basis:'원문',evidence:'대륙력 812년 4월 1일'}},gfAnalyzed:{'1':'h1','2':'h2'},
  gfStorySamples:[{id:'a',chapter:'1',index:'1',text:'대륙력 812년 4월 1일\n레온은 길드에 등록했다. 금화 대신 골드 3골드를 받았다.'},
    {id:'b',chapter:'2',index:'1',text:'4월 3일 저녁\n레온은 여관에서 2골드를 냈다.'}]};
win.localStorage.setItem('gf-quest-v1',JSON.stringify({v:1,world:'w',aiConnectionId:'c1',worlds:{w:W0}}));
const host=doc.createElement('marinara-capability-gacha-forge');doc.body.append(host);
const sr=host.attachShadow({mode:'open'});sr.innerHTML='<div class="bar"><button class="gf-fs-bar icon-button">⛶</button></div>';
win.__gfqNativeDialogs=true;
win.eval(src);
const W=()=>JSON.parse(win.localStorage.getItem('gf-quest-v1')).worlds.w;
const toasts=()=>[...doc.querySelectorAll('#gfq-01-toasts .gfq-toast')].map(e=>e.textContent);
(async()=>{
  for(let k=0;k<100&&!W().gfCashBase;k++)await sleep(50);
  const w=W();
  assert.strictEqual(w.gfVer,14);
  assert.deepStrictEqual([w.gfDates['2'].date,w.gfDates['2'].period],['0812-04-03','저녁'],'the marker the old version skipped');
  assert.strictEqual(w.gfEra,'대륙력');
  assert.strictEqual(prompts.length,1,'one setup call, money only (the story has a date)');
  assert.ok(prompts[0].includes('신입 용병의 지갑')&&!prompts[0].includes('"worldDate"'));
  assert.deepStrictEqual([w.gfCashBase.amount,w.gfCashBase.unit,w.gfCashBase.by],[40,'골드','ai']);
  assert.ok(toasts().some(t=>t.startsWith('업데이트 반영')&&t.includes('40')),toasts().join(' | '));
  // Runs once: later checks do not ask again.
  await sleep(100);win.dispatchEvent(new win.Event('focus'));
  assert.strictEqual(prompts.length,1);
  console.log('UI upgrade OK');process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
