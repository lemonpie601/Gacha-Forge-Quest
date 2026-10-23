/* 퀘스트 v0.13.0 (로컬 수정) — standalone, local-only manual companion; no modification to Gacha Forge saves. */
(() => {
  'use strict';
  if (globalThis.__gfQuestExtension01) return;
  globalThis.__gfQuestExtension01 = true;
  const ID = 'gfq-01';
  const STORE = 'gf-quest-v1';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const uid = () => 'q'+Date.now().toString(36)+Math.random().toString(36).slice(2,8);
  const blank = () => ({quests:[], fields:[], items:[], history:[]});
  const initial = () => ({v:1,world:'',worlds:{}});
  // v0.12.0: the browser's own alert/confirm/prompt always end fullscreen. These in-page dialogs use
  // showModal, which stays usable above the fullscreen game. confirm/prompt resolve asynchronously.
  const gfqDialogs=new Set();
  function gfqAsk(kind,message,def=''){
    if(globalThis.__gfqNativeDialogs)return Promise.resolve(kind==='confirm'?globalThis.confirm(message):kind==='prompt'?globalThis.prompt(message,def):globalThis.alert(message));
    return new Promise(resolve=>{
      if(!document.body)return resolve(kind==='confirm'?false:null);
      const d=document.createElement('dialog');d.className=ID+'-ask';
      const text=String(message??''),val=String(def??''),long=kind==='prompt'&&(val.length>80||val.includes('\n'));
      d.innerHTML='<form method="dialog"><p class="gfq-ask-msg"></p>'+(kind==='prompt'?(long?'<textarea rows="8"></textarea>':'<input type="text">'):'')+
        '<div class="gfq-ask-row">'+(kind==='alert'?'':'<button type="button" value="no">취소</button>')+'<button type="submit" value="ok">확인</button></div></form>';
      d.querySelector('.gfq-ask-msg').textContent=text;
      const field=d.querySelector('input,textarea');if(field)field.value=val;
      let done=false;
      const finish=ok=>{if(done)return;done=true;gfqDialogs.delete(d);try{d.close();}catch{}d.remove();resolve(kind==='confirm'?ok:kind==='prompt'?(ok?field.value:null):undefined);};
      d.querySelector('form').addEventListener('submit',e=>{e.preventDefault();finish(true);});
      d.querySelector('button[value=no]')?.addEventListener('click',()=>finish(false));
      d.addEventListener('cancel',e=>{e.preventDefault();finish(kind==='alert');});
      // Clicks inside the dialog must not reach the game or the panel behind it.
      for(const t of ['pointerdown','click'])d.addEventListener(t,e=>e.stopPropagation());
      document.body.append(d);gfqDialogs.add(d);
      try{d.showModal();}catch{d.setAttribute('open','');}
      (field||d.querySelector('button[type=submit]')).focus();if(field&&!long)field.select();
    });
  }
  const alert=message=>{gfqAsk('alert',message);};
  const gfqConfirm=message=>gfqAsk('confirm',message);
  const gfqPrompt=(message,def='')=>gfqAsk('prompt',message,def);
  let data;
  try { data=JSON.parse(localStorage.getItem(STORE)||'null') || initial(); } catch {data=initial();}
  if(!data || data.v!==1 || !data.worlds || typeof data.worlds!=='object') data=initial();
  // v0.12.0: achievements were removed; their stored record is dropped (written with the next real change).
  const gfqDropRemoved=d=>{for(const w of Object.values(d?.worlds||{}))if(w&&typeof w==='object')delete w.gfAch;return d;};
  gfqDropRemoved(data);
  // Keep only two bounded local snapshots, stored outside the main save to avoid recursive growth.
  const GFQ_AUTO_BACKUP_KEY='gf-quest-snapshots-v1';
  let gfqSnapAt=-1; // v0.10.1: remembered in memory so ordinary saves do not re-read up to 1.7MB of snapshots
  function gfqAutoSnapshot(){
    if(gfqSnapAt>0&&Date.now()-gfqSnapAt<20*60*1000)return;
    try{
      if(gfqSnapAt<0){gfqSnapAt=0;try{const l=JSON.parse(localStorage.getItem(GFQ_AUTO_BACKUP_KEY)||'[]');if(Array.isArray(l)&&l[0]?.at)gfqSnapAt=l[0].at;}catch{}if(gfqSnapAt&&Date.now()-gfqSnapAt<20*60*1000)return;}
      gfqSnapAt=Date.now();
      const prior=localStorage.getItem(STORE);
      if(!prior||prior.length>850000)return;
      const list=JSON.parse(localStorage.getItem(GFQ_AUTO_BACKUP_KEY)||'[]');
      if(!Array.isArray(list))return;
      if(list.length&&Date.now()-list[0].at<20*60*1000)return;
      const snaps=JSON.stringify([{at:Date.now(),json:prior},...list].slice(0,2));localStorage.setItem(GFQ_AUTO_BACKUP_KEY,snaps);gfqSnapBytes=snaps.length;
    }catch(e){/* Quota-limited storage: never block the user's primary save. */}
  }
  async function gfqRestoreSnapshots(){
    let list=[];
    try{list=JSON.parse(localStorage.getItem(GFQ_AUTO_BACKUP_KEY)||'[]');}catch{}
    if(!Array.isArray(list)||!list.length)return alert('복원할 자동 백업이 없습니다. 저장 공간이 부족하거나 데이터가 큰 경우 자동 보관이 제한됩니다.');
    const picked=(await gfqPrompt('복원할 백업 번호를 입력해 주세요.\n'+list.map((v,i)=>(i+1)+'. '+new Date(v.at).toLocaleString('ko-KR')).join('\n'),'1'));
    if(picked===null)return;
    const n=Number(picked);if(!Number.isSafeInteger(n)||n<1||n>list.length)return alert('백업 번호를 확인해 주세요.');
    let restored;try{restored=JSON.parse(list[n-1].json);}catch{return alert('백업 데이터가 올바르지 않습니다.');}
    if(restored?.v!==1||!restored.worlds||typeof restored.worlds!=='object')return alert('지원하지 않는 백업 형식입니다.');
    if(!(await gfqConfirm('선택한 시점의 전체 월드 기록으로 복원하시겠습니까? 현재 기록은 바뀌므로 먼저 JSON 내보내기를 권합니다.')))return;
    const previous=data;data=restored;
    if(!save()){data=previous;return;}
    render();alert('저장 기록을 복원했습니다. 로어북 반영 상태는 다시 확인해 주세요.');
  }
  let gfqSnapBytes=-1;function gfqSnapLen(){if(gfqSnapBytes<0){try{gfqSnapBytes=(localStorage.getItem(GFQ_AUTO_BACKUP_KEY)||'').length;}catch{gfqSnapBytes=0;}}return gfqSnapBytes;}
  // v0.12.0: while a game reply is being absorbed, saves and renders are held and done once at the end.
  let gfqHold=0,gfqHeldSave=false,gfqHeldRender=false;
  function gfqHolding(fn){gfqHold++;try{return fn();}finally{if(!--gfqHold){if(gfqHeldSave){gfqHeldSave=false;save();}if(gfqHeldRender){gfqHeldRender=false;render();}}}}
  // v0.12.0: a world's edit time (gfUpd) and the "needs upload" mark change only when the saved content really
  // changed. Re-saving the same records (world switch, game replies with nothing new) used to make a stale copy
  // look newest, so merging two devices kept the old one. gfqSaveSigs holds each world's last saved JSON.
  let gfqSaveSigs=null,gfqSaveTop=null;
  function gfqSaveJson(bump){
    const parts=[],sigs=new Map(),t=Date.now();let changed=false;
    for(const [k,w] of Object.entries(data.worlds)){
      let s=JSON.stringify(w);const prev=gfqSaveSigs?.get(k);
      if(bump&&prev!==s){changed=true;if(w&&typeof w==='object'){w.gfUpd=t;s=JSON.stringify(w);}}
      sigs.set(k,s);parts.push(JSON.stringify(k)+':'+s);
    }
    if(bump&&gfqSaveSigs&&[...gfqSaveSigs.keys()].some(k=>!sigs.has(k)))changed=true;
    const top=JSON.stringify({...data,worlds:undefined,world:undefined});if(bump&&top!==gfqSaveTop)changed=true;
    gfqSaveSigs=sigs;gfqSaveTop=top;
    const head=JSON.stringify({...data,worlds:undefined});
    return {json:(head==='{}'?'{':head.slice(0,-1)+',')+'"worlds":{'+parts.join(',')+'}}',changed};
  }
  // Takes the current records as already saved (start-up, after a sync pull) without marking anything edited.
  function gfqSaveBaseline(){try{gfqSaveJson(false);}catch{}}
  const save=()=>{if(gfqHold){gfqHeldSave=true;return true;}try{gfqAutoSnapshot();if(!gfqSaveSigs)gfqSaveBaseline();const {json,changed}=gfqSaveJson(true);try{localStorage.setItem(STORE,json);}catch(q){/* v0.10.1: snapshots must never cost the real save */localStorage.removeItem(GFQ_AUTO_BACKUP_KEY);gfqSnapBytes=0;localStorage.setItem(STORE,json);}gfqStorageWarn(json.length+gfqSnapLen());gfqInjectSchedule();if(changed)gfqSyncSchedule();return true;}catch(e){alert('저장하지 못했습니다: '+e.message);return false;}};

  // v0.11.0: cross-device sync through Marinara's private extension storage (server side, 1,000,000 bytes per extension).
  // localStorage stays the fast local copy; the server copy is gzip+base64 and is pushed a few seconds after edits.
  // Pull happens at start-up, when the page becomes visible and when the panel opens. No polling timer.
  var GFQ_SYNC_KEY='gf-quest-sync-v1',GFQ_SYNC_BACKUP='gf-quest-sync-backup-v1',GFQ_SYNC_MAX=900000;
  var gfqSyncT=0,gfqSyncBusy=false,gfqSyncEdits=0,gfqSyncPulledAt=0,gfqSyncLastPush=0,gfqSyncNote='';
  function gfqSyncHost(){try{const m=typeof marinara==='object'&&marinara?marinara:globalThis.marinara;return m&&m.storage&&typeof m.storage.get==='function'&&typeof m.storage.patch==='function'?m:null;}catch{return null;}}
  function gfqSyncMeta(){try{const m=JSON.parse(localStorage.getItem(GFQ_SYNC_KEY)||'{}');return m&&typeof m==='object'?m:{};}catch{return {};}}
  function gfqSyncSetMeta(patch){const m={...gfqSyncMeta(),...patch};try{localStorage.setItem(GFQ_SYNC_KEY,JSON.stringify(m));}catch{}return m;}
  function gfqSyncSchedule(){
    if(!gfqSyncHost())return;gfqSyncEdits++;
    const m=gfqSyncMeta();if(!m.dirty)gfqSyncSetMeta({dirty:true});if(m.off)return;
    if(gfqSyncT)clearTimeout(gfqSyncT);
    const wait=Math.max(6000,20000-(Date.now()-gfqSyncLastPush));
    gfqSyncT=setTimeout(()=>{gfqSyncT=0;gfqSyncPush();},wait);
  }
  async function gfqGzip(str){
    if(typeof CompressionStream!=='function')return null;
    const buf=new Uint8Array(await new Response(new Blob([str]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
    let bin='';for(let i=0;i<buf.length;i+=0x8000)bin+=String.fromCharCode.apply(null,buf.subarray(i,i+0x8000));return btoa(bin);
  }
  async function gfqGunzip(b64){
    const bin=atob(b64),u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);
    return await new Response(new Blob([u]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
  }
  async function gfqSyncDecode(rec){
    if(!rec||rec.v!==1||typeof rec.data!=='string')return null;
    const json=rec.enc==='gzip-b64'?await gfqGunzip(rec.data):rec.data;
    const d=JSON.parse(json);return d&&d.v===1&&d.worlds&&typeof d.worlds==='object'&&!Array.isArray(d.worlds)?gfqDropRemoved(d):null;
  }
  async function gfqSyncPush(force){
    const host=gfqSyncHost();if(!host||gfqSyncBusy)return false;
    const m=gfqSyncMeta();if(m.off||(!m.dirty&&!force))return false;
    gfqSyncBusy=true;const edits=gfqSyncEdits;
    try{
      // Before overwriting, make sure nobody else pushed since our last sync (one read per push; pushes are at least 20s apart).
      const cur=(await host.storage.get())?.gfq;
      if(cur&&cur.rev&&cur.rev!==m.base){gfqSyncBusy=false;await gfqSyncPull('push',cur);return false;}
      const json=JSON.stringify({...data,world:undefined});
      let enc='gzip-b64',body=await gfqGzip(json);if(body===null){enc='json';body=json;}
      if(body.length>GFQ_SYNC_MAX){gfqSyncSetMeta({err:'too-big',size:body.length});gfqSyncNote='기록이 서버 저장 한도(약 1MB)를 넘어 다른 기기로 보내지 못했습니다. 설정 탭에서 저장 공간을 정리해 주세요.';
        if(!m.warnedBig){gfqSyncSetMeta({warnedBig:true});try{gfqToast('동기화 보류',gfqSyncNote,'warn');}catch{}}return false;}
      const rev=Date.now().toString(36)+Math.random().toString(36).slice(2,7);
      await host.storage.patch({gfq:{v:1,rev,at:Date.now(),enc,data:body}});
      gfqSyncLastPush=Date.now();
      gfqSyncSetMeta({base:rev,dirty:gfqSyncEdits!==edits,at:gfqSyncLastPush,size:body.length,err:'',warnedBig:false});gfqSyncNote='';
      if(gfqSyncEdits!==edits)gfqSyncSchedule();
      if(panel&&currentTab==='settings')render();
      return true;
    }catch(e){gfqSyncSetMeta({err:String(e?.message||e).slice(0,120)});return false;}
    finally{gfqSyncBusy=false;}
  }
  // Same world on two devices = same game run id (names can differ before the game reports them).
  function gfqSyncMerge(local,remote,firstSync){
    const idOf=(k,w)=>w?.gfRunId?'run:'+w.gfRunId:'key:'+k,size=w=>(w?.history?.length||0)+(w?.quests?.length||0)+(w?.gfLedger?.length||0)+(w?.items?.length||0);
    const out={},taken=new Set(),kept=[];
    const remoteBy=new Map(Object.entries(remote.worlds).map(([k,w])=>[idOf(k,w),[k,w]]));
    for(const [rid,[rk,rw]] of remoteBy){
      const lk=Object.keys(local.worlds).find(k=>idOf(k,local.worlds[k])===rid),lw=lk&&local.worlds[lk];
      if(!lw){out[rk]=rw;continue;}
      taken.add(lk);
      const useLocal=firstSync?size(lw)>size(rw):(lw.gfUpd||0)>(rw.gfUpd||0);
      out[rk]=useLocal?lw:rw;if(useLocal)kept.push(rk);
    }
    for(const [lk,lw] of Object.entries(local.worlds))if(!taken.has(lk)){let k=lk;if(out[k])k=lk+' (이 기기)';out[k]=lw;kept.push(k);}
    return {worlds:out,kept};
  }
  // v0.12.0: game replies wait for a pull in progress (and for the first one after start-up), so a stale copy on
  // this device is replaced by the server copy before new story data is added to it.
  let gfqSyncStartDone=null,gfqSyncWait=gfqSyncHost()&&!gfqSyncMeta().off?new Promise(r=>{gfqSyncStartDone=r;setTimeout(r,8000);}):null;
  function gfqSyncPull(reason,known){const p=gfqSyncPullRun(reason,known);gfqSyncWait=p.catch(()=>{});return p;}
  async function gfqSyncPullRun(reason,known){
    const host=gfqSyncHost();if(!host||gfqSyncBusy)return;
    const m=gfqSyncMeta();if(m.off)return;
    if(!known&&reason!=='manual'&&Date.now()-gfqSyncPulledAt<20000)return;
    gfqSyncBusy=true;gfqSyncPulledAt=Date.now();
    try{
      const rec=known||(await host.storage.get())?.gfq;
      if(!rec){if(Object.keys(data.worlds).length){gfqSyncSetMeta({dirty:true});gfqSyncBusy=false;await gfqSyncPush(true);}return;}
      if(rec.rev===m.base){if(m.dirty){gfqSyncBusy=false;gfqSyncSchedule();}return;}
      const remote=await gfqSyncDecode(rec);if(!remote)throw Error('서버 기록 형식을 읽지 못했습니다.');
      const localEmpty=!Object.values(data.worlds).some(w=>(w.history?.length||0)+(w.quests?.length||0)>0);
      const keepWorld=w=>w&&remote.worlds[w]?w:Object.keys(remote.worlds).find(k=>remote.worlds[k]?.gfRunId&&remote.worlds[k].gfRunId===data.worlds[w]?.gfRunId)||remote.world||Object.keys(remote.worlds)[0]||'';
      if(localEmpty||(!m.dirty&&m.base)){
        // Nothing new here: take the other device's copy as it is.
        const world=keepWorld(data.world);data={...remote,world};
        try{localStorage.setItem(STORE,JSON.stringify(data));}catch{}gfqSaveBaseline();
        gfqSyncSetMeta({base:rec.rev,dirty:false,err:''});
      }else{
        // Both sides changed: keep a copy of this device's records, then merge world by world.
        try{localStorage.setItem(GFQ_SYNC_BACKUP,JSON.stringify({at:Date.now(),json:JSON.stringify(data)}));}catch{}
        const r=gfqSyncMerge(data,remote,!m.base);
        const world=keepWorld(data.world);data={...remote,...data,worlds:r.worlds};data.world=r.worlds[world]?world:(r.worlds[data.world]?data.world:Object.keys(r.worlds)[0]||'');
        try{localStorage.setItem(STORE,JSON.stringify(data));}catch{}gfqSaveBaseline();
        gfqSyncSetMeta({base:rec.rev,dirty:true,err:''});
        try{gfqToast('다른 기기 기록과 합쳤습니다',r.kept.length?'이 기기 쪽이 더 최신인 월드: '+r.kept.slice(0,3).join(', ')+(r.kept.length>3?' 외 '+(r.kept.length-3)+'개':''):'다른 기기의 기록을 불러왔습니다. 합치기 전 기록은 설정 탭에서 되돌릴 수 있습니다.','info');}catch{}
        gfqSyncBusy=false;gfqSyncSchedule();
      }
      if(panel)render();
    }catch(e){gfqSyncSetMeta({err:String(e?.message||e).slice(0,120)});}
    finally{gfqSyncBusy=false;}
  }
  function gfqSyncHtml(){
    if(!gfqSyncHost())return '<div class="gfq-card"><b>다른 기기와 동기화</b><p class="gfq-muted">이 마리나라 버전에서는 확장 서버 저장소를 찾지 못해 동기화할 수 없습니다. 기록은 이 브라우저에만 저장됩니다. 백업 내보내기·가져오기로 옮겨 주세요.</p></div>';
    const m=gfqSyncMeta(),t=m.at?new Date(m.at).toLocaleString('ko-KR'):'아직 없음',pct=m.size?Math.min(100,Math.round(m.size/1e6*100)):0;
    const state=m.off?'꺼짐':m.err==='too-big'?'보류(용량 초과)':m.err?'오류':m.dirty?'올릴 변경 있음':'최신';
    return '<div class="gfq-card"><b>다른 기기와 동기화</b><p class="gfq-muted">기록을 마리나라 서버의 확장 전용 저장소에도 보관해, 같은 서버에 접속한 다른 기기·브라우저에서 이어서 볼 수 있습니다. 편집 몇 초 뒤 올리고, 확장을 켤 때와 화면으로 돌아올 때 받아 옵니다.</p>'+
      '<p>상태: <b>'+esc(state)+'</b> · 마지막으로 올린 시각 '+esc(t)+(m.size?' · 서버 사용량 '+pct+'% (1MB 중)':'')+'</p>'+
      (m.err&&m.err!=='too-big'?'<p class="gfq-muted">최근 오류: '+esc(m.err)+'</p>':'')+(gfqSyncNote?'<p class="gfq-muted">'+esc(gfqSyncNote)+'</p>':'')+
      '<div class="gfq-row">'+btn('지금 동기화','sync-now',m.off?'disabled':'')+btn(m.off?'동기화 켜기':'이 기기 동기화 끄기','sync-toggle')+(localStorage.getItem(GFQ_SYNC_BACKUP)?btn('합치기 전 기록으로 되돌리기','sync-undo'):'')+'</div>'+
      '<p class="gfq-muted">두 기기에서 같은 월드를 동시에 고치면 더 늦게 고친 쪽이 남습니다. 합치기 직전 이 기기의 기록은 따로 보관됩니다.</p></div>';
  }
  const now=()=>new Date().toLocaleString('ko-KR');
  const current=()=>{if(!data.world || !data.worlds[data.world]) return null;return data.worlds[data.world];};
  let root, panel, currentTab='quests', activeFilter='전체';
  const style=document.createElement('style');style.id=ID+'-style';
  style.textContent=`
#${ID}-launcher{position:fixed;right:16px;bottom:82px;z-index:2147483000;background:#243448;color:#fff;border:1px solid #6b7f99;border-radius:999px;padding:11px 16px;font:600 13px system-ui;box-shadow:0 5px 18px #0005;cursor:pointer}
#${ID}-panel{margin:0 12px 0 auto;position:fixed;right:12px;top:50%;transform:translateY(-50%);width:min(410px,calc(100vw - 24px));max-height:min(88dvh,760px);overflow:auto;overscroll-behavior:contain;background:var(--gfq-bg,#fafafc);color:var(--gfq-fg,#222);border:1px solid #8992a555;border-radius:18px;z-index:2147483001;box-shadow:0 16px 45px #0007;font:14px/1.5 system-ui,sans-serif;padding:17px;box-sizing:border-box}
#${ID}-panel::backdrop{background:rgba(0,0,0,.45)}#${ID}-panel *{box-sizing:border-box}#${ID}-panel h2{font-size:19px;margin:0}#${ID}-panel h3{font-size:15px;margin:12px 0 8px}#${ID}-panel button,#${ID}-panel select,#${ID}-panel input,#${ID}-panel textarea{font:inherit;border-radius:9px;border:1px solid #8992a580;padding:7px;color:inherit;background:transparent;max-width:100%}#${ID}-panel button{cursor:pointer}#${ID}-panel button.primary{background:#476a96;color:white;border-color:#476a96}#${ID}-panel button:disabled{opacity:.5;cursor:default}#${ID}-panel input,#${ID}-panel textarea{width:100%}#${ID}-panel .gfq-tabs,#${ID}-panel .gfq-row{display:flex;gap:6px;flex-wrap:wrap;align-items:center}#${ID}-panel .gfq-tabs{margin:12px 0}#${ID}-panel .gfq-card{border:1px solid #8992a550;border-radius:12px;padding:11px;margin:8px 0;overflow-wrap:anywhere}#${ID}-panel .gfq-muted{font-size:12px;opacity:.7}#${ID}-panel .gfq-fill{flex:1;min-width:0}#${ID}-panel label{display:block;font-size:12px;margin-top:7px;opacity:.8}#${ID}-panel .gfq-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}#${ID}-panel progress{width:100%;height:8px}#${ID}-panel textarea{min-height:60px;resize:vertical}#${ID}-panel .gfq-danger{color:#bc4545}#${ID}-panel [hidden]{display:none!important}
@media(prefers-color-scheme:dark){#${ID}-panel{--gfq-bg:#20262f;--gfq-fg:#f1f4f8}}@media(max-width:600px){#${ID}-panel{inset:8px;width:auto;max-height:calc(100dvh - 16px);transform:none;margin:auto}#${ID}-launcher{bottom:18px}}
`;

  /* v0.6.0 case-file layout (paper, indigo, ticket and receipt shapes): scoped to the panel; toasts keep their own style */
  style.textContent += `
#gfq-01-panel{--paper:#d7d4cd;--paper2:#e4e1db;--card:#f1efea;--ink:#202229;--sub:#67655f;--line:#b1aca2;--ind:#3b3f7a;--ind2:#4c5196;--indd:#262950;--mark:#f0c02f;--card2:#fbfaf7;--hi:#ffffff;--onacc:#c9cbe0;--board:#e9e6df;--hatch1:#c9c5bd;--hatch2:#d8d5cf;--red:#a9433a;--grn:#3b7556;
--sans:"Pretendard","Noto Sans KR",system-ui,sans-serif;--cond:"Bahnschrift SemiCondensed","Bahnschrift","Roboto Condensed","Arial Narrow","Pretendard","Noto Sans KR",sans-serif;--serif:"Noto Serif KR","Nanum Myeongjo","AppleMyungjo","Batang",serif;
position:fixed;inset:0;margin:auto;transform:none;width:min(1180px,calc(100vw - 32px));height:min(820px,calc(100dvh - 32px));max-height:none;padding:0;overflow:hidden;border:0;border-radius:0;color:var(--ink);background:var(--paper);box-shadow:0 30px 90px #000b;font:14px/1.55 var(--sans)}
#gfq-01-panel::backdrop{background:#0d0f1ccc;backdrop-filter:blur(3px)}
#gfq-01-panel .gfq-num{font-family:var(--cond);font-variant-numeric:tabular-nums}
#gfq-01-panel .gfq-sub,#gfq-01-panel .gfq-muted{font-size:12px;color:var(--sub);opacity:1}
#gfq-01-panel .gfq-frame{height:100%;display:grid;grid-template-columns:212px minmax(0,1fr)}
#gfq-01-panel .gfq-side{position:relative;display:flex;flex-direction:column;min-height:0;padding:22px 0 18px;background:
 linear-gradient(158deg,var(--ind) 0 40%,transparent 40.2%),
 repeating-radial-gradient(circle at 34% 88%,transparent 0 34px,#3b3f7a16 35px 36px,transparent 37px 60px),
 linear-gradient(#0000000d 1px,transparent 1px) 0 0/100% 26px,var(--paper2);border-right:1px solid var(--line)}
#gfq-01-panel .gfq-brand{display:grid;grid-template-columns:auto 1fr;align-items:center;column-gap:10px;padding:0 20px 26px;color:#fff}
#gfq-01-panel .gfq-brand-mark{grid-row:span 2;width:30px;height:30px;border:2px solid #fff;transform:rotate(45deg) scale(.8);box-shadow:inset 0 0 0 4px var(--ind),inset 0 0 0 7px #fff}
#gfq-01-panel .gfq-brand h2{margin:0;font:700 26px/1 var(--cond);letter-spacing:.04em}
#gfq-01-panel .gfq-brand small{font-size:11px;color:var(--onacc);letter-spacing:.06em}
#gfq-01-panel .gfq-tabs{display:flex;flex-direction:column;align-items:stretch;gap:12px;padding:0 0 0 14px;margin:0}
#gfq-01-panel .gfq-tabs button{display:flex;align-items:center;gap:0;padding:0;border:0;background:none;color:var(--ind);cursor:pointer;text-align:left}
#gfq-01-panel .gfq-tab-ic{position:relative;z-index:1;display:grid;place-items:center;flex:none;width:44px;height:44px;background:var(--card);border:1.5px solid var(--ind);box-shadow:2px 2px 0 #0000001f}
#gfq-01-panel .gfq-tab-ic svg{width:22px;height:22px}
#gfq-01-panel .gfq-tab-l{flex:1;margin-left:-6px;padding:9px 26px 9px 18px;background:var(--card);border:1.5px solid #c9c5bc;border-left:0;font:700 16px/1.1 var(--cond);letter-spacing:.06em;text-decoration:underline;text-decoration-thickness:1.5px;text-underline-offset:5px;clip-path:polygon(0 0,calc(100% - 18px) 0,100% 50%,calc(100% - 18px) 100%,0 100%)}
#gfq-01-panel .gfq-tabs button:hover .gfq-tab-l{background:var(--hi)}
#gfq-01-panel .gfq-tabs button.primary .gfq-tab-ic{background:var(--ind);color:#fff;border-color:#fff;transform:rotate(-7deg);box-shadow:3px 3px 0 #00000033}
#gfq-01-panel .gfq-tabs button.primary .gfq-tab-l{background:var(--ind);color:#fff;border-color:var(--ind);text-decoration:none}
#gfq-01-panel .gfq-tabs button:focus-visible{outline:none}#gfq-01-panel .gfq-tabs button:focus-visible .gfq-tab-l{outline:2px solid var(--mark);outline-offset:-4px}
#gfq-01-panel .gfq-side-foot{margin:auto 16px 0;padding:10px 12px;display:flex;flex-direction:column;background:var(--card);border:1.5px solid var(--ink);box-shadow:3px 3px 0 #0000001f;font-size:11px;color:var(--sub)}
#gfq-01-panel .gfq-side-foot b{font-size:22px;line-height:1.15;color:var(--ink)}
#gfq-01-panel .gfq-side-foot small{margin-top:8px;padding-top:6px;border-top:1px dashed var(--line);font-size:10px}
#gfq-01-panel .gfq-main{min-width:0;min-height:0;overflow-y:auto;overscroll-behavior:contain;padding:0 30px 34px;background:linear-gradient(#20222909 1px,transparent 1px) 0 0/28px 28px,linear-gradient(90deg,#20222909 1px,transparent 1px) 0 0/28px 28px,var(--paper)}
#gfq-01-panel .gfq-top{position:sticky;top:0;z-index:5;display:flex;align-items:center;gap:14px;margin:0 -30px 20px;padding:16px 30px 12px;background:var(--paper);border-bottom:4px double var(--ind)}
#gfq-01-panel .gfq-top h2{margin:0;font:700 30px/1 var(--cond);color:var(--ind);letter-spacing:.04em;white-space:nowrap}
#gfq-01-panel .gfq-worldbar{flex:1;min-width:0;margin:0}
#gfq-01-panel .gfq-worldbar .gfq-row{flex-wrap:nowrap}
#gfq-01-panel #gfq-world{flex:1;min-width:0;max-width:340px;margin-left:auto}
#gfq-01-panel .gfq-close{width:38px;height:38px;padding:0;font-size:16px}
#gfq-01-panel button,#gfq-01-panel select,#gfq-01-panel input,#gfq-01-panel textarea{border-radius:0;border:1.5px solid var(--ink);background:var(--card);color:var(--ink);font-family:var(--sans)}
#gfq-01-panel button{font-weight:700;padding:6px 12px;cursor:pointer}
#gfq-01-panel button:hover:not(:disabled):not(.on):not([aria-pressed=true]):not(.primary){background:var(--hi)}
#gfq-01-panel button:disabled{opacity:.45;cursor:default}
#gfq-01-panel button:focus-visible,#gfq-01-panel select:focus-visible,#gfq-01-panel input:focus-visible,#gfq-01-panel summary:focus-visible{outline:2px solid var(--ind2);outline-offset:2px}
#gfq-01-panel button.primary{background:var(--ind);border-color:var(--ind);color:#fff}
#gfq-01-panel button.primary:hover:not(:disabled){background:var(--ind2);border-color:var(--ind2)}
#gfq-01-panel button.gfq-danger{color:var(--red);border-color:var(--red)}
#gfq-01-panel h3{font:700 19px/1.2 var(--cond);letter-spacing:.04em;margin:26px 0 10px;color:var(--ind)}
#gfq-01-panel .gfq-card{position:relative;margin:12px 0;padding:14px 18px 14px 22px;background:var(--card);border:1px solid var(--line);border-radius:0;color:var(--ink);box-shadow:3px 3px 0 #00000014}
#gfq-01-panel .gfq-card::before{content:"";position:absolute;left:0;top:0;bottom:0;width:5px;background:var(--ind)}
#gfq-01-panel .gfq-card b{color:var(--ink)}
#gfq-01-panel .gfq-card>.gfq-row:first-child b.gfq-fill{font-size:16px;color:var(--ind)}
#gfq-01-panel .gfq-card button{padding:4px 10px;margin:2px 0;font-size:13px}
#gfq-01-panel .gfq-card button[aria-pressed=true]{background:var(--ind);color:#fff;border-color:var(--ind)}
#gfq-01-panel .gfq-card progress{accent-color:var(--ind);height:6px;margin:8px 0 4px}
#gfq-01-panel details summary{cursor:pointer}
#gfq-01-panel .gfq-empty{margin:14px 0;min-height:180px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;text-align:center;padding:28px;background:var(--card);border:1.5px dashed var(--ind)}
#gfq-01-panel .gfq-empty strong{font:700 18px var(--cond);color:var(--ind)}#gfq-01-panel .gfq-empty-symbol{display:none}
#gfq-01-panel .gfq-ticket{position:relative;display:grid;grid-template-columns:190px minmax(0,1fr) 84px;background:var(--card);border:1.5px solid var(--ink);box-shadow:5px 5px 0 #0000001c}
#gfq-01-panel .gfq-ticket>div{position:relative}
#gfq-01-panel .gfq-tk-main,#gfq-01-panel .gfq-tk-stub{border-left:2px dashed var(--ink)}
#gfq-01-panel .gfq-tk-main::before,#gfq-01-panel .gfq-tk-main::after,#gfq-01-panel .gfq-tk-stub::before,#gfq-01-panel .gfq-tk-stub::after{content:"";position:absolute;left:-12px;width:22px;height:22px;border-radius:50%;background:var(--paper);border:1.5px solid var(--ink)}
#gfq-01-panel .gfq-tk-main::before,#gfq-01-panel .gfq-tk-stub::before{top:-13px;clip-path:inset(50% 0 0 0)}
#gfq-01-panel .gfq-tk-main::after,#gfq-01-panel .gfq-tk-stub::after{bottom:-13px;clip-path:inset(0 0 50% 0)}
#gfq-01-panel .gfq-tk-photo{display:flex;flex-direction:column;align-items:center;gap:12px;padding:24px 16px 16px}
#gfq-01-panel .gfq-photo{position:relative;width:138px;height:164px;padding:8px 8px 26px;background:var(--hi);box-shadow:0 3px 10px #00000030;transform:rotate(-3deg)}
#gfq-01-panel .gfq-photo::after{content:"";position:absolute;top:-10px;left:50%;width:64px;height:20px;margin-left:-32px;background:#d8cfb6c0;transform:rotate(4deg)}
#gfq-01-panel .gfq-photo img{width:100%;height:100%;object-fit:cover;display:block;filter:contrast(1.05)}
#gfq-01-panel .gfq-photo span{display:grid;place-items:center;width:100%;height:100%;font:700 64px var(--serif);color:var(--ind);background:radial-gradient(#3b3f7a38 1.2px,transparent 1.6px) 0 0/7px 7px,var(--card2)}
#gfq-01-panel .gfq-tk-photo small{font-size:11px;color:var(--sub);text-align:center}
#gfq-01-panel .gfq-tk-main{padding:18px 26px 18px 30px;min-width:0}
#gfq-01-panel .gfq-tk-top{display:flex;justify-content:space-between;gap:10px;font:700 12px var(--cond);letter-spacing:.06em;color:var(--sub);padding-bottom:6px;border-bottom:1.5px solid var(--ink)}
#gfq-01-panel .gfq-tk-name{margin:12px 0 10px;font:800 42px/1.05 var(--serif);color:var(--ink);letter-spacing:.02em;overflow-wrap:anywhere}
#gfq-01-panel .gfq-tk-rows{display:grid;grid-template-columns:52px minmax(0,1fr);gap:0;margin:0;border-top:1px solid var(--line)}
#gfq-01-panel .gfq-tk-rows dt,#gfq-01-panel .gfq-tk-rows dd{margin:0;padding:8px 0;border-bottom:1px solid var(--line)}
#gfq-01-panel .gfq-tk-rows dt{font:700 13px var(--cond);color:var(--sub);letter-spacing:.05em}
#gfq-01-panel .gfq-tk-rows dd{display:flex;align-items:center;flex-wrap:wrap;gap:6px 8px}
#gfq-01-panel .gfq-tk-rows dd b{font-size:20px;line-height:1}
#gfq-01-panel .gfq-tk-rows dd small{color:var(--sub)}
#gfq-01-panel .gfq-rings{display:flex;flex-wrap:wrap;gap:3px;max-width:330px}
#gfq-01-panel .gfq-rings i{width:15px;height:15px;border-radius:50%;border:1.5px solid var(--ink)}
#gfq-01-panel .gfq-rings i.on{background:var(--ind);border-color:var(--ind);box-shadow:inset 0 0 0 2.5px var(--card)}
#gfq-01-panel .gfq-stamp{display:inline-flex;flex-direction:column;padding:3px 10px;border:2px solid var(--ind);color:var(--ind);font:700 13px/1.25 var(--cond);transform:rotate(-1.5deg);background:#3b3f7a0a}
#gfq-01-panel .gfq-stamp small{font-size:11px;color:var(--ind)!important;opacity:.8}
#gfq-01-panel .gfq-link{padding:0;border:0;background:none;color:var(--ind);font-weight:700;text-decoration:underline;text-underline-offset:3px}
#gfq-01-panel .gfq-link:hover:not(:disabled){background:none;color:var(--ind2)}
#gfq-01-panel .gfq-tk-date{display:flex;flex-direction:column;gap:1px;margin-top:14px}
#gfq-01-panel .gfq-k{font:700 12px var(--cond);color:var(--sub);letter-spacing:.05em}
#gfq-01-panel .gfq-tk-date b{font-size:30px;line-height:1.1;letter-spacing:.02em}
#gfq-01-panel .gfq-tk-date .gfq-row{margin-top:8px;gap:6px}#gfq-01-panel .gfq-tk-date button{font-size:12px;padding:4px 10px}
#gfq-01-panel .gfq-tk-clock{font-size:16px;font-weight:600;letter-spacing:.02em;opacity:.88}
#gfq-01-panel .gfq-tk-stub{display:flex;flex-direction:column;align-items:center;gap:10px;padding:22px 14px;background:var(--ink);color:var(--card)}
#gfq-01-panel .gfq-tk-stub::before,#gfq-01-panel .gfq-tk-stub::after{border-color:var(--ink)}
#gfq-01-panel .gfq-tk-stub .gfq-barcode{flex:1;width:100%;flex-direction:column;height:auto;min-height:120px}
#gfq-01-panel .gfq-barcode{display:flex}#gfq-01-panel .gfq-barcode i{background:var(--card);min-width:1px;min-height:1px}#gfq-01-panel .gfq-barcode i.gap{background:transparent;flex:1}
#gfq-01-panel .gfq-tk-stub span{writing-mode:vertical-rl;font-size:13px;letter-spacing:.2em}
#gfq-01-panel .gfq-items{margin-top:30px}
#gfq-01-panel .gfq-items-head{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:12px}
#gfq-01-panel .gfq-items-head h3{margin:0}#gfq-01-panel .gfq-items-head>button{margin-left:auto;font-size:13px}
#gfq-01-panel .gfq-seg{display:flex;padding:3px;gap:3px;background:var(--card);border:1.5px solid var(--ink);border-radius:999px}
#gfq-01-panel .gfq-seg button{border:0;border-radius:999px;padding:4px 14px;background:none;font:700 13px var(--cond);letter-spacing:.04em}
#gfq-01-panel .gfq-seg button small{color:var(--sub);margin-left:2px}
#gfq-01-panel .gfq-seg button[aria-pressed=true]{background:var(--ind);color:#fff}#gfq-01-panel .gfq-seg button[aria-pressed=true] small{color:var(--onacc)}
#gfq-01-panel .gfq-items-body{display:grid;grid-template-columns:minmax(0,1fr) 330px;gap:18px;align-items:start}
#gfq-01-panel .gfq-slots{display:grid;grid-template-columns:repeat(auto-fill,minmax(118px,1fr));gap:10px}
#gfq-01-panel .gfq-slot{position:relative;aspect-ratio:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:16px 8px 10px;background:linear-gradient(#20222910 1px,transparent 1px) 0 0/100% 14px,var(--card);border:1px solid var(--line);font-weight:600}
#gfq-01-panel .gfq-slot::before{content:"";position:absolute;top:7px;left:50%;width:6px;height:6px;margin-left:-3px;border-radius:50%;background:#77736b}
#gfq-01-panel .gfq-slot:hover:not(:disabled){background:linear-gradient(#20222910 1px,transparent 1px) 0 0/100% 14px,#fff}
#gfq-01-panel .gfq-slot.on .gfq-glyph{color:#fff}#gfq-01-panel .gfq-slot.on .gfq-slot-qty{color:#fff}
#gfq-01-panel .gfq-glyph{font:700 40px/1 var(--serif);color:var(--ind)}
#gfq-01-panel .gfq-glyph.q{font-family:var(--cond);color:#b07d0f}
#gfq-01-panel .gfq-glyph.v{display:inline-flex;align-items:baseline;gap:2px;padding:6px 14px;font:700 13px var(--cond);border:1.5px solid currentColor;-webkit-mask:radial-gradient(circle at 0 50%,#0000 6px,#000 6.5px) left/51% 100% no-repeat,radial-gradient(circle at 100% 50%,#0000 6px,#000 6.5px) right/51% 100% no-repeat}
#gfq-01-panel .gfq-glyph.v b{font-size:24px}
#gfq-01-panel .gfq-slot-name{font-size:12px;line-height:1.3;text-align:center;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
#gfq-01-panel .gfq-slot-qty{position:absolute;right:7px;bottom:5px;font-size:13px;color:var(--sub)}
#gfq-01-panel .gfq-slot.pending{border:1.5px dashed #9a8a63;background:repeating-linear-gradient(135deg,#f1efea 0 7px,#e6e2d7 7px 8px)}
#gfq-01-panel .gfq-slot.used{opacity:.5}
#gfq-01-panel .gfq-slot.on{background:var(--ind);border:3px solid var(--mark);color:#fff;box-shadow:0 0 0 1px var(--ind)}
#gfq-01-panel .gfq-slot.on .gfq-glyph.q{color:var(--mark)}
#gfq-01-panel .gfq-dossier{background:var(--card);border:1px solid var(--line);border-top:4px double var(--ind);box-shadow:4px 4px 0 #00000017;padding:0 0 16px}
#gfq-01-panel .gfq-dossier.empty{padding:20px;text-align:center}
#gfq-01-panel .gfq-dossier .gfq-hd{display:flex;align-items:center;gap:10px;padding:12px 0 12px 14px;border-bottom:1px solid var(--line)}
#gfq-01-panel .gfq-pin{flex:none;width:14px;height:14px;border-radius:50%;background:var(--ind);box-shadow:0 0 0 3px #3b3f7a33;transform:translateY(-1px)}
#gfq-01-panel .gfq-dossier h4{flex:1;margin:0;font:700 19px/1.25 var(--cond);color:var(--ind);letter-spacing:.03em;overflow-wrap:anywhere}
#gfq-01-panel .gfq-no{align-self:stretch;display:flex;flex-direction:column;justify-content:center;padding:0 14px;border-left:1px solid var(--line);font-size:13px;line-height:1.1;color:var(--sub)}
#gfq-01-panel .gfq-plate{position:relative;display:grid;place-items:center;height:150px;margin:14px;background:repeating-linear-gradient(90deg,var(--hatch1) 0 2px,var(--hatch2) 2px 9px);border:1px solid var(--line);overflow:hidden}
#gfq-01-panel .gfq-plate .gfq-glyph{font-size:72px;color:var(--ind);text-shadow:3px 3px 0 #fff}
#gfq-01-panel .gfq-plate .gfq-glyph.v{font-size:16px;background:var(--card)}
#gfq-01-panel .gfq-plate.photo{height:170px;padding:0}#gfq-01-panel .gfq-plate img{width:100%;height:100%;object-fit:cover;filter:grayscale(.25) contrast(1.05)}
#gfq-01-panel .gfq-plate-tag{position:absolute;right:8px;bottom:8px;padding:2px 10px;background:var(--ind);color:#fff;font:700 12px var(--cond);letter-spacing:.05em}
#gfq-01-panel .gfq-dossier h5{margin:12px 14px 6px;font:700 14px var(--cond);letter-spacing:.06em;color:var(--ink);display:flex;align-items:center;gap:6px}
#gfq-01-panel .gfq-dossier h5::before{content:"";width:12px;height:12px;border:1.5px solid var(--ink);box-shadow:inset 0 0 0 2px var(--card),inset 0 0 0 6px var(--ind)}
#gfq-01-panel .gfq-facts{list-style:none;margin:0 14px;padding:0}
#gfq-01-panel .gfq-facts li{position:relative;padding:3px 0 3px 18px;color:var(--ind);font-weight:600;font-size:13px}
#gfq-01-panel .gfq-facts li::before{content:"";position:absolute;left:2px;top:8px;width:6px;height:11px;background:var(--mark);border:1px solid #9b7a12}
#gfq-01-panel .gfq-quote{margin:12px 14px 0;padding-top:10px;border-top:2px dashed var(--line);font-size:13px;color:var(--sub)}
#gfq-01-panel .gfq-quote mark{background:linear-gradient(transparent 45%,#f0c02fa0 45%);color:var(--ink)}
#gfq-01-panel .gfq-dossier>.gfq-row{margin:14px 14px 0;gap:6px}
#gfq-01-panel .gfq-here{margin:8px 14px 0;padding:6px 10px;background:var(--ind);color:#fff;font-size:12px;font-weight:700}
#gfq-01-panel .gfq-split{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,1fr);gap:24px;align-items:start;margin-top:30px}
#gfq-01-panel .gfq-receipt{position:relative;padding:22px 24px 30px;background:var(--card);border:1px solid var(--line);box-shadow:4px 4px 0 #00000014;margin-bottom:14px}
#gfq-01-panel .gfq-receipt::after{content:"";position:absolute;left:-1px;right:-1px;bottom:-9px;height:18px;background:radial-gradient(circle at 50% 100%,var(--paper) 8px,transparent 8.5px) 0 0/26px 18px repeat-x}
#gfq-01-panel .gfq-receipt h3{margin:0;font:800 30px/1.1 var(--serif);color:var(--ink);text-align:center;letter-spacing:.08em}
#gfq-01-panel .gfq-rc-sub{text-align:center;font-size:13px;color:var(--sub);padding:4px 0 12px;border-bottom:1.5px dashed var(--ink);margin-bottom:6px}
#gfq-01-panel .gfq-rc-row{border-bottom:1px dotted var(--line)}
#gfq-01-panel .gfq-rc-row summary{display:flex;align-items:baseline;gap:8px;padding:10px 0 4px;list-style:none}
#gfq-01-panel .gfq-rc-row summary::-webkit-details-marker{display:none}
#gfq-01-panel .gfq-rc-n{font-size:11px;color:var(--sub)}
#gfq-01-panel .gfq-rc-name{font:700 15px var(--serif);max-width:60%;overflow-wrap:anywhere}
#gfq-01-panel .gfq-rc-dots{flex:1;border-bottom:1.5px dashed var(--ink);transform:translateY(-4px);min-width:16px}
#gfq-01-panel .gfq-rc-row summary b{font-size:17px}
#gfq-01-panel .gfq-rc-meta{font-size:12px;color:var(--sub);padding:0 0 8px 34px}
#gfq-01-panel .gfq-rc-row.s-received .gfq-rc-meta{color:var(--grn)}#gfq-01-panel .gfq-rc-row.s-paid .gfq-rc-meta{color:var(--red)}#gfq-01-panel .gfq-rc-row.s-pending .gfq-rc-meta,#gfq-01-panel .gfq-rc-row.s-receivable .gfq-rc-meta{color:#8a6410}
#gfq-01-panel .gfq-rc-row[open]{padding-bottom:10px}#gfq-01-panel .gfq-rc-row p{margin:2px 0 2px 34px}
#gfq-01-panel .gfq-rc-row .gfq-row{margin:6px 0 0 34px;gap:8px}#gfq-01-panel .gfq-rc-row button{font-size:12px;padding:3px 9px}
#gfq-01-panel .gfq-rc-total{margin:18px 0 10px;padding:10px 14px;background:var(--ink);color:var(--card)}
#gfq-01-panel .gfq-rc-total div{display:flex;justify-content:space-between;gap:10px;padding:2px 0}
#gfq-01-panel .gfq-rc-total span{font-size:13px}#gfq-01-panel .gfq-rc-total span::before{content:"✓ ";color:var(--mark)}
#gfq-01-panel .gfq-rc-total b{font-size:17px}
#gfq-01-panel .gfq-notes{padding:4px 0}
#gfq-01-panel .gfq-field{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.1fr) auto auto;gap:6px;align-items:center;padding:8px 0;border-bottom:1px solid var(--line)}
#gfq-01-panel .gfq-field span{font:700 13px var(--cond);color:var(--sub);letter-spacing:.03em;overflow-wrap:anywhere}
#gfq-01-panel .gfq-field b{overflow-wrap:anywhere;font-size:13px}#gfq-01-panel .gfq-field button{padding:3px 8px;font-size:12px}
#gfq-01-panel .gfq-board{position:relative;min-height:320px;background:
 repeating-radial-gradient(circle at 62% 46%,transparent 0 58px,#3b3f7a1f 59px 60px,transparent 61px 118px),
 linear-gradient(#2022290f 1px,transparent 1px) 0 0/40px 40px,linear-gradient(90deg,#2022290f 1px,transparent 1px) 0 0/40px 40px,var(--board);border:1.5px solid var(--ink);box-shadow:5px 5px 0 #0000001a;overflow:hidden}
#gfq-01-panel .gfq-board::before,#gfq-01-panel .gfq-board::after{content:"";position:absolute;width:18px;height:18px;border:2px solid var(--ind);pointer-events:none}
#gfq-01-panel .gfq-board::before{left:8px;top:8px;border-right:0;border-bottom:0}#gfq-01-panel .gfq-board::after{right:8px;bottom:8px;border-left:0;border-top:0}
#gfq-01-panel .gfq-route{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
#gfq-01-panel .gfq-route polyline{fill:none;stroke:var(--ind);stroke-width:1.5;vector-effect:non-scaling-stroke;stroke-dasharray:6 4}
#gfq-01-panel .gfq-pinbox{position:absolute;z-index:1;display:flex;align-items:center;gap:8px;max-width:190px;padding:0;border:0;background:none;transform:translateX(-22px);text-align:left}
#gfq-01-panel .gfq-pinbox:hover:not(:disabled){background:none}
#gfq-01-panel .gfq-pinbox img{flex:none;width:44px;height:44px;border-radius:50%;object-fit:cover;border:3px solid #fff;box-shadow:0 2px 6px #0004;background:var(--hi)}
#gfq-01-panel .gfq-pin-dot{flex:none;width:44px;height:44px;border-radius:50%;background:radial-gradient(circle,var(--ind) 0 7px,#fff 7.5px 11px,var(--ind) 11.5px 13px,transparent 13.5px),#ffffffb0;border:1.5px solid var(--ind)}
#gfq-01-panel .gfq-pin-text{display:flex;text-align:left;flex-direction:column;padding:6px 12px;background:var(--hi);border:1px solid var(--line);box-shadow:2px 2px 0 #0000001a;min-width:0}
#gfq-01-panel .gfq-pin-text b{font:700 14px/1.25 var(--cond);color:var(--ind);letter-spacing:.02em;overflow-wrap:anywhere}
#gfq-01-panel .gfq-pin-text small{font-size:11px;color:var(--sub);white-space:nowrap}
#gfq-01-panel .gfq-pin-text em{font-style:normal;margin-left:4px;padding:0 6px;background:var(--mark);color:var(--ink);border-radius:999px;font-weight:700}
#gfq-01-panel .gfq-pinbox.on .gfq-pin-text{background:var(--ind);border-color:var(--ind)}#gfq-01-panel .gfq-pinbox.on .gfq-pin-text b,#gfq-01-panel .gfq-pinbox.on .gfq-pin-text small{color:#fff}
#gfq-01-panel .gfq-halo{position:absolute;left:-38px;top:50%;width:120px;height:120px;margin-top:-60px;border-radius:50%;background:radial-gradient(#3b3f7a40 1px,transparent 1.5px) 0 0/6px 6px,#4c519633;border:1.5px solid #4c5196aa;z-index:-1}
#gfq-01-panel .gfq-board-foot{margin-top:12px;gap:10px}
@media(max-width:760px),(max-height:500px) and (orientation:landscape) and (pointer:coarse){#gfq-01-panel{inset:0;width:100vw;height:100dvh}
#gfq-01-panel .gfq-frame{grid-template-columns:1fr;grid-template-rows:auto minmax(0,1fr)}
#gfq-01-panel .gfq-side{flex-direction:row;align-items:center;padding:8px 8px 8px 12px;background:var(--ind);border:0;gap:8px}
#gfq-01-panel .gfq-brand{padding:0;grid-template-columns:auto}#gfq-01-panel .gfq-brand h2,#gfq-01-panel .gfq-brand small{display:none}
#gfq-01-panel .gfq-tabs{flex-direction:row;flex:1;gap:4px;padding:0;overflow-x:auto}
#gfq-01-panel .gfq-tabs button{flex:1;flex-direction:column;gap:2px;min-width:52px;color:var(--onacc)}
#gfq-01-panel .gfq-tab-ic{width:30px;height:30px;background:none;border:0;box-shadow:none}#gfq-01-panel .gfq-tab-ic svg{width:20px;height:20px}
#gfq-01-panel .gfq-tab-l{margin:0;padding:0;background:none;border:0;clip-path:none;font-size:12px;text-decoration:none}
#gfq-01-panel .gfq-tabs button.primary .gfq-tab-ic{background:var(--hi);color:var(--ind);transform:none}#gfq-01-panel .gfq-tabs button.primary .gfq-tab-l{background:none;color:#fff}
#gfq-01-panel .gfq-side-foot{display:none}
#gfq-01-panel .gfq-main{padding:0 14px 28px}#gfq-01-panel .gfq-top{margin:0 -14px 14px;padding:10px 14px;flex-wrap:wrap}#gfq-01-panel .gfq-top h2{font-size:24px}#gfq-01-panel .gfq-worldbar{order:3;flex-basis:100%}#gfq-01-panel #gfq-world{max-width:none;margin:0}#gfq-01-panel .gfq-close{margin-left:auto}
#gfq-01-panel .gfq-ticket{grid-template-columns:1fr}
#gfq-01-panel .gfq-tk-main,#gfq-01-panel .gfq-tk-stub{border-left:0;border-top:2px dashed var(--ink)}
#gfq-01-panel .gfq-tk-main::before,#gfq-01-panel .gfq-tk-main::after,#gfq-01-panel .gfq-tk-stub::before,#gfq-01-panel .gfq-tk-stub::after{display:none}
#gfq-01-panel .gfq-tk-photo{flex-direction:row;padding:20px 16px 16px}#gfq-01-panel .gfq-photo{width:104px;height:124px;flex:none}
#gfq-01-panel .gfq-tk-main{padding:14px 16px}#gfq-01-panel .gfq-tk-name{font-size:32px}
#gfq-01-panel .gfq-tk-stub{flex-direction:row;padding:10px 14px}#gfq-01-panel .gfq-tk-stub .gfq-barcode{flex-direction:row;min-height:30px;height:30px}#gfq-01-panel .gfq-tk-stub span{writing-mode:horizontal-tb}
#gfq-01-panel .gfq-items-body,#gfq-01-panel .gfq-split{grid-template-columns:1fr}
#gfq-01-panel .gfq-slots{grid-template-columns:repeat(3,minmax(0,1fr))}
#gfq-01-panel .gfq-board{height:auto!important;min-height:0;display:flex;flex-direction:column;gap:10px;padding:18px 12px}
#gfq-01-panel .gfq-route{display:none}#gfq-01-panel .gfq-pinbox{position:relative;left:auto!important;top:auto!important;transform:none;max-width:none}#gfq-01-panel .gfq-halo{left:-20px;width:84px;height:84px;margin-top:-42px}}
@media(prefers-reduced-motion:reduce){#gfq-01-panel *{transition:none!important}}
/* v0.6.1 */
#gfq-01-panel .gfq-seg button[aria-pressed=true]:hover:not(:disabled),#gfq-01-panel .gfq-card button[aria-pressed=true]:hover:not(:disabled){background:var(--ind2);color:#fff}
#gfq-01-panel .gfq-qitem.on:hover:not(:disabled),#gfq-01-panel .gfq-slot.on:hover:not(:disabled){background:var(--ind2);color:#fff}
#gfq-01-panel .gfq-pinbox.on:hover .gfq-pin-text{background:var(--ind2)}
#gfq-01-panel .gfq-top h2{font:800 30px/1 var(--serif);letter-spacing:.06em;color:var(--ind)}
#gfq-01-panel .gfq-ticket{grid-template-columns:272px minmax(0,1fr) 84px}
#gfq-01-panel .gfq-tk-photo{justify-content:center;padding:30px 22px 26px}
#gfq-01-panel .gfq-photo{width:222px;height:280px;padding:10px 10px 34px}
#gfq-01-panel .gfq-photo span{font-size:96px}
#gfq-01-panel .gfq-drop{position:relative;flex:1;max-width:360px;margin-left:auto}
#gfq-01-panel .gfq-drop summary{display:flex;align-items:center;gap:10px;height:40px;padding:0 12px;background:var(--card);border:1.5px solid var(--ink);cursor:pointer;list-style:none;box-shadow:3px 3px 0 #0000001a}
#gfq-01-panel .gfq-drop summary::-webkit-details-marker{display:none}
#gfq-01-panel .gfq-drop-k{font:700 11px var(--cond);letter-spacing:.08em;color:#fff;background:var(--ind);padding:1px 7px}
#gfq-01-panel .gfq-drop-v{flex:1;min-width:0;font:700 15px var(--serif);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#gfq-01-panel .gfq-drop summary svg{width:14px;height:14px;flex:none;transition:transform .15s}
#gfq-01-panel .gfq-drop[open] summary svg{transform:rotate(180deg)}
#gfq-01-panel .gfq-drop-menu{position:absolute;z-index:20;top:calc(100% + 6px);left:0;right:0;display:flex;flex-direction:column;padding:6px;background:var(--card);border:1.5px solid var(--ink);box-shadow:5px 5px 0 #00000026}
#gfq-01-panel .gfq-drop-menu button{display:flex;flex-direction:column;align-items:flex-start;gap:1px;border:0;border-left:3px solid transparent;background:none;padding:8px 10px;text-align:left}
#gfq-01-panel .gfq-drop-menu button span{font:700 15px var(--serif)}
#gfq-01-panel .gfq-drop-menu button small{font-size:11px;color:var(--sub);font-weight:500}
#gfq-01-panel .gfq-drop-menu button:hover:not(:disabled){background:var(--paper2)}
#gfq-01-panel .gfq-drop-menu button[aria-checked=true]{border-left-color:var(--ind);background:#3b3f7a12}
#gfq-01-panel .gfq-drop-menu .gfq-drop-new{margin-top:4px;border-top:1px dashed var(--line);font-weight:700;color:var(--ind);flex-direction:row}
#gfq-01-panel .gfq-ico{width:100%;height:100%;display:block}
#gfq-01-panel .gfq-glyph{position:relative;display:block;width:46px;height:46px;color:var(--ind)}
#gfq-01-panel .gfq-slot .gfq-glyph{width:50px;height:50px}
#gfq-01-panel .gfq-slot.on .gfq-glyph{color:#fff}
#gfq-01-panel .gfq-slot.pending .gfq-glyph{color:#8a7a52}#gfq-01-panel .gfq-slot.on.pending .gfq-glyph{color:#fff}
#gfq-01-panel .gfq-badge{position:absolute;right:-12px;top:-8px;min-width:22px;height:22px;padding:0 6px;display:grid;place-items:center;border-radius:11px;font:700 12px/1 var(--cond);font-style:normal;background:var(--mark);color:var(--ink);border:1.5px solid var(--ink)}
#gfq-01-panel .gfq-badge.num{background:var(--card)}
#gfq-01-panel .gfq-plate .gfq-glyph{width:96px;height:96px}
#gfq-01-panel .gfq-plate .gfq-badge{right:-20px;top:-10px;height:28px;min-width:28px;font-size:15px;border-radius:14px}
#gfq-01-panel .gfq-quests{display:grid;grid-template-columns:300px minmax(0,1fr);gap:20px;align-items:start}
#gfq-01-panel .gfq-qside{position:sticky;top:84px;display:flex;flex-direction:column;gap:10px}
#gfq-01-panel .gfq-qside .gfq-seg{align-self:flex-start}
#gfq-01-panel .gfq-qlist{display:flex;flex-direction:column;gap:6px;max-height:calc(100dvh - 300px);overflow-y:auto;padding:2px 4px 4px 2px}
#gfq-01-panel .gfq-qitem{display:flex;align-items:center;gap:12px;padding:10px 12px;background:var(--card);border:1px solid var(--line);text-align:left;box-shadow:2px 2px 0 #00000012}
#gfq-01-panel .gfq-qitem:hover:not(:disabled){background:var(--hi)}
#gfq-01-panel .gfq-qemb{flex:none;display:grid;place-items:center;width:38px;height:38px;font:700 12px var(--cond);color:var(--ind);border:1.5px solid var(--ind);transform:rotate(45deg) scale(.78)}
#gfq-01-panel .gfq-qemb{position:relative;border:0;transform:none;font-size:11px}#gfq-01-panel .gfq-qemb::before{content:"";position:absolute;inset:5px;border:1.5px solid currentColor;transform:rotate(45deg)}
#gfq-01-panel .gfq-worldbar{display:flex;align-items:center}
#gfq-01-panel .gfq-qtxt{display:flex;flex-direction:column;gap:6px;min-width:0}
#gfq-01-panel .gfq-qtxt b{font:700 14px/1.35 var(--serif);overflow-wrap:anywhere}
#gfq-01-panel .gfq-qitem.on{background:var(--ind);border-color:var(--ind);color:#fff;box-shadow:inset 4px 0 var(--mark),3px 3px 0 #00000026}
#gfq-01-panel .gfq-qitem.on .gfq-qemb{color:#fff;border-color:#fff}
#gfq-01-panel .gfq-qitem.done:not(.on){opacity:.72}
#gfq-01-panel .gfq-pips{display:flex;gap:3px}
#gfq-01-panel .gfq-pips i{width:14px;height:4px;background:#00000022}
#gfq-01-panel .gfq-pips i.on{background:var(--ind)}
#gfq-01-panel .gfq-qitem.on .gfq-pips i{background:var(--hi)fff40}#gfq-01-panel .gfq-qitem.on .gfq-pips i.on{background:var(--mark)}
#gfq-01-panel .gfq-qadd{align-self:flex-start;font-size:13px}
#gfq-01-panel .gfq-qdetail{background:var(--card);border:1px solid var(--line);box-shadow:5px 5px 0 #0000001a;min-width:0}
#gfq-01-panel .gfq-qdetail.empty{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;min-height:260px;padding:30px;text-align:center}
#gfq-01-panel .gfq-qdetail.empty strong{font:700 18px var(--serif);color:var(--ind)}
#gfq-01-panel .gfq-qhead{display:flex;gap:20px;align-items:center;padding:22px 26px;background:linear-gradient(115deg,var(--indd),var(--ind));color:#fff;position:relative;overflow:hidden}
#gfq-01-panel .gfq-qhead::after{content:"";position:absolute;right:-60px;top:-60px;width:220px;height:220px;border-radius:50%;background:repeating-radial-gradient(circle,transparent 0 20px,#ffffff14 21px 22px);pointer-events:none}
#gfq-01-panel .gfq-qcrest{flex:none;display:grid;place-items:center;width:74px;height:92px;background:var(--card);color:var(--ind);clip-path:polygon(50% 0,100% 14%,100% 72%,50% 100%,0 72%,0 14%)}
#gfq-01-panel .gfq-qcrest span{font:800 18px var(--serif);letter-spacing:.08em}
#gfq-01-panel .gfq-qhead-t{min-width:0;display:flex;flex-direction:column;gap:6px;position:relative;z-index:1}
#gfq-01-panel .gfq-qhead h3{margin:0;font:800 26px/1.25 var(--serif);color:#fff;letter-spacing:.02em;overflow-wrap:anywhere}
#gfq-01-panel .gfq-qplace{align-self:flex-start;display:inline-flex;align-items:center;gap:4px;padding:0;border:0;background:none;color:#dfe0ef;font-weight:600;font-size:13px}
#gfq-01-panel .gfq-qplace svg{width:15px;height:15px}
#gfq-01-panel .gfq-qplace:hover:not(:disabled){background:none;color:#fff;text-decoration:underline}
#gfq-01-panel .gfq-qmeta{display:flex;flex-wrap:wrap;align-items:center;gap:4px 10px;font-size:12px;color:var(--onacc)}
#gfq-01-panel .gfq-qmeta i{width:4px;height:4px;background:var(--onacc)80;transform:rotate(45deg)}
#gfq-01-panel .gfq-qbody{padding:20px 26px 6px}
#gfq-01-panel .gfq-objs{border:1px solid var(--line);background:var(--card2)}
#gfq-01-panel .gfq-objs-h{display:flex;justify-content:space-between;padding:8px 14px;border-bottom:1px solid var(--line);font:700 13px var(--cond);letter-spacing:.05em;color:var(--sub)}
#gfq-01-panel .gfq-obj{display:flex;align-items:center;gap:12px;width:100%;padding:11px 14px;border:0;border-bottom:1px solid #00000010;background:none;text-align:left;font-weight:600;font-size:14px}
#gfq-01-panel .gfq-obj:last-child{border-bottom:0}
#gfq-01-panel button.gfq-obj:hover:not(:disabled){background:#3b3f7a0d}
#gfq-01-panel .gfq-obj-mark{flex:none;width:10px;height:10px;border:1.5px solid var(--ind);transform:rotate(45deg)}
#gfq-01-panel .gfq-obj.on .gfq-obj-mark{background:var(--ind)}
#gfq-01-panel .gfq-obj-t{flex:1;min-width:0;line-height:1.45}
#gfq-01-panel .gfq-obj.on .gfq-obj-t{color:var(--sub);text-decoration:line-through;text-decoration-color:#0000004d}
#gfq-01-panel .gfq-obj .gfq-num{font-size:14px;color:var(--sub);white-space:nowrap}
#gfq-01-panel .gfq-obj.on .gfq-num{color:var(--ind);font-weight:700}
#gfq-01-panel .gfq-qdesc{margin:18px 0 0;font:15px/1.8 var(--serif);color:#3a3a40}
#gfq-01-panel .gfq-qrw{margin-top:20px;padding-top:16px;border-top:1.5px dashed var(--line)}
#gfq-01-panel .gfq-qrw h4{margin:0 0 12px;font:700 15px var(--cond);letter-spacing:.08em;color:var(--sub);display:flex;align-items:center;gap:8px}
#gfq-01-panel .gfq-qrw h4::before{content:"";width:8px;height:8px;background:var(--ind);transform:rotate(45deg)}
#gfq-01-panel .gfq-rw{display:flex;flex-direction:column-reverse;gap:12px}
#gfq-01-panel .gfq-rw-tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:8px}
#gfq-01-panel .gfq-rw-tile{display:flex;flex-direction:column;align-items:center;gap:6px;padding:12px 8px 10px;background:linear-gradient(160deg,var(--hi),var(--card));border:1px solid var(--line);text-align:center}
#gfq-01-panel .gfq-rw-tile .gfq-ico{width:40px;height:40px;color:var(--ind)}
#gfq-01-panel .gfq-rw-name{font-size:12px;font-weight:600;line-height:1.35;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
#gfq-01-panel .gfq-rw-rows{display:flex;flex-direction:column;gap:8px}
#gfq-01-panel .gfq-rw-row{display:flex;align-items:center;gap:12px;padding:10px 14px;background:var(--card2);border:1px solid var(--line);border-left:4px solid var(--ind)}
#gfq-01-panel .gfq-rw-ic{flex:none;width:34px;height:34px;color:var(--ind)}
#gfq-01-panel .gfq-rw-rname{flex:1;min-width:0;display:flex;flex-wrap:wrap;align-items:center;gap:4px 8px;font-size:13px;font-weight:600;line-height:1.35}
#gfq-01-panel .gfq-rw-row b{font-size:22px;white-space:nowrap}#gfq-01-panel .gfq-rw-row b small{font-size:13px;margin-left:2px;color:var(--sub)}
#gfq-01-panel .gfq-chip{display:inline-block;padding:1px 8px;font-size:11px;font-weight:700;background:#0000000f;color:var(--sub);white-space:nowrap}
#gfq-01-panel .gfq-chip.t-ok{background:#dbe6dd;color:#2c5a40}#gfq-01-panel .gfq-chip.t-wait{background:#f3e5c2;color:#6e5212}#gfq-01-panel .gfq-chip.t-soft{background:#e2e2ea;color:#55576d}
#gfq-01-panel .gfq-rw-tile.t-soft{opacity:.8}
#gfq-01-panel .gfq-rw-row .gfq-link{font-size:12px}
#gfq-01-panel .gfq-qfoot{display:flex;justify-content:flex-end;gap:8px;margin-top:20px;padding:14px 26px;border-top:1px solid var(--line);background:#00000006}
#gfq-01-panel .gfq-qfoot button{min-width:96px;padding:9px 18px}
#gfq-01-panel .gfq-qfoot .primary{min-width:150px}
#gfq-01-panel .gfq-ghost{border-color:var(--line);color:var(--sub)}
#gfq-01-panel .gfq-board{width:100%}
#gfq-01-panel .gfq-pinbox{max-width:none;transform:none;align-items:flex-start}
#gfq-01-panel .gfq-pin-text{flex:1}
#gfq-01-panel .gfq-pin-text b{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;word-break:keep-all;overflow-wrap:anywhere}
#gfq-01-panel .gfq-pinbox img,#gfq-01-panel .gfq-pin-dot{width:48px;height:48px}
#gfq-01-panel .gfq-halo{left:-36px;top:24px;margin-top:-60px}
#gfq-01-panel .gfq-placecard{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);margin-top:22px;background:var(--card);border:1px solid var(--line);border-top:4px double var(--ind);box-shadow:5px 5px 0 #0000001a;scroll-margin-top:90px}
#gfq-01-panel .gfq-placephoto{min-height:300px;background:var(--ink)}
#gfq-01-panel .gfq-placephoto img{width:100%;height:100%;min-height:300px;max-height:460px;object-fit:cover;display:block}
#gfq-01-panel .gfq-placephoto.none{display:grid;place-items:center;background:repeating-linear-gradient(90deg,var(--hatch1) 0 2px,var(--hatch2) 2px 9px)}
#gfq-01-panel .gfq-placeinfo{padding-bottom:16px;min-width:0}
#gfq-01-panel .gfq-placeinfo .gfq-hd{display:flex;align-items:center;gap:10px;padding:14px 0 14px 16px;border-bottom:1px solid var(--line)}
#gfq-01-panel .gfq-placeinfo h4{flex:1;margin:0;font:800 21px/1.3 var(--serif);color:var(--ind);overflow-wrap:anywhere}
#gfq-01-panel .gfq-placeinfo h5{margin:14px 16px 6px;font:700 14px var(--cond);letter-spacing:.06em;display:flex;align-items:center;gap:6px}
#gfq-01-panel .gfq-placeinfo h5::before{content:"";width:12px;height:12px;border:1.5px solid var(--ink);box-shadow:inset 0 0 0 2px var(--card),inset 0 0 0 6px var(--ind)}
#gfq-01-panel .gfq-placeinfo .gfq-facts{margin:0 16px}#gfq-01-panel .gfq-pad{padding:0 16px}
#gfq-01-panel .gfq-placeinfo .gfq-here{margin:12px 16px 0}
@media(max-width:760px),(max-height:500px) and (orientation:landscape) and (pointer:coarse){#gfq-01-panel .gfq-ticket{grid-template-columns:1fr}#gfq-01-panel .gfq-photo{width:150px;height:190px}#gfq-01-panel .gfq-quests,#gfq-01-panel .gfq-rw,#gfq-01-panel .gfq-placecard{grid-template-columns:1fr}#gfq-01-panel .gfq-qside{position:static}#gfq-01-panel .gfq-qlist{max-height:240px}#gfq-01-panel .gfq-qhead{padding:16px}#gfq-01-panel .gfq-qcrest{width:54px;height:68px}#gfq-01-panel .gfq-qhead h3{font-size:21px}#gfq-01-panel .gfq-qbody{padding:16px}#gfq-01-panel .gfq-qfoot{padding:12px 16px}#gfq-01-panel .gfq-pinbox{width:auto!important}#gfq-01-panel .gfq-drop{max-width:none}}

/* v0.6.2 */
#gfq-01-panel .gfq-tk-rows dd.gfq-cash{flex-direction:column;align-items:flex-start;gap:2px}
#gfq-01-panel .gfq-cash b{font-size:30px!important;line-height:1.05!important;color:var(--ind)}
#gfq-01-panel .gfq-cash small{font-size:11px}
#gfq-01-panel .gfq-cash .gfq-link{font-size:12px}
#gfq-01-panel .gfq-pager{display:flex;align-items:center;gap:8px;margin:0 0 12px}
#gfq-01-panel .gfq-pager>button{width:36px;height:36px;padding:0;font-size:20px;line-height:1}
#gfq-01-panel .gfq-pager-tabs{flex:1;min-width:0;display:flex;gap:6px;overflow-x:auto;padding:2px}
#gfq-01-panel .gfq-pager-tabs button{flex:none;padding:6px 14px;font:700 14px var(--serif);background:var(--card)}
#gfq-01-panel .gfq-pager-tabs button small{color:var(--sub);font-family:var(--cond);margin-left:3px}
#gfq-01-panel .gfq-pager-tabs button[aria-pressed=true]{background:var(--ind);border-color:var(--ind);color:#fff}
#gfq-01-panel .gfq-pager-tabs button[aria-pressed=true] small{color:var(--onacc)}
#gfq-01-panel .gfq-pager-n{font-size:20px;font-weight:700;color:var(--ind);white-space:nowrap}#gfq-01-panel .gfq-pager-n small{font-size:13px;color:var(--sub)}
#gfq-01-panel .gfq-pager-tabs button[aria-pressed=true]:hover:not(:disabled){background:var(--ind2)}
/* v0.7.0 */
#gfq-01-panel .gfq-faces{display:grid;grid-template-columns:repeat(auto-fill,minmax(128px,1fr));gap:10px}
#gfq-01-panel .gfq-face{display:flex;flex-direction:column;padding:0;background:var(--card);border:1px solid var(--line);text-align:left;box-shadow:2px 2px 0 #00000012;overflow:hidden}
#gfq-01-panel .gfq-face-img{position:relative;display:block;aspect-ratio:3/4;background:repeating-linear-gradient(90deg,var(--hatch1) 0 2px,var(--hatch2) 2px 9px)}
#gfq-01-panel .gfq-face-img img{width:100%;height:100%;object-fit:cover;object-position:50% 15%;display:block}
#gfq-01-panel .gfq-face-img i{display:grid;place-items:center;height:100%;font:800 46px var(--serif);font-style:normal;color:var(--ind)}
#gfq-01-panel .gfq-face-img em{position:absolute;left:6px;bottom:6px;padding:0 6px;background:#262950d0;color:var(--mark);font-size:11px;font-style:normal;letter-spacing:-.05em}
#gfq-01-panel .gfq-face-name{padding:8px 10px 0;font:700 14px/1.3 var(--serif);overflow-wrap:anywhere}
#gfq-01-panel .gfq-face small{padding:2px 10px 9px;font-size:11px;color:var(--sub)}
#gfq-01-panel .gfq-face.on{border:3px solid var(--mark);box-shadow:0 0 0 1px var(--ind),3px 3px 0 #00000026}
#gfq-01-panel .gfq-face.on .gfq-face-name,#gfq-01-panel .gfq-face.on small{background:var(--ind);color:#fff}
#gfq-01-panel .gfq-face.on small{color:var(--onacc)}
#gfq-01-panel .gfq-face:hover:not(:disabled):not(.on){background:var(--hi)}
#gfq-01-panel .gfq-plate.tall{height:300px}#gfq-01-panel .gfq-castsec{margin-top:4px}
#gfq-01-panel .gfq-plate.tall img{object-position:50% 15%}
#gfq-01-panel .gfq-glyph-big{font:800 96px var(--serif);color:var(--ind);text-shadow:3px 3px 0 #fff}
#gfq-01-panel .gfq-note{margin:0 14px;padding:10px 12px;background:var(--card2);border-left:3px solid var(--mark);font:14px/1.7 var(--serif)}
#gfq-01-panel .gfq-castcard h5{margin-top:16px}
#gfq-01-panel .gfq-late{margin:0 0 16px;padding:12px 16px;background:#f6e3df;border:1px solid #d9a69e;border-left:5px solid var(--red)}
#gfq-01-panel .gfq-late b{color:var(--red)}#gfq-01-panel .gfq-late ul{margin:6px 0;padding-left:18px}#gfq-01-panel .gfq-late li{font-weight:600}
#gfq-01-panel .gfq-cal{background:var(--card);border:1px solid var(--line);box-shadow:5px 5px 0 #0000001a;padding:14px 16px 16px}
#gfq-01-panel .gfq-cal-head{display:flex;align-items:center;gap:8px;margin-bottom:10px}
#gfq-01-panel .gfq-cal-head h3{margin:0 8px;font-size:26px;color:var(--ind);letter-spacing:.04em}
#gfq-01-panel .gfq-cal-head button{width:34px;height:34px;padding:0;font-size:18px}#gfq-01-panel .gfq-cal-head button:last-child{width:auto;padding:0 12px;margin-left:auto;font-size:13px}
#gfq-01-panel .gfq-cal-week,#gfq-01-panel .gfq-cal-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px}
#gfq-01-panel .gfq-cal-week span{text-align:center;font:700 12px var(--cond);color:var(--sub);padding:4px 0}
#gfq-01-panel .gfq-cal-week span:first-child{color:var(--red)}
#gfq-01-panel .gfq-cal-day{display:flex;flex-direction:column;align-items:stretch;gap:2px;min-height:82px;padding:5px 6px;background:var(--card2);border:1px solid #00000014;text-align:left;font-weight:500;overflow:hidden}
#gfq-01-panel .gfq-cal-day b{font-size:15px}
#gfq-01-panel .gfq-cal-day i{display:block;font-style:normal;font-size:11px;line-height:1.3;padding:1px 4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;background:#e2e2ea;color:#3e4060}
#gfq-01-panel .gfq-cal-day i.k-pay,#gfq-01-panel .gfq-cal-day i.k-item{background:#f3e5c2;color:#6e5212}
#gfq-01-panel .gfq-cal-day i.k-in{background:#dbe6dd;color:#2c5a40}#gfq-01-panel .gfq-cal-day i.k-out{background:#f1d6d3;color:#83291f}
#gfq-01-panel .gfq-cal-day i.k-chapter{background:var(--ind);color:#fff}
#gfq-01-panel .gfq-cal-day small{font-size:10px;color:var(--sub)}
#gfq-01-panel .gfq-cal-day.today{box-shadow:inset 0 0 0 2px var(--ind)}#gfq-01-panel .gfq-cal-day.today b{color:var(--ind)}
#gfq-01-panel .gfq-cal-day.late{background:#f8ece9}
#gfq-01-panel .gfq-cal-day.on{background:var(--hi);border-color:var(--mark);box-shadow:inset 0 0 0 2px var(--mark)}
#gfq-01-panel .gfq-cal-day.on.today{box-shadow:inset 0 0 0 2px var(--mark),inset 0 0 0 4px var(--ind)}
#gfq-01-panel .gfq-cal-pad{min-height:82px}
#gfq-01-panel .gfq-cal-list{margin-top:18px}
#gfq-01-panel .gfq-cal-list h3{font-size:20px}
#gfq-01-panel .gfq-cal-list ul{list-style:none;margin:0;padding:0;border-top:1px solid var(--line)}
#gfq-01-panel .gfq-cal-list li{display:flex;align-items:center;gap:10px;padding:10px 4px;border-bottom:1px solid var(--line);font-weight:600}
#gfq-01-panel .gfq-cal-list li span{flex:none;min-width:64px;padding:1px 8px;font-size:11px;text-align:center;background:#e2e2ea;color:#3e4060}
#gfq-01-panel .gfq-cal-list li.k-pay span,#gfq-01-panel .gfq-cal-list li.k-item span{background:#f3e5c2;color:#6e5212}
#gfq-01-panel .gfq-cal-list li.k-in span{background:#dbe6dd;color:#2c5a40}#gfq-01-panel .gfq-cal-list li.k-out span{background:#f1d6d3;color:#83291f}
#gfq-01-panel .gfq-cal-list li.k-chapter span{background:var(--ind);color:#fff}
#gfq-01-panel .gfq-cal-list li em{margin-left:auto;font-style:normal;font-size:11px;font-weight:700;color:var(--red)}
#gfq-01-panel .gfq-chapters{margin-bottom:26px}
#gfq-01-panel .gfq-chapters>h3{margin-top:0}
#gfq-01-panel .gfq-chcard{margin:0 0 8px;background:var(--card);border:1px solid var(--line);box-shadow:3px 3px 0 #00000014}
#gfq-01-panel .gfq-chcard summary{display:flex;align-items:center;gap:14px;padding:10px 16px 10px 0;list-style:none}
#gfq-01-panel .gfq-chcard summary::-webkit-details-marker{display:none}
#gfq-01-panel .gfq-chno{align-self:stretch;display:grid;place-items:center;min-width:58px;background:var(--ind);color:#fff;font-size:24px;font-weight:700;margin:-10px 0}
#gfq-01-panel .gfq-chtitle{display:flex;flex-direction:column;font:700 17px var(--serif)}
#gfq-01-panel .gfq-chtitle small{font-size:12px;color:var(--sub);font-weight:500}
#gfq-01-panel .gfq-chstat{margin-left:auto;font-size:12px;color:var(--sub);text-align:right}
#gfq-01-panel .gfq-chcard[open] summary{border-bottom:1px dashed var(--line)}
#gfq-01-panel .gfq-chbody{padding:12px 16px 14px 72px}
#gfq-01-panel .gfq-chmoney{display:flex;gap:10px;margin-bottom:8px}
#gfq-01-panel .gfq-chmoney div{display:flex;flex-direction:column;padding:6px 14px;background:var(--ink);color:var(--card)}
#gfq-01-panel .gfq-chmoney span{font-size:11px;color:#b9bbc8}#gfq-01-panel .gfq-chmoney b{font-size:18px}
#gfq-01-panel .gfq-chbody dl{margin:0}
#gfq-01-panel .gfq-chrow{display:grid;grid-template-columns:96px minmax(0,1fr);gap:8px;padding:5px 0}
#gfq-01-panel .gfq-chrow dt{font:700 12px var(--cond);color:var(--sub);letter-spacing:.04em;padding-top:3px}
#gfq-01-panel .gfq-chrow dd{margin:0;display:flex;flex-wrap:wrap;gap:4px}
#gfq-01-panel .gfq-chrow dd span{padding:2px 8px;background:var(--card2);border:1px solid #00000014;font-size:13px}
@media(max-width:760px),(max-height:500px) and (orientation:landscape) and (pointer:coarse){#gfq-01-panel .gfq-faces{grid-template-columns:repeat(3,minmax(0,1fr))}#gfq-01-panel .gfq-cal{padding:10px}#gfq-01-panel .gfq-cal-day{min-height:52px;padding:3px}#gfq-01-panel .gfq-cal-day i{font-size:0;height:5px;padding:0}#gfq-01-panel .gfq-cal-pad{min-height:52px}#gfq-01-panel .gfq-chbody{padding:12px 14px}#gfq-01-panel .gfq-chrow{grid-template-columns:1fr}#gfq-01-panel .gfq-tabs{flex-wrap:nowrap}#gfq-01-panel .gfq-tabs button{flex:1 1 0;min-width:0}#gfq-01-panel .gfq-tab-l{font-size:11px;white-space:nowrap}#gfq-01-panel .gfq-brand{display:none}}

/* v0.7.1 */
#gfq-01-panel .gfq-outfits{display:grid;grid-template-columns:repeat(auto-fill,minmax(64px,1fr));gap:6px;margin:0 14px}
#gfq-01-panel .gfq-outfits button{display:flex;flex-direction:column;gap:3px;padding:3px;background:var(--card2);border:1px solid var(--line);font-weight:600}
#gfq-01-panel .gfq-of-img{display:block;aspect-ratio:3/4;background:repeating-linear-gradient(90deg,var(--hatch1) 0 2px,var(--hatch2) 2px 9px);overflow:hidden}
#gfq-01-panel .gfq-of-img img{width:100%;height:100%;object-fit:cover;object-position:50% 15%;display:block}
#gfq-01-panel .gfq-outfits small{font-size:10px;line-height:1.2;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#gfq-01-panel .gfq-outfits button[aria-pressed=true]{border:2px solid var(--mark);background:var(--ind);color:#fff;box-shadow:0 0 0 1px var(--ind)}

/* v0.7.2 themes: each world can pick a look. Only colours, fonts and paper texture change. */
#gfq-01-panel[data-theme=school]{--paper:#ecedf3;--paper2:#e1e3ee;--card:#fbfbfe;--card2:#ffffff;--hi:#ffffff;--ink:#23263a;--sub:#6a6e86;--line:#c3c7da;--ind:#3d63b0;--ind2:#5a7fcc;--indd:#22397a;--mark:#ff8fab;--onacc:#d8e2f6;--board:#f6f7fc;--hatch1:#dfe2ef;--hatch2:#eceef7}
#gfq-01-panel[data-theme=school] .gfq-main{background:linear-gradient(#3d63b01a 1px,transparent 1px) 0 0/100% 30px,linear-gradient(90deg,transparent 46px,#ff8fab55 46px 47px,transparent 47px),var(--paper)}
#gfq-01-panel[data-theme=school] .gfq-side{background:linear-gradient(158deg,var(--ind) 0 40%,transparent 40.2%),radial-gradient(#3d63b022 1.2px,transparent 1.6px) 0 0/14px 14px,var(--paper2)}
#gfq-01-panel[data-theme=school] .gfq-ticket,#gfq-01-panel[data-theme=school] .gfq-card,#gfq-01-panel[data-theme=school] .gfq-qdetail{border-radius:10px}
#gfq-01-panel .gfq-themes{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin:8px 0}
#gfq-01-panel .gfq-theme{display:flex;flex-direction:column;gap:6px;padding:8px;text-align:left;background:var(--card2)}
#gfq-01-panel .gfq-theme-sw{display:grid;grid-template-columns:2fr 1fr 1fr;height:42px;border:1px solid #0002}
#gfq-01-panel .gfq-theme-sw i{display:block}
#gfq-01-panel .gfq-theme b{font:700 14px var(--serif)}#gfq-01-panel .gfq-theme small{font-size:11px;color:var(--sub);font-weight:500}
#gfq-01-panel .gfq-card .gfq-theme[aria-pressed=true],#gfq-01-panel .gfq-card .gfq-theme[aria-pressed=true]:hover{outline:3px solid var(--mark);outline-offset:-1px;background:var(--hi);color:var(--ink);border-color:var(--ind)}

#gfq-01-panel .gfq-rw-row.cond{border-left-style:dashed;background:transparent}#gfq-01-panel .gfq-rw-row.cond b{color:var(--sub);font-size:18px}

#gfq-01-panel .gfq-units{gap:6px}#gfq-01-panel .gfq-units button{padding:4px 12px;font-size:13px}
#gfq-01-panel .gfq-rc-other{display:flex;flex-direction:column;gap:2px;margin:-4px 0 10px;padding:8px 12px;border:1px dashed var(--line);font-size:12px}#gfq-01-panel .gfq-rc-other b{font-size:11px;color:var(--sub)}

/* v0.7.3 theme shapes. 동양: 청록·한지·단청·낙관 / 판타지: 양피지·진홍·금 장식·밀랍 / SF: 각진 HUD / 학원: 둥근 노트·마스킹 테이프 */
#gfq-01-panel[data-theme=school] .gfq-tab-ic{border-radius:50%;border:2px solid var(--ind);box-shadow:none}
#gfq-01-panel[data-theme=school] .gfq-tab-l{clip-path:none;border-radius:0 999px 999px 0;border:2px solid #c3c7da;border-left:0;text-decoration:none}
#gfq-01-panel[data-theme=school] .gfq-tabs button.primary .gfq-tab-ic{background:var(--mark);border-color:#fff;color:#fff;transform:rotate(-8deg)}
#gfq-01-panel[data-theme=school] .gfq-tabs button.primary .gfq-tab-l{background:var(--ind);color:#fff;border-color:var(--ind)}
#gfq-01-panel[data-theme=school] .gfq-side-foot{border-radius:14px;border-width:2px}
#gfq-01-panel[data-theme=school] .gfq-top{border-bottom:3px dotted var(--ind)}
#gfq-01-panel[data-theme=school] .gfq-top h2{background:linear-gradient(transparent 58%,#ff8fab88 58%);padding:0 4px}
#gfq-01-panel[data-theme=school] h3{background:linear-gradient(transparent 60%,#ffe08a 60%);display:inline-block;padding:0 3px}
#gfq-01-panel[data-theme=school] :is(.gfq-card,.gfq-qdetail,.gfq-dossier,.gfq-ticket,.gfq-placecard,.gfq-cal,.gfq-chcard,.gfq-qitem,.gfq-face,.gfq-rw-tile,.gfq-rw-row,.gfq-receipt,.gfq-board){border-radius:14px;overflow:visible}
#gfq-01-panel[data-theme=school] :is(.gfq-qdetail,.gfq-ticket,.gfq-placecard,.gfq-cal,.gfq-receipt){position:relative}
#gfq-01-panel[data-theme=school] :is(.gfq-qdetail,.gfq-placecard,.gfq-cal,.gfq-ticket)::before{content:"";position:absolute;z-index:3;top:-10px;left:50%;width:96px;height:22px;margin-left:-48px;background:repeating-linear-gradient(45deg,#ff8fab99 0 6px,#ffb3c799 6px 12px);transform:rotate(-3deg);pointer-events:none}
#gfq-01-panel[data-theme=school] .gfq-qhead{border-radius:14px 14px 0 0;background:linear-gradient(115deg,var(--ind),#7a9be0)}
#gfq-01-panel[data-theme=school] .gfq-qcrest{clip-path:none;border-radius:50%;width:78px;height:78px;border:3px dashed var(--mark)}
#gfq-01-panel[data-theme=school] :is(button,select,input,.gfq-drop summary){border-radius:10px}
#gfq-01-panel[data-theme=school] .gfq-slot{border-radius:4px;border:0;box-shadow:2px 3px 0 #0000001a;background:#fff6b8}
#gfq-01-panel[data-theme=school] .gfq-slot:nth-child(3n+2){background:#ffd6e0}#gfq-01-panel[data-theme=school] .gfq-slot:nth-child(3n){background:#d6e6ff}
#gfq-01-panel[data-theme=school] .gfq-slot:nth-child(odd){transform:rotate(-1.2deg)}#gfq-01-panel[data-theme=school] .gfq-slot:nth-child(even){transform:rotate(1deg)}
#gfq-01-panel[data-theme=school] .gfq-slot::before{background:#ff8fab;width:9px;height:9px}
#gfq-01-panel[data-theme=school] .gfq-slot.on{background:var(--ind);transform:none}
#gfq-01-panel[data-theme=school] .gfq-stamp{border-radius:999px;transform:none}
#gfq-01-panel[data-theme=school] .gfq-receipt::after{display:none}
#gfq-01-panel[data-theme=school] .gfq-rc-total{border-radius:10px}
#gfq-01-panel[data-theme=school] .gfq-chno{border-radius:14px 0 0 14px}
/* v0.7.4 동양: 수묵 산수 · 옥빛 · 주홍 · 황토 금테 */
/* v0.7.4 판타지: 가죽 책상 위 낡은 수첩 · 세피아 · 황동 */
#gfq-01-panel[data-theme=fantasy]{--paper:#efe5cd;--paper2:#2b2119;--card:#f7efdc;--card2:#fbf6e9;--hi:#fffaef;--ink:#3a2b1b;--sub:#7b6547;--line:#c7b28b;--ind:#6b4f2e;--ind2:#8a6a3f;--indd:#3a2a18;--mark:#c9a24a;--onacc:#efe0c0;--board:#efe4c9;--hatch1:#ddcfb0;--hatch2:#e9dec5;--red:#9b3b2a;--serif:"Cormorant Garamond","Noto Serif KR","Nanum Myeongjo","AppleMyungjo","Batang",serif;background:#2b2119}
#gfq-01-panel[data-theme=fantasy] .gfq-frame{background:radial-gradient(ellipse at 30% 20%,#4a3828,#2b2119 70%)}
#gfq-01-panel[data-theme=fantasy] .gfq-side{background:transparent;border-right:0;padding-right:0}
#gfq-01-panel[data-theme=fantasy] .gfq-brand{color:#e9d6a8}#gfq-01-panel[data-theme=fantasy] .gfq-brand small{color:#b49766}
#gfq-01-panel[data-theme=fantasy] .gfq-brand-mark{border-color:#c9a24a;box-shadow:inset 0 0 0 4px #2b2119,inset 0 0 0 7px #c9a24a}
#gfq-01-panel[data-theme=fantasy] .gfq-tabs{padding:0;gap:8px}
#gfq-01-panel[data-theme=fantasy] .gfq-tabs button{position:relative;margin-left:22px;background:linear-gradient(90deg,#e6d8b8,#efe5cd);border:1px solid #a68b5f;border-right:0;border-radius:18px 0 0 18px;box-shadow:-3px 3px 0 #0000004d;padding:0 0 0 8px;transition:margin .15s}
#gfq-01-panel[data-theme=fantasy] .gfq-tab-ic{width:30px;height:38px;background:transparent;border:0;box-shadow:none;color:#6b4f2e}
#gfq-01-panel[data-theme=fantasy] .gfq-tab-l{margin:0;clip-path:none;background:transparent;border:0;color:#3a2b1b;text-decoration:none;padding:8px 14px 8px 4px;font-family:var(--serif);font-weight:700;letter-spacing:.06em}
#gfq-01-panel[data-theme=fantasy] .gfq-tabs button:hover{margin-left:14px}
#gfq-01-panel[data-theme=fantasy] .gfq-tabs button.primary{margin-left:6px;background:#fbf6e9;border-color:#c9a24a;box-shadow:-4px 4px 0 #00000059}
#gfq-01-panel[data-theme=fantasy] .gfq-tabs button.primary:hover:not(:disabled){background:#fbf6e9;border-color:#c9a24a}
#gfq-01-panel[data-theme=fantasy] .gfq-tabs button.primary .gfq-tab-ic{background:transparent;color:#9b3b2a;transform:none;box-shadow:none}
#gfq-01-panel[data-theme=fantasy] .gfq-tabs button.primary .gfq-tab-l{background:transparent;color:#3a2b1b;box-shadow:none}
#gfq-01-panel[data-theme=fantasy] .gfq-tabs button.primary::before{content:"";position:absolute;left:-4px;top:50%;width:9px;height:9px;margin-top:-5px;border-radius:50%;background:#9b3b2a;box-shadow:0 0 0 2px #fbf6e9}
#gfq-01-panel[data-theme=fantasy] .gfq-side-foot{background:#efe5cd;border:1px solid #a68b5f;box-shadow:-3px 3px 0 #0000004d;margin-left:22px;margin-right:0;border-radius:10px 0 0 10px}
#gfq-01-panel[data-theme=fantasy] .gfq-main{margin:16px 18px 16px 0;border-radius:6px;background:linear-gradient(90deg,#00000014,transparent 22px),repeating-linear-gradient(0deg,transparent 0 31px,#6b4f2e12 31px 32px),radial-gradient(ellipse at 50% 30%,#fbf6e9,#efe5cd 60%,#e2d3ae);box-shadow:0 0 0 1px #8a6f4a,5px 5px 0 #d9caa7,5px 5px 0 1px #8a6f4a,10px 10px 0 #cbb88f,10px 10px 0 1px #7a613f,0 24px 50px #000a}
#gfq-01-panel[data-theme=fantasy] .gfq-top{background:#f3ead4f0;border-bottom:3px double #8a6f4a;margin-top:0}
#gfq-01-panel[data-theme=fantasy] .gfq-top h2{color:#3a2b1b;font-family:var(--serif);letter-spacing:.12em}
#gfq-01-panel[data-theme=fantasy] h3{color:#3a2b1b;font-family:var(--serif);letter-spacing:.06em}
#gfq-01-panel[data-theme=fantasy] :is(.gfq-card,.gfq-qdetail,.gfq-dossier,.gfq-placecard,.gfq-cal,.gfq-chcard,.gfq-qitem,.gfq-rw-row,.gfq-rw-tile,.gfq-face){border:1px solid #a68b5f;box-shadow:inset 0 0 0 3px var(--card),inset 0 0 0 4px #c7b28b,2px 3px 0 #00000014;background-color:var(--card)}
#gfq-01-panel[data-theme=fantasy] .gfq-card::before{width:4px;background:#8a6a3f}
#gfq-01-panel[data-theme=fantasy] button{border-color:#8a6f4a;background:#f7efdc;color:#3a2b1b;border-radius:3px}
#gfq-01-panel[data-theme=fantasy] button.primary{background:linear-gradient(180deg,#d8b65e,#b38a35);border-color:#7a5c22;color:#2b1d0e;box-shadow:inset 0 1px 0 #fff3c4}
#gfq-01-panel[data-theme=fantasy] button.primary:hover:not(:disabled){background:linear-gradient(180deg,#e4c470,#c09640);border-color:#7a5c22}
#gfq-01-panel[data-theme=fantasy] .gfq-drop summary{border-color:#8a6f4a;box-shadow:none}#gfq-01-panel[data-theme=fantasy] .gfq-drop-k{background:#6b4f2e}
#gfq-01-panel[data-theme=fantasy] .gfq-seg{border-color:#8a6f4a;background:#f7efdc}#gfq-01-panel[data-theme=fantasy] .gfq-seg button[aria-pressed=true]{background:#6b4f2e;color:#fbf6e9}
#gfq-01-panel[data-theme=fantasy] .gfq-qitem{gap:14px}
#gfq-01-panel[data-theme=fantasy] .gfq-qemb{border-radius:50%;width:42px;height:42px;font-family:var(--serif);color:#6b4f2e}
#gfq-01-panel[data-theme=fantasy] .gfq-qemb::before{transform:none;border-radius:50%;inset:2px;border:1px solid #8a6f4a;box-shadow:inset 0 0 0 3px #f7efdc,inset 0 0 0 4px #c7b28b}
#gfq-01-panel[data-theme=fantasy] .gfq-qitem.on{background:#fbf6e9;color:#3a2b1b;border-color:#c9a24a;box-shadow:inset 4px 0 #9b3b2a,inset 0 0 0 3px #fbf6e9,inset 0 0 0 4px #c9a24a,3px 4px 0 #0000001f}
#gfq-01-panel[data-theme=fantasy] .gfq-qitem.on .gfq-qemb{color:#9b3b2a;border-color:#9b3b2a}
#gfq-01-panel[data-theme=fantasy] .gfq-pips{position:relative;gap:10px;padding:2px 0}
#gfq-01-panel[data-theme=fantasy] .gfq-pips::before{content:"";position:absolute;left:0;right:0;top:50%;height:1px;background:#a68b5f}
#gfq-01-panel[data-theme=fantasy] .gfq-pips i{position:relative;width:8px;height:8px;border-radius:50%;background:#efe5cd;border:1px solid #8a6f4a}
#gfq-01-panel[data-theme=fantasy] .gfq-pips i.on,#gfq-01-panel[data-theme=fantasy] .gfq-qitem.on .gfq-pips i.on{background:#c9a24a;border-color:#7a5c22}
#gfq-01-panel[data-theme=fantasy] .gfq-qitem.on .gfq-pips i{background:#efe5cd}
#gfq-01-panel[data-theme=fantasy] .gfq-qhead{background:linear-gradient(180deg,#fbf6e9,#efe4c8);color:var(--ink);border-bottom:3px double #8a6f4a}
#gfq-01-panel[data-theme=fantasy] .gfq-qhead::after{background:radial-gradient(circle,transparent 0 40px,#8a6f4a22 41px 42px,transparent 43px 58px,#8a6f4a22 59px 60px,transparent 61px)}
#gfq-01-panel[data-theme=fantasy] .gfq-qhead h3{color:#3a2b1b;font-family:var(--serif);font-size:28px}
#gfq-01-panel[data-theme=fantasy] .gfq-qplace{color:#6b4f2e}#gfq-01-panel[data-theme=fantasy] .gfq-qplace:hover:not(:disabled){color:#9b3b2a}
#gfq-01-panel[data-theme=fantasy] .gfq-qmeta{color:#7b6547}#gfq-01-panel[data-theme=fantasy] .gfq-qmeta i{background:#a68b5f}
#gfq-01-panel[data-theme=fantasy] .gfq-qcrest{clip-path:none;border-radius:50%;width:84px;height:84px;background:radial-gradient(circle,#fbf6e9 0 30px,#efe0c0 31px);color:#6b4f2e;box-shadow:inset 0 0 0 2px #8a6f4a,inset 0 0 0 6px #efe0c0,inset 0 0 0 7px #8a6f4a,2px 3px 0 #00000026}
#gfq-01-panel[data-theme=fantasy] .gfq-qcrest span{font-family:var(--serif)}
#gfq-01-panel[data-theme=fantasy] .gfq-obj-mark{border-color:#8a6f4a;transform:none;border-radius:50%}#gfq-01-panel[data-theme=fantasy] .gfq-obj.on .gfq-obj-mark{background:#9b3b2a;border-color:#9b3b2a}
#gfq-01-panel[data-theme=fantasy] .gfq-obj .gfq-num{font-family:var(--serif);font-size:18px}
#gfq-01-panel[data-theme=fantasy] .gfq-rw-row{border-left:1px solid #a68b5f}
#gfq-01-panel[data-theme=fantasy] .gfq-chip{border:1px solid currentColor;background:transparent}
#gfq-01-panel[data-theme=fantasy] .gfq-chip.t-ok{background:#e8d9a8;color:#5b4310;border-color:#a68b5f}
#gfq-01-panel[data-theme=fantasy] .gfq-ticket{border:1px solid #8a6f4a;background:var(--card);box-shadow:inset 0 0 0 4px var(--card),inset 0 0 0 5px #c7b28b,5px 6px 0 #00000026}
#gfq-01-panel[data-theme=fantasy] .gfq-tk-stub{background:#6b4f2e}
#gfq-01-panel[data-theme=fantasy] .gfq-photo{transform:rotate(-2deg);background:#fbf6e9;box-shadow:0 3px 10px #0004;filter:sepia(.25)}
#gfq-01-panel[data-theme=fantasy] .gfq-photo::after{top:-14px;left:auto;right:22px;width:14px;height:44px;margin:0;background:transparent;border:2px solid #9aa0a6;border-radius:8px;transform:rotate(8deg);box-shadow:inset 0 0 0 3px transparent}
#gfq-01-panel[data-theme=fantasy] .gfq-stamp{border-color:#9b3b2a;color:#9b3b2a;background:transparent}
#gfq-01-panel[data-theme=fantasy] .gfq-receipt{border:1px solid #8a6f4a;background:repeating-linear-gradient(0deg,transparent 0 27px,#6b4f2e14 27px 28px),#fbf6e9}
#gfq-01-panel[data-theme=fantasy] .gfq-receipt::after{display:none}
#gfq-01-panel[data-theme=fantasy] .gfq-rc-total{background:#3a2a18;color:#efe0c0}
#gfq-01-panel[data-theme=fantasy] .gfq-slot{background:#f7efdc;border-color:#a68b5f}
#gfq-01-panel[data-theme=fantasy] .gfq-slot.on{background:#6b4f2e;border-color:#c9a24a}
#gfq-01-panel[data-theme=fantasy] .gfq-board{background:radial-gradient(ellipse at 50% 50%,transparent 45%,#6b4f2e33),repeating-linear-gradient(0deg,transparent 0 47px,#6b4f2e1a 47px 48px),repeating-linear-gradient(90deg,transparent 0 47px,#6b4f2e1a 47px 48px),#efe4c9;border-color:#8a6f4a}
#gfq-01-panel[data-theme=fantasy] .gfq-route polyline{stroke:#9b3b2a}
#gfq-01-panel[data-theme=fantasy] .gfq-board::before,#gfq-01-panel[data-theme=fantasy] .gfq-board::after{border-color:#8a6f4a}
#gfq-01-panel[data-theme=fantasy] .gfq-chno{background:#6b4f2e;font-family:var(--serif)}
@media(max-width:760px),(max-height:500px) and (orientation:landscape) and (pointer:coarse){#gfq-01-panel[data-theme=sf] .gfq-side{background:var(--indd)}#gfq-01-panel[data-theme=school] .gfq-side{background:var(--ind)}#gfq-01-panel:is([data-theme=sf],[data-theme=school]) .gfq-tab-l{background:none;border:0;clip-path:none;box-shadow:none;color:#e8eef6}#gfq-01-panel:is([data-theme=sf],[data-theme=school]) .gfq-tabs button.primary .gfq-tab-l{background:none;color:#fff;box-shadow:none}#gfq-01-panel[data-theme=school] .gfq-tab-ic{border-color:#fff;background:transparent;color:#fff}#gfq-01-panel[data-theme=school] .gfq-tabs button.primary .gfq-tab-ic{background:var(--mark);transform:none}#gfq-01-panel:is([data-theme=east],[data-theme=fantasy],[data-theme=sf],[data-theme=school]) .gfq-tabs{padding:0;gap:3px}#gfq-01-panel:is([data-theme=east],[data-theme=fantasy],[data-theme=sf],[data-theme=school]) .gfq-tabs button,#gfq-01-panel:is([data-theme=east],[data-theme=fantasy],[data-theme=sf],[data-theme=school]) .gfq-tabs button.primary,#gfq-01-panel:is([data-theme=east],[data-theme=fantasy],[data-theme=sf],[data-theme=school]) .gfq-tabs button:hover{flex:1 1 0;min-width:0;flex-direction:column;margin:0;padding:2px 0}#gfq-01-panel:is([data-theme=east],[data-theme=fantasy],[data-theme=sf],[data-theme=school]) .gfq-tab-ic{width:28px;height:26px;border:0}#gfq-01-panel:is([data-theme=east],[data-theme=fantasy],[data-theme=sf],[data-theme=school]) .gfq-tab-l{padding:0 0 3px;letter-spacing:0;font-size:11px;text-align:center}#gfq-01-panel[data-theme=fantasy] .gfq-main{margin:0;border-radius:0}#gfq-01-panel[data-theme=fantasy] .gfq-side{background:#2b2119}#gfq-01-panel[data-theme=fantasy] .gfq-tabs button,#gfq-01-panel[data-theme=fantasy] .gfq-tabs button.primary{margin:0;border-radius:10px 10px 0 0;border:1px solid #a68b5f;border-bottom:0;padding:0}#gfq-01-panel[data-theme=fantasy] .gfq-tabs button.primary::before{display:none}#gfq-01-panel[data-theme=east] .gfq-tabs{padding:0}#gfq-01-panel[data-theme=east] .gfq-tab-ic{border-right:0}}
/* v0.7.5 동양: 두루마리. 본문은 좌우 나무 축에 감긴 가로 두루마리, 큰 카드는 위아래 축이 달린 족자 */
@media(max-width:760px),(max-height:500px) and (orientation:landscape) and (pointer:coarse){#gfq-01-panel[data-theme=east] .gfq-main{padding:0 26px 28px;background-size:10px 100%,10px 100%,6px 100%,6px 100%,auto,auto,100% 160px,auto}#gfq-01-panel[data-theme=east] .gfq-top{margin:0 -12px 14px;padding:10px 12px 19px}#gfq-01-panel[data-theme=east] :is(.gfq-qdetail,.gfq-ticket,.gfq-dossier,.gfq-placecard,.gfq-cal)::before,#gfq-01-panel[data-theme=east] :is(.gfq-qdetail,.gfq-ticket,.gfq-dossier,.gfq-placecard,.gfq-cal)::after{left:-8px;right:-8px}}
/* v0.7.6 동양: 절제된 두루마리. 종이와 먹이 바탕, 금선은 가늘게, 붉은색은 낙관에만. 색조 3가지(수묵·청화백자·청자) */
#gfq-01-panel[data-theme=east]{--paper:#efece6;--paper2:#f4f1ea;--card:#faf8f4;--card2:#fcfbf8;--hi:#fffefc;--ink:#262523;--sub:#76716a;--line:#dbd4c7;--ind:#2b2a28;--ind2:#45433f;--indd:#1b1a19;--deep:#1b1a19;--acc:#a8392c;--gold:#b39c6e;--mark:#a8392c;--onacc:#e8e3d9;--board:#f3f0ea;--hatch1:#e2ddd2;--hatch2:#ece8df;--red:#a8392c;--side:#f4f1ea;--side-fg:#2b2a28;--wood:linear-gradient(90deg,#0b0b0b,#2e2c29 35%,#4a4640 50%,#24221f 70%,#0b0b0b);--woodv:linear-gradient(180deg,#0b0b0b,#2e2c29 35%,#4a4640 50%,#24221f 70%,#0b0b0b);--mist:%23262523}
#gfq-01-panel[data-theme=east][data-tone=porcelain]{--paper:#eef0ef;--paper2:#f5f6f5;--card:#fbfcfb;--card2:#fdfefd;--ink:#1d2330;--sub:#6b7280;--line:#d3d8df;--ind:#1f3f6e;--ind2:#2f5a94;--indd:#142b4d;--deep:#142b4d;--gold:#a7adb8;--side:#f5f6f5;--side-fg:#1f3f6e;--onacc:#dbe4f2;--board:#f3f5f6;--wood:linear-gradient(90deg,#0b1424,#203556 35%,#3b5580 50%,#1a2c49 70%,#0b1424);--woodv:linear-gradient(180deg,#0b1424,#203556 35%,#3b5580 50%,#1a2c49 70%,#0b1424)}
#gfq-01-panel[data-theme=east][data-tone=celadon]{--paper:#e9ede7;--paper2:#eef2ec;--card:#f7f9f5;--card2:#fbfcfa;--ink:#22302a;--sub:#6c7a72;--line:#cfd8d0;--ind:#4e7466;--ind2:#678f80;--indd:#2f4a40;--deep:#2f4a40;--gold:#a88a55;--side:#eef2ec;--side-fg:#2f4a40;--onacc:#dce8e1;--board:#f0f3ee;--wood:linear-gradient(90deg,#1c140d,#4a3726 35%,#6e5539 50%,#3d2d1f 70%,#1c140d);--woodv:linear-gradient(180deg,#1c140d,#4a3726 35%,#6e5539 50%,#3d2d1f 70%,#1c140d)}
#gfq-01-panel[data-theme=east] .gfq-main{padding:0 48px 40px;background:var(--wood) left top/14px 100% no-repeat,var(--wood) right top/14px 100% no-repeat,linear-gradient(90deg,#0000001a,transparent 7px) 14px 0/8px 100% no-repeat,linear-gradient(270deg,#0000001a,transparent 7px) calc(100% - 14px) 0/8px 100% no-repeat,radial-gradient(circle at 84% 130px,transparent 0 92px,color-mix(in srgb,var(--gold) 45%,transparent) 93px 93.6px,transparent 94.5px),url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 240' preserveAspectRatio='none'%3E%3Cdefs%3E%3ClinearGradient id='a' x1='0' y1='0' x2='0' y2='1'%3E%3Cstop offset='0' stop-color='%23262523' stop-opacity='.13'/%3E%3Cstop offset='1' stop-color='%23262523' stop-opacity='0'/%3E%3C/linearGradient%3E%3C/defs%3E%3Cpath d='M0 240V150c50-8 80-80 135-74s60 52 105 40 70-96 130-84 70 70 118 62 84-46 132-34 76 40 180 44V240z' fill='url(%23a)'/%3E%3Cpath d='M0 240v-52c60 0 100-36 160-30s84 30 146 24 110-50 186-38 120 36 308 30V240z' fill='%23262523' fill-opacity='.05'/%3E%3C/svg%3E") left bottom/100% 200px no-repeat,var(--paper)}
#gfq-01-panel[data-theme=east] .gfq-side{background:var(--side);border-right:1px solid var(--line);box-shadow:inset -1px 0 0 var(--hi)}
#gfq-01-panel[data-theme=east] .gfq-brand{color:var(--side-fg)}
#gfq-01-panel[data-theme=east] .gfq-brand small{color:var(--sub)}
#gfq-01-panel[data-theme=east] .gfq-brand-mark{border-color:var(--side-fg);box-shadow:inset 0 0 0 4px var(--side),inset 0 0 0 7px var(--acc)}
#gfq-01-panel[data-theme=east] .gfq-tabs{gap:4px;padding:0 16px}
#gfq-01-panel[data-theme=east] .gfq-tabs button{position:relative;gap:0;border:0;border-bottom:1px solid var(--line);background:transparent}
#gfq-01-panel[data-theme=east] .gfq-tab-ic{width:38px;height:42px;background:transparent;border:0;color:var(--sub);box-shadow:none}
#gfq-01-panel[data-theme=east] .gfq-tab-l{margin:0;clip-path:none;background:transparent;border:0;color:var(--side-fg);text-decoration:none;padding:10px 8px;letter-spacing:.32em;font:600 15px/1.2 var(--serif)}
#gfq-01-panel[data-theme=east] .gfq-tabs button:hover:not(:disabled) .gfq-tab-l{color:var(--ind2)}
#gfq-01-panel[data-theme=east] .gfq-tabs button.primary{background:var(--ind);border-bottom-color:var(--ind)}
#gfq-01-panel[data-theme=east] .gfq-tabs button.primary:hover:not(:disabled){background:var(--ind)}
#gfq-01-panel[data-theme=east] .gfq-tabs button.primary .gfq-tab-ic{background:transparent;color:var(--onacc);transform:none;box-shadow:none}
#gfq-01-panel[data-theme=east] .gfq-tabs button.primary .gfq-tab-l,#gfq-01-panel[data-theme=east] .gfq-tabs button.primary:hover:not(:disabled) .gfq-tab-l{background:transparent;color:var(--hi);box-shadow:none}
#gfq-01-panel[data-theme=east] .gfq-tabs button.primary::after{content:"";position:absolute;right:10px;top:50%;width:9px;height:9px;margin-top:-5px;background:var(--acc);border-radius:1px}
#gfq-01-panel[data-theme=east] .gfq-side-foot{background:var(--card);border:0;border-top:1px solid var(--gold);border-bottom:1px solid var(--gold);box-shadow:none;border-radius:0;margin:auto 16px 0}
#gfq-01-panel[data-theme=east] .gfq-top{margin:0 -34px 24px;padding:18px 34px 16px;border-bottom:0;box-shadow:none;background:linear-gradient(var(--paper),var(--paper)) top/100% calc(100% - 5px) no-repeat,linear-gradient(var(--gold),var(--gold)) 0 calc(100% - 4px)/100% 1px no-repeat,linear-gradient(var(--gold),var(--gold)) 0 100%/100% 1px no-repeat;background-color:transparent}
#gfq-01-panel[data-theme=east] .gfq-top h2{color:var(--ink);border-left:0;padding-left:0;letter-spacing:.34em;font-weight:700}
#gfq-01-panel[data-theme=east] .gfq-top h2::after{content:"";display:inline-block;width:14px;height:14px;margin-left:6px;vertical-align:4px;background:var(--acc);border-radius:2px;box-shadow:inset 0 0 0 2px var(--acc),inset 0 0 0 3px #ffffffaa}
#gfq-01-panel[data-theme=east] h3{color:var(--ink);letter-spacing:.14em}
#gfq-01-panel[data-theme=east] .gfq-items-head h3::before{content:"";display:inline-block;width:3px;height:14px;margin-right:10px;background:var(--ind);vertical-align:-1px}
#gfq-01-panel[data-theme=east] :is(.gfq-card,.gfq-dossier,.gfq-ticket,.gfq-placecard,.gfq-cal,.gfq-chcard,.gfq-receipt,.gfq-qdetail){border:1px solid var(--line);border-radius:0;box-shadow:0 1px 0 var(--hi) inset,0 10px 24px -14px #00000040;background-color:var(--card)}
#gfq-01-panel[data-theme=east] .gfq-card::before{width:2px;background:var(--ind)}
#gfq-01-panel[data-theme=east] button{border-radius:0;border-color:var(--line);background:var(--card);color:var(--ink)}
#gfq-01-panel[data-theme=east] button:hover:not(:disabled):not(.on):not([aria-pressed=true]):not(.primary){background:var(--hi);border-color:var(--gold)}
#gfq-01-panel[data-theme=east] button.primary{background:var(--ind);border-color:var(--ind);color:var(--hi);letter-spacing:.08em}
#gfq-01-panel[data-theme=east] button.primary:hover:not(:disabled){background:var(--ind2);border-color:var(--ind2)}
#gfq-01-panel[data-theme=east] .gfq-drop summary{border-color:var(--line);box-shadow:none;background:var(--card)}#gfq-01-panel[data-theme=east] .gfq-drop-k{background:var(--ind)}
#gfq-01-panel[data-theme=east] .gfq-seg{border-color:var(--line);background:var(--card)}#gfq-01-panel[data-theme=east] .gfq-seg button[aria-pressed=true]{background:var(--ind);color:var(--hi)}
#gfq-01-panel[data-theme=east] .gfq-qitem{border-color:var(--line);box-shadow:none}
#gfq-01-panel[data-theme=east] .gfq-qitem.on{background:var(--ind);border-color:var(--ind);color:var(--hi);box-shadow:inset 3px 0 0 var(--acc)}
#gfq-01-panel[data-theme=east] .gfq-qitem.on:hover:not(:disabled){background:var(--ind2)}
#gfq-01-panel[data-theme=east] .gfq-qitem.on .gfq-pips i.on{background:var(--hi)}
#gfq-01-panel[data-theme=east] .gfq-pips i.on{background:var(--ind)}
#gfq-01-panel[data-theme=east] .gfq-qhead{background:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 600 120' preserveAspectRatio='none'%3E%3Cpath d='M0 120V84c40-6 60-46 100-40s40 30 80 22 50-60 100-50 50 46 90 40 70-26 110-18 70 22 120 26V120z' fill='%23000000' fill-opacity='.05'/%3E%3C/svg%3E") left bottom/100% 80% no-repeat,var(--card2);color:var(--ink);border-top:0;border-bottom:1px solid var(--line)}
#gfq-01-panel[data-theme=east] .gfq-qhead::after{background:radial-gradient(circle,transparent 0 58px,color-mix(in srgb,var(--gold) 50%,transparent) 59px 59.6px,transparent 60.5px);right:-10px;top:-40px;width:180px;height:180px}
#gfq-01-panel[data-theme=east] .gfq-qhead h3{color:var(--ink);text-shadow:none;letter-spacing:.08em}
#gfq-01-panel[data-theme=east] .gfq-qplace{color:var(--ind)}#gfq-01-panel[data-theme=east] .gfq-qplace:hover:not(:disabled){color:var(--acc)}
#gfq-01-panel[data-theme=east] .gfq-qmeta{color:var(--sub)}#gfq-01-panel[data-theme=east] .gfq-qmeta i{background:var(--gold)}
#gfq-01-panel[data-theme=east] .gfq-qcrest{clip-path:none;border-radius:50%;width:76px;height:76px;background:transparent;border:1px solid var(--gold);box-shadow:inset 0 0 0 4px var(--card2),inset 0 0 0 5px color-mix(in srgb,var(--gold) 60%,transparent)}
#gfq-01-panel[data-theme=east] .gfq-qcrest span{color:var(--ind);letter-spacing:.14em}
#gfq-01-panel[data-theme=east] .gfq-obj-mark{border-color:var(--ind)}#gfq-01-panel[data-theme=east] .gfq-obj.on .gfq-obj-mark{background:var(--ind)}
#gfq-01-panel[data-theme=east] .gfq-rw-row{border-left:2px solid var(--ind);background:var(--card2)}
#gfq-01-panel[data-theme=east] .gfq-rw-row.cond{border-left:2px dashed var(--line)}
#gfq-01-panel[data-theme=east] .gfq-rw-ic,#gfq-01-panel[data-theme=east] .gfq-rw-tile .gfq-ico{color:var(--ind)}
#gfq-01-panel[data-theme=east] .gfq-rw-tile{background:var(--card2);border-color:var(--line)}
#gfq-01-panel[data-theme=east] :is(.gfq-qdetail,.gfq-ticket,.gfq-dossier,.gfq-placecard,.gfq-cal){position:relative;margin-top:12px;margin-bottom:12px;overflow:visible}
#gfq-01-panel[data-theme=east] :is(.gfq-qdetail,.gfq-ticket,.gfq-dossier,.gfq-placecard,.gfq-cal)::before,#gfq-01-panel[data-theme=east] :is(.gfq-qdetail,.gfq-ticket,.gfq-dossier,.gfq-placecard,.gfq-cal)::after{content:"";position:absolute;z-index:4;left:-9px;right:-9px;height:9px;border-radius:5px;background:radial-gradient(circle at 4.5px 50%,var(--gold) 0 3px,transparent 3.5px),radial-gradient(circle at calc(100% - 4.5px) 50%,var(--gold) 0 3px,transparent 3.5px),var(--woodv);box-shadow:0 2px 3px #0003;pointer-events:none}
#gfq-01-panel[data-theme=east] :is(.gfq-qdetail,.gfq-ticket,.gfq-dossier,.gfq-placecard,.gfq-cal)::before{top:-6px}
#gfq-01-panel[data-theme=east] :is(.gfq-qdetail,.gfq-ticket,.gfq-dossier,.gfq-placecard,.gfq-cal)::after{bottom:-6px}
#gfq-01-panel[data-theme=east] .gfq-ticket{border-radius:0}
#gfq-01-panel[data-theme=east] .gfq-tk-stub{background:var(--ind)}
#gfq-01-panel[data-theme=east] .gfq-photo{border:1px solid var(--line);padding:8px;transform:none;box-shadow:none;background:var(--hi)}
#gfq-01-panel[data-theme=east] .gfq-photo::after{content:"";top:auto;bottom:-10px;left:auto;right:-10px;width:28px;height:28px;margin:0;background:var(--acc);border-radius:2px;transform:rotate(-4deg);box-shadow:inset 0 0 0 2px var(--acc),inset 0 0 0 3px #ffffffaa}
#gfq-01-panel[data-theme=east] .gfq-tk-name{letter-spacing:.1em}
#gfq-01-panel[data-theme=east] .gfq-cash b{color:var(--ink)!important}
#gfq-01-panel[data-theme=east] .gfq-rings i.on{background:var(--ind);border-color:var(--ind)}
#gfq-01-panel[data-theme=east] .gfq-stamp{border:1px solid var(--acc);color:var(--acc);border-radius:2px;background:transparent;transform:none}
#gfq-01-panel[data-theme=east] .gfq-receipt{margin-top:10px;border-left:0;border-right:0;border-top:8px solid transparent;border-bottom:8px solid transparent;border-image:var(--woodv) 8 0;background:var(--card2)}
#gfq-01-panel[data-theme=east] .gfq-receipt::after{display:none}
#gfq-01-panel[data-theme=east] .gfq-rc-total{background:var(--ind);color:var(--hi)}#gfq-01-panel[data-theme=east] .gfq-rc-total span::before{color:var(--gold)}
#gfq-01-panel[data-theme=east] .gfq-slot{border-color:var(--line);background:var(--card)}
#gfq-01-panel[data-theme=east] .gfq-slot.on{background:var(--ind);border:2px solid var(--gold);box-shadow:none}
#gfq-01-panel[data-theme=east] .gfq-glyph{color:var(--ind)}
#gfq-01-panel[data-theme=east] .gfq-badge{background:var(--acc);color:#fff;border-color:var(--hi)}
#gfq-01-panel[data-theme=east] .gfq-board{background:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 240' preserveAspectRatio='none'%3E%3Cpath d='M0 240V160c60-10 90-70 150-62s70 48 120 38 80-90 150-78 80 64 130 56 90-40 200 0V240z' fill='%23000000' fill-opacity='.05'/%3E%3C/svg%3E") left bottom/100% 40% no-repeat,var(--board);border-color:var(--line)}
#gfq-01-panel[data-theme=east] .gfq-board::before,#gfq-01-panel[data-theme=east] .gfq-board::after{border-color:var(--gold)}
#gfq-01-panel[data-theme=east] .gfq-route polyline{stroke:var(--ind)}
#gfq-01-panel[data-theme=east] .gfq-pin-text b{color:var(--ind)}
#gfq-01-panel[data-theme=east] .gfq-pinbox.on .gfq-pin-text{background:var(--ind);border-color:var(--ind)}
#gfq-01-panel[data-theme=east] .gfq-chno{background:var(--ind)}
#gfq-01-panel[data-theme=east] .gfq-cal-day.today{box-shadow:inset 0 0 0 1px var(--ind)}
#gfq-01-panel[data-theme=east] .gfq-cal-day i.k-chapter{background:var(--ind)}
#gfq-01-panel[data-theme=east] .gfq-face.on{border-color:var(--gold);box-shadow:0 0 0 1px var(--ind)}
@media(max-width:760px),(max-height:500px) and (orientation:landscape) and (pointer:coarse){#gfq-01-panel[data-theme=east] .gfq-side{background:var(--side);border-bottom:1px solid var(--line)}#gfq-01-panel[data-theme=east] .gfq-tabs button{border-bottom:0}#gfq-01-panel[data-theme=east] .gfq-tabs button.primary::after{display:none}#gfq-01-panel[data-theme=east] .gfq-main{padding:0 22px 28px;background-size:8px 100%,8px 100%,5px 100%,5px 100%,auto,100% 160px,auto}#gfq-01-panel[data-theme=east] .gfq-top{margin:0 -10px 14px;padding:10px 10px 14px}#gfq-01-panel[data-theme=east] :is(.gfq-qdetail,.gfq-ticket,.gfq-dossier,.gfq-placecard,.gfq-cal)::before,#gfq-01-panel[data-theme=east] :is(.gfq-qdetail,.gfq-ticket,.gfq-dossier,.gfq-placecard,.gfq-cal)::after{left:-6px;right:-6px}}
/* v0.7.6 두루마리 장식(참고: 칠일 출석 두루마리). 수묵 색조는 먹회색·살구빛 종이·금 */
#gfq-01-panel[data-theme=east][data-tone=ink]{--paper:#efe8e1;--paper2:#f4efe9;--card:#f8f3ed;--card2:#fbf8f4;--hi:#fffdfb;--ink:#2a2b30;--sub:#7d7570;--line:#ddd0c4;--ind:#3a3d44;--ind2:#50545d;--indd:#25272c;--deep:#25272c;--gold:#c4a26a;--acc:#b0473a;--side:#f4efe9;--side-fg:#3a3d44;--onacc:#efe3cf;--board:#f4eee8;--wood:linear-gradient(90deg,#16171a,#3a3d44 35%,#5d616b 50%,#33363c 70%,#16171a);--woodv:linear-gradient(180deg,#16171a,#3a3d44 35%,#5d616b 50%,#33363c 70%,#16171a)}
#gfq-01-panel[data-theme=east] .gfq-main{padding:0 52px 40px;background:
 linear-gradient(var(--gold),var(--gold)) 0 0/18px 8px no-repeat,linear-gradient(var(--gold),var(--gold)) 0 100%/18px 8px no-repeat,linear-gradient(var(--gold),var(--gold)) 100% 0/18px 8px no-repeat,linear-gradient(var(--gold),var(--gold)) 100% 100%/18px 8px no-repeat,
 linear-gradient(var(--gold),var(--gold)) 18px 0/1px 100% no-repeat,linear-gradient(var(--gold),var(--gold)) calc(100% - 18px) 0/1px 100% no-repeat,
 var(--wood) left top/18px 100% no-repeat,var(--wood) right top/18px 100% no-repeat,
 linear-gradient(90deg,#0000001f,transparent 9px) 19px 0/10px 100% no-repeat,linear-gradient(270deg,#0000001f,transparent 9px) calc(100% - 19px) 0/10px 100% no-repeat,
 radial-gradient(ellipse 7px 4px at 78% 22%,#e3a99e88,transparent),radial-gradient(ellipse 5px 3px at 82% 30%,#e3a99e66,transparent),radial-gradient(ellipse 6px 3px at 12% 70%,#e3a99e55,transparent),radial-gradient(ellipse 5px 3px at 64% 86%,#e3a99e55,transparent),
 radial-gradient(ellipse 60% 50% at 70% 40%,#f3dcd055,transparent 70%),
 url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 240' preserveAspectRatio='none'%3E%3Cdefs%3E%3ClinearGradient id='a' x1='0' y1='0' x2='0' y2='1'%3E%3Cstop offset='0' stop-color='%233a3d44' stop-opacity='.14'/%3E%3Cstop offset='1' stop-color='%233a3d44' stop-opacity='0'/%3E%3C/linearGradient%3E%3C/defs%3E%3Cpath d='M0 240V150c50-8 80-80 135-74s60 52 105 40 70-96 130-84 70 70 118 62 84-46 132-34 76 40 180 44V240z' fill='url(%23a)'/%3E%3C/svg%3E") left bottom/100% 200px no-repeat,var(--paper)}
#gfq-01-panel[data-theme=east] .gfq-top{margin:0 -34px 26px;padding:18px 34px 26px;background:linear-gradient(var(--paper),var(--paper)) top/100% calc(100% - 13px) no-repeat,linear-gradient(var(--gold),var(--gold)) 0 calc(100% - 12px)/100% 1px no-repeat,linear-gradient(var(--ind),var(--ind)) 0 100%/100% 10px no-repeat,linear-gradient(var(--gold),var(--gold)) 0 calc(100% - 4px)/100% 1px no-repeat}
#gfq-01-panel[data-theme=east] .gfq-tabs button.primary{background:var(--ind);box-shadow:inset 0 0 0 3px var(--ind),inset 0 0 0 4px color-mix(in srgb,var(--gold) 75%,transparent)}
#gfq-01-panel[data-theme=east] .gfq-tabs button.primary::after{display:none}
#gfq-01-panel[data-theme=east] .gfq-tabs button.primary .gfq-tab-l{color:#f3e6cf}
#gfq-01-panel[data-theme=east] button.primary{background:var(--ind);border:1px solid var(--gold);color:#f3e6cf;box-shadow:inset 0 0 0 2px var(--ind),inset 0 0 0 3px color-mix(in srgb,var(--gold) 70%,transparent);font-family:var(--serif);letter-spacing:.18em}
#gfq-01-panel[data-theme=east] button.primary:hover:not(:disabled){background:var(--ind2);border-color:var(--gold)}
#gfq-01-panel[data-theme=east] .gfq-qfoot .primary{padding:12px 28px;min-width:180px}
#gfq-01-panel[data-theme=east] .gfq-qitem.on{background:var(--ind);box-shadow:inset 0 0 0 3px var(--ind),inset 0 0 0 4px color-mix(in srgb,var(--gold) 70%,transparent)}
#gfq-01-panel[data-theme=east] .gfq-qhead{background:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 600 120' preserveAspectRatio='none'%3E%3Cpath d='M0 120V84c40-6 60-46 100-40s40 30 80 22 50-60 100-50 50 46 90 40 70-26 110-18 70 22 120 26V120z' fill='%23ffffff' fill-opacity='.06'/%3E%3C/svg%3E") left bottom/100% 80% no-repeat,linear-gradient(120deg,var(--ind),var(--indd));color:#f3e6cf;border-bottom:1px solid var(--gold);box-shadow:inset 0 0 0 5px var(--ind),inset 0 0 0 6px color-mix(in srgb,var(--gold) 70%,transparent)}
#gfq-01-panel[data-theme=east] .gfq-qhead::after{background:radial-gradient(circle,transparent 0 58px,color-mix(in srgb,var(--gold) 40%,transparent) 59px 59.6px,transparent 60.5px)}
#gfq-01-panel[data-theme=east] .gfq-qhead h3{color:#f6ede2}
#gfq-01-panel[data-theme=east] .gfq-qplace{color:var(--gold)}#gfq-01-panel[data-theme=east] .gfq-qplace:hover:not(:disabled){color:#f6ede2}
#gfq-01-panel[data-theme=east] .gfq-qmeta{color:#cfc4b8}#gfq-01-panel[data-theme=east] .gfq-qmeta i{background:var(--gold)}
#gfq-01-panel[data-theme=east] .gfq-qcrest{position:relative;width:46px;height:100px;border-radius:0;margin:10px 6px 0;background:var(--card);border:1px solid var(--gold);box-shadow:inset 0 0 0 3px var(--card),inset 0 0 0 4px color-mix(in srgb,var(--gold) 70%,transparent)}
#gfq-01-panel[data-theme=east] .gfq-qcrest::before{content:"";position:absolute;left:50%;top:-14px;width:1px;height:14px;background:var(--gold)}
#gfq-01-panel[data-theme=east] .gfq-qcrest span{writing-mode:vertical-rl;color:var(--acc);font-size:18px;letter-spacing:.4em}
#gfq-01-panel[data-theme=east] .gfq-slots,#gfq-01-panel[data-theme=east] .gfq-faces{row-gap:34px;padding-top:22px;background:linear-gradient(color-mix(in srgb,var(--ind) 45%,transparent),color-mix(in srgb,var(--ind) 45%,transparent)) 0 6px/100% 1px no-repeat}
#gfq-01-panel[data-theme=east] :is(.gfq-slot,.gfq-face){position:relative;overflow:visible;border:1px solid var(--line);border-top:0;background:linear-gradient(var(--ind),var(--ind)) top/100% 10px no-repeat,linear-gradient(var(--gold),var(--gold)) 0 10px/100% 1px no-repeat,radial-gradient(circle at 0 100%,transparent 9px,var(--gold) 9.5px 10.5px,transparent 11px) left bottom/22px 22px no-repeat,radial-gradient(circle at 100% 100%,transparent 9px,var(--gold) 9.5px 10.5px,transparent 11px) right bottom/22px 22px no-repeat,linear-gradient(180deg,var(--card),#efe3da)}
#gfq-01-panel[data-theme=east] .gfq-slot{padding-top:22px}
#gfq-01-panel[data-theme=east] .gfq-slot::before,#gfq-01-panel[data-theme=east] .gfq-face::before{content:"";position:absolute;top:-16px;left:50%;width:1px;height:16px;margin:0;border-radius:0;background:color-mix(in srgb,var(--ind) 60%,transparent);box-shadow:none}
#gfq-01-panel[data-theme=east] .gfq-face::after{content:"";position:absolute;top:-19px;left:50%;width:5px;height:5px;margin-left:-2px;border-radius:50%;background:var(--ind)}
#gfq-01-panel[data-theme=east] :is(.gfq-slot,.gfq-face):hover:not(:disabled){background:linear-gradient(var(--ind),var(--ind)) top/100% 10px no-repeat,linear-gradient(var(--gold),var(--gold)) 0 10px/100% 1px no-repeat,linear-gradient(180deg,var(--hi),#f4e9e1)}
#gfq-01-panel[data-theme=east] .gfq-slot.on,#gfq-01-panel[data-theme=east] .gfq-slot.on:hover:not(:disabled){background:linear-gradient(var(--gold),var(--gold)) top/100% 10px no-repeat,linear-gradient(160deg,var(--ind),var(--indd));border:1px solid var(--gold);border-top:0;box-shadow:inset 0 0 0 3px var(--ind),inset 0 0 0 4px color-mix(in srgb,var(--gold) 60%,transparent)}
#gfq-01-panel[data-theme=east] .gfq-slot.on::after{content:"";position:absolute;bottom:-26px;left:50%;width:16px;height:26px;margin-left:-8px;background:radial-gradient(circle at 50% 5px,var(--gold) 0 4px,transparent 4.5px),linear-gradient(var(--gold),var(--gold)) 7px 9px/2px 17px no-repeat,linear-gradient(var(--gold),var(--gold)) 4px 12px/1px 14px no-repeat,linear-gradient(var(--gold),var(--gold)) 11px 12px/1px 14px no-repeat}
#gfq-01-panel[data-theme=east] .gfq-face.on{border:1px solid var(--gold);border-top:0;box-shadow:0 0 0 1px var(--ind)}
#gfq-01-panel[data-theme=east] .gfq-face .gfq-face-img{margin-top:11px}
#gfq-01-panel[data-theme=east] .gfq-seg button[aria-pressed=true]{box-shadow:inset 0 0 0 2px var(--ind),inset 0 0 0 3px color-mix(in srgb,var(--gold) 60%,transparent)}
#gfq-01-panel[data-theme=east] .gfq-rc-total{box-shadow:inset 0 0 0 3px var(--ind),inset 0 0 0 4px color-mix(in srgb,var(--gold) 60%,transparent)}
@media(max-width:760px),(max-height:500px) and (orientation:landscape) and (pointer:coarse){#gfq-01-panel[data-theme=east] .gfq-main{padding:0 24px 28px;background-size:9px 6px,9px 6px,9px 6px,9px 6px,1px 100%,1px 100%,9px 100%,9px 100%,5px 100%,5px 100%,auto,auto,auto,auto,auto,100% 150px,auto}#gfq-01-panel[data-theme=east] .gfq-main{background-position:0 0,0 100%,100% 0,100% 100%,9px 0,calc(100% - 9px) 0,left top,right top,10px 0,calc(100% - 10px) 0}#gfq-01-panel[data-theme=east] .gfq-top{margin:0 -10px 16px;padding:10px 10px 22px}}
#gfq-01-panel[data-theme=east] :is(.gfq-link,.gfq-qplace),#gfq-01-panel[data-theme=east] :is(.gfq-link,.gfq-qplace):hover:not(:disabled){background:none;border:0}
@media(max-width:760px),(max-height:500px) and (orientation:landscape) and (pointer:coarse){#gfq-01-panel[data-theme=east] .gfq-tabs{padding:0;gap:3px}#gfq-01-panel[data-theme=east] .gfq-tabs button{flex:1 1 0;min-width:0}#gfq-01-panel[data-theme=east] .gfq-tab-ic{width:28px;height:26px}#gfq-01-panel[data-theme=east] .gfq-tab-l{padding:0 0 3px;letter-spacing:0;font-size:11px}#gfq-01-panel[data-theme=east] .gfq-top h2{letter-spacing:.12em}}
#gfq-01-panel .gfq-aka{font-size:11px;color:var(--sub);font-weight:500;border-bottom:1px dotted var(--line);cursor:help}
#gfq-01-panel .gfq-meter{height:8px;border-radius:4px;background:var(--line);overflow:hidden;margin:8px 0 4px}
#gfq-01-panel .gfq-meter i{display:block;height:100%;background:var(--acc)}
#gfq-01-panel .gfq-meter.hot i{background:#b4462f}
#gfq-01-panel .gfq-qform{display:flex;flex-direction:column;gap:10px;padding:20px 24px}
#gfq-01-panel .gfq-qform h3{margin:0 0 4px}
#gfq-01-panel .gfq-qform .gfq-qfoot{margin:6px -24px -20px;padding:12px 24px}
#gfq-01-panel .gfq-qform label{display:flex;flex-direction:column;gap:4px;font-size:13px;font-weight:600}
#gfq-01-panel .gfq-qform input,#gfq-01-panel .gfq-qform select,#gfq-01-panel .gfq-qform textarea{font:inherit;font-weight:400;padding:6px 8px;border:1px solid var(--line);border-radius:4px;background:var(--card,#fff);color:inherit;min-width:0}
#gfq-01-panel .gfq-qf-del input{width:auto;padding:0;margin:0}
#gfq-01-panel .gfq-qf-h{font-size:13px;font-weight:600;margin-top:4px}
#gfq-01-panel .gfq-qf-rw{display:grid;grid-template-columns:76px minmax(0,1fr) 92px 50px 100px auto;gap:6px;align-items:center}
#gfq-01-panel .gfq-qf-del{flex-direction:row!important;align-items:center;justify-content:flex-start;gap:4px!important;font-weight:400!important;white-space:nowrap}
#gfq-01-panel .gfq-editrow{margin-top:10px;gap:6px;flex-wrap:wrap}
@media (max-width:640px){#gfq-01-panel .gfq-qf-rw{grid-template-columns:1fr 1fr;padding:6px 0;border-bottom:1px dashed var(--line)}#gfq-01-panel .gfq-qf-rw [data-f=name]{grid-column:1/-1;order:-1}#gfq-01-panel .gfq-qform{padding:16px}#gfq-01-panel .gfq-qform .gfq-qfoot{margin:6px -16px -16px;padding:12px 16px}}
#gfq-01-panel .gfq-store-parts{display:flex;flex-wrap:wrap;gap:4px 12px;font-size:12px;color:var(--sub);margin:4px 0 8px}
/* v0.10.1 SF: dark HUD. Charcoal panels, thin outlines with cut corners, cyan corner brackets, amber only for amounts. */
#gfq-01-panel[data-theme=sf]{--paper:#16191d;--paper2:#111316;--card:#1d2126;--card2:#22272d;--hi:#2a3037;--ink:#dbe3e9;--sub:#8995a0;--line:#39434c;--ind:#164b58;--ind2:#1d6274;--indd:#0b0e11;--mark:#3fd3e6;--amb:#e6b24a;--onacc:#c5f1f7;--board:#1a1e23;--hatch1:#21272d;--hatch2:#1b2025;--red:#e3735d;--grn:#58c793;--serif:"Bahnschrift","DIN Alternate","Roboto Condensed","Pretendard","Noto Sans KR",sans-serif;color:var(--ink);color-scheme:dark;background:var(--paper)}
#gfq-01-panel[data-theme=sf] .gfq-main{background:linear-gradient(#ffffff07 1px,transparent 1px) 0 0/24px 24px,linear-gradient(90deg,#ffffff07 1px,transparent 1px) 0 0/24px 24px,var(--paper)}
#gfq-01-panel[data-theme=sf] .gfq-side{background:repeating-linear-gradient(0deg,transparent 0 23px,#ffffff08 23px 24px) right 10px top 0/6px 100% no-repeat,var(--paper2);border-right:1px solid var(--line)}
#gfq-01-panel[data-theme=sf] .gfq-brand-mark{border-color:var(--mark)}
#gfq-01-panel[data-theme=sf] .gfq-top{border-bottom:1px solid var(--line);box-shadow:none;background:linear-gradient(var(--mark),var(--mark)) 0 100%/140px 2px no-repeat,var(--paper)}
#gfq-01-panel[data-theme=sf] .gfq-top h2{font-family:var(--cond);letter-spacing:.14em;color:var(--ink)}
/* text that used the dark accent on light paper reads in cyan on the dark HUD */
#gfq-01-panel[data-theme=sf] .gfq-cal-head h3,#gfq-01-panel[data-theme=sf] .gfq-card>.gfq-row:first-child b.gfq-fill,#gfq-01-panel[data-theme=sf] .gfq-cash b,#gfq-01-panel[data-theme=sf] .gfq-dossier h4,#gfq-01-panel[data-theme=sf] .gfq-drop-menu .gfq-drop-new,#gfq-01-panel[data-theme=sf] .gfq-empty strong,#gfq-01-panel[data-theme=sf] .gfq-face-img i,#gfq-01-panel[data-theme=sf] .gfq-facts li,#gfq-01-panel[data-theme=sf] .gfq-glyph,#gfq-01-panel[data-theme=sf] .gfq-glyph-big,#gfq-01-panel[data-theme=sf] .gfq-link,#gfq-01-panel[data-theme=sf] .gfq-link:hover:not(:disabled),#gfq-01-panel[data-theme=sf] .gfq-obj.on .gfq-num,#gfq-01-panel[data-theme=sf] .gfq-pager-n,#gfq-01-panel[data-theme=sf] .gfq-photo span,#gfq-01-panel[data-theme=sf] .gfq-pin-text b,#gfq-01-panel[data-theme=sf] .gfq-placeinfo h4,#gfq-01-panel[data-theme=sf] .gfq-plate .gfq-glyph,#gfq-01-panel[data-theme=sf] .gfq-qdetail.empty strong,#gfq-01-panel[data-theme=sf] .gfq-qemb,#gfq-01-panel[data-theme=sf] .gfq-rw-ic,#gfq-01-panel[data-theme=sf] .gfq-rw-tile .gfq-ico,#gfq-01-panel[data-theme=sf] .gfq-stamp,#gfq-01-panel[data-theme=sf] .gfq-stamp small,#gfq-01-panel[data-theme=sf] .gfq-top h2,#gfq-01-panel[data-theme=sf] h3{color:var(--mark)}
#gfq-01-panel[data-theme=sf] .gfq-route polyline{stroke:var(--mark)}
/* side navigation: outlined square icon + underlined label; the active tab is filled */
#gfq-01-panel[data-theme=sf] .gfq-tab-ic{clip-path:none;border:1px solid var(--line);border-radius:0;background:var(--card);color:var(--sub);box-shadow:none;transform:none}
#gfq-01-panel[data-theme=sf] .gfq-tab-l{clip-path:none;margin-left:0;border:0;border-bottom:1px solid var(--line);background:transparent;color:var(--ink);text-decoration:none;font-family:var(--cond);letter-spacing:.1em;box-shadow:none}
#gfq-01-panel[data-theme=sf] .gfq-tabs button:hover .gfq-tab-l{color:var(--mark);background:transparent}
#gfq-01-panel[data-theme=sf] .gfq-tabs button.primary .gfq-tab-ic{background:var(--mark);border-color:var(--mark);color:#061a1e;transform:none}
#gfq-01-panel[data-theme=sf] .gfq-tabs button.primary .gfq-tab-l{background:linear-gradient(90deg,#3fd3e61f,transparent);color:var(--mark);border-bottom:1px solid var(--mark);box-shadow:none}
#gfq-01-panel[data-theme=sf] .gfq-side-foot{--c:10px;background:linear-gradient(var(--mark),var(--mark)) 0 0/18px 2px no-repeat,linear-gradient(var(--mark),var(--mark)) 0 0/2px 18px no-repeat,linear-gradient(45deg,transparent calc(50% - 1px),var(--line) calc(50% - 1px) calc(50% + .5px),transparent calc(50% + .5px)) 100% 0/var(--c) var(--c) no-repeat,var(--card);background-origin:border-box;border:1px solid var(--line);box-shadow:none;clip-path:polygon(0 0,calc(100% - var(--c)) 0,100% var(--c),100% 100%,0 100%);color:var(--sub)}
#gfq-01-panel[data-theme=sf] .gfq-side-foot b{color:var(--ink)}
/* large frames */
#gfq-01-panel[data-theme=sf] :is(.gfq-qdetail,.gfq-ticket,.gfq-dossier,.gfq-placecard,.gfq-cal,.gfq-receipt,.gfq-castcard,.gfq-chcard,.gfq-items-body){--c:14px;background:linear-gradient(var(--mark),var(--mark)) 0 0/18px 2px no-repeat,linear-gradient(var(--mark),var(--mark)) 0 0/2px 18px no-repeat,linear-gradient(45deg,transparent calc(50% - 1px),var(--line) calc(50% - 1px) calc(50% + .5px),transparent calc(50% + .5px)) 100% 0/var(--c) var(--c) no-repeat,linear-gradient(45deg,transparent calc(50% - 1px),var(--line) calc(50% - 1px) calc(50% + .5px),transparent calc(50% + .5px)) 0 100%/var(--c) var(--c) no-repeat,var(--card);background-origin:border-box;border:1px solid var(--line);border-radius:0;box-shadow:none;clip-path:polygon(0 0,calc(100% - var(--c)) 0,100% var(--c),100% 100%,var(--c) 100%,0 calc(100% - var(--c)))}
#gfq-01-panel[data-theme=sf] .gfq-receipt::after,#gfq-01-panel[data-theme=sf] .gfq-receipt::before{display:none}
/* small frames: one cut corner, no drop shadow */
#gfq-01-panel[data-theme=sf] :is(.gfq-card,.gfq-rw-row,.gfq-rw-tile,.gfq-slot,.gfq-face,.gfq-objs,.gfq-qitem,.gfq-pinbox,.gfq-theme,.gfq-chcard){--c:8px;background-image:linear-gradient(45deg,transparent calc(50% - 1px),var(--line) calc(50% - 1px) calc(50% + .5px),transparent calc(50% + .5px));background-position:100% 0;background-size:var(--c) var(--c);background-repeat:no-repeat;background-origin:border-box;border:1px solid var(--line);border-radius:0;box-shadow:none;clip-path:polygon(0 0,calc(100% - var(--c)) 0,100% var(--c),100% 100%,0 100%)}
#gfq-01-panel[data-theme=sf] .gfq-card{background-color:var(--card)}
#gfq-01-panel[data-theme=sf] .gfq-card::before{width:2px;background:var(--mark);box-shadow:none}
#gfq-01-panel[data-theme=sf] :is(.gfq-qitem.on,.gfq-slot.on,.gfq-face.on,.gfq-theme[aria-pressed=true]){border-color:var(--mark);background-color:#3fd3e614;color:var(--ink);box-shadow:inset 3px 0 0 var(--mark)}
#gfq-01-panel[data-theme=sf] .gfq-qitem.on .gfq-qtxt b{color:var(--mark)}
/* buttons: outlined, bottom-right cut; primary is filled cyan */
#gfq-01-panel[data-theme=sf] button:not(.gfq-tabs button,.gfq-slot,.gfq-face,.gfq-qitem,.gfq-obj,.gfq-pinbox,.gfq-link,.gfq-cal-day,.gfq-theme,.gfq-seg button,.gfq-qplace,.gfq-outfits button,.gfq-drop-menu button,.gfq-close,.gfq-drop-btn,.gfq-units button){--c:7px;clip-path:polygon(0 0,100% 0,100% calc(100% - var(--c)),calc(100% - var(--c)) 100%,0 100%);border:1px solid #3fd3e688;border-radius:0;background:linear-gradient(135deg,transparent calc(50% - 1px),#3fd3e688 calc(50% - 1px) calc(50% + .5px),transparent calc(50% + .5px)) 100% 100%/var(--c) var(--c) no-repeat,transparent;background-origin:border-box;color:var(--mark);box-shadow:none;font-family:var(--cond);letter-spacing:.04em;padding-left:14px;padding-right:14px}
#gfq-01-panel[data-theme=sf] button:not(.gfq-tabs button,.gfq-slot,.gfq-face,.gfq-qitem,.gfq-obj,.gfq-pinbox,.gfq-link,.gfq-cal-day,.gfq-theme,.gfq-seg button,.gfq-qplace,.gfq-outfits button,.gfq-drop-menu button,.gfq-close,.gfq-drop-btn,.gfq-units button):hover:not(:disabled){background-color:#3fd3e61a;color:#bff4fb;border-color:var(--mark)}
#gfq-01-panel[data-theme=sf] button.primary:not(.gfq-tabs button,.gfq-slot,.gfq-face,.gfq-qitem,.gfq-obj,.gfq-pinbox,.gfq-link,.gfq-cal-day,.gfq-theme,.gfq-seg button,.gfq-qplace,.gfq-outfits button,.gfq-drop-menu button,.gfq-close,.gfq-drop-btn,.gfq-units button){background:var(--mark);border-color:var(--mark);color:#061a1e}
#gfq-01-panel[data-theme=sf] button.primary:not(.gfq-tabs button,.gfq-slot,.gfq-face,.gfq-qitem,.gfq-obj,.gfq-pinbox,.gfq-link,.gfq-cal-day,.gfq-theme,.gfq-seg button,.gfq-qplace,.gfq-outfits button,.gfq-drop-menu button,.gfq-close,.gfq-drop-btn,.gfq-units button):hover:not(:disabled){background:#7fe4f1;color:#061a1e}
#gfq-01-panel[data-theme=sf] button:is(.gfq-danger,.gfq-ghost):not(.gfq-tabs button,.gfq-slot,.gfq-face,.gfq-qitem,.gfq-obj,.gfq-pinbox,.gfq-link,.gfq-cal-day,.gfq-theme,.gfq-seg button,.gfq-qplace,.gfq-outfits button,.gfq-drop-menu button,.gfq-close,.gfq-drop-btn,.gfq-units button){color:var(--sub);border-color:var(--line)}
#gfq-01-panel[data-theme=sf] button.gfq-danger:not(.gfq-tabs button,.gfq-slot,.gfq-face,.gfq-qitem,.gfq-obj,.gfq-pinbox,.gfq-link,.gfq-cal-day,.gfq-theme,.gfq-seg button,.gfq-qplace,.gfq-outfits button,.gfq-drop-menu button,.gfq-close,.gfq-drop-btn,.gfq-units button){color:var(--red);border-color:#e3735d88}
#gfq-01-panel[data-theme=sf] .gfq-close{width:40px;height:40px;border:1px solid var(--line);border-radius:0;background:linear-gradient(var(--mark),var(--mark)) 0 0/10px 2px no-repeat,linear-gradient(var(--mark),var(--mark)) 0 0/2px 10px no-repeat,linear-gradient(var(--mark),var(--mark)) 100% 100%/10px 2px no-repeat,linear-gradient(var(--mark),var(--mark)) 100% 100%/2px 10px no-repeat,var(--card);background-origin:border-box;color:var(--ink);box-shadow:none;clip-path:none}
#gfq-01-panel[data-theme=sf] .gfq-close:hover{color:var(--mark);border-color:var(--mark)}
#gfq-01-panel[data-theme=sf] .gfq-link{color:var(--mark)}
/* filters */
#gfq-01-panel[data-theme=sf] .gfq-seg{border:1px solid var(--line);border-radius:0;background:var(--card);padding:3px}
#gfq-01-panel[data-theme=sf] .gfq-seg button{border-radius:0;color:var(--sub);background:transparent}
#gfq-01-panel[data-theme=sf] .gfq-seg button[aria-pressed=true]{background:var(--mark);color:#061a1e}
#gfq-01-panel[data-theme=sf] .gfq-seg button[aria-pressed=true] small{color:#061a1e}
/* quest detail */
#gfq-01-panel[data-theme=sf] .gfq-qhead{background:linear-gradient(90deg,#3fd3e61a,transparent 70%),var(--card2);border-bottom:1px solid var(--line);color:var(--ink)}
#gfq-01-panel[data-theme=sf] .gfq-qhead::after{display:none}
#gfq-01-panel[data-theme=sf] .gfq-qhead h3{color:var(--ink)}
#gfq-01-panel[data-theme=sf] .gfq-qcrest{--c:12px;clip-path:polygon(0 0,calc(100% - var(--c)) 0,100% var(--c),100% 100%,var(--c) 100%,0 calc(100% - var(--c)));width:76px;height:76px;border:1px solid var(--mark);border-radius:0;background:linear-gradient(45deg,transparent calc(50% - 1px),var(--mark) calc(50% - 1px) calc(50% + .5px),transparent calc(50% + .5px)) 100% 0/var(--c) var(--c) no-repeat,linear-gradient(45deg,transparent calc(50% - 1px),var(--mark) calc(50% - 1px) calc(50% + .5px),transparent calc(50% + .5px)) 0 100%/var(--c) var(--c) no-repeat,#3fd3e612;background-origin:border-box;color:var(--mark);box-shadow:none;transform:none}
#gfq-01-panel[data-theme=sf] .gfq-qcrest span{writing-mode:horizontal-tb;font-family:var(--cond);letter-spacing:.1em}
#gfq-01-panel[data-theme=sf] .gfq-qmeta,#gfq-01-panel[data-theme=sf] .gfq-qmeta i{color:var(--sub)}
#gfq-01-panel[data-theme=sf] .gfq-objs{background-color:var(--card2)}
#gfq-01-panel[data-theme=sf] .gfq-objs-h{border-bottom:1px solid var(--line);color:var(--sub)}
#gfq-01-panel[data-theme=sf] .gfq-obj{border-color:var(--line);color:var(--ink)}
#gfq-01-panel[data-theme=sf] .gfq-obj-mark{transform:none;border:1px solid var(--mark);border-radius:0;background:transparent;width:11px;height:11px}
#gfq-01-panel[data-theme=sf] .gfq-obj.on .gfq-obj-mark{background:var(--mark);box-shadow:0 0 0 2px #3fd3e633}
#gfq-01-panel[data-theme=sf] .gfq-obj.on .gfq-num{color:var(--mark)}
#gfq-01-panel[data-theme=sf] .gfq-pips i{transform:none;border-radius:0;width:12px;height:4px;background:#ffffff1f;border:0}
#gfq-01-panel[data-theme=sf] .gfq-pips i.on{background:var(--mark)}
#gfq-01-panel[data-theme=sf] .gfq-qemb{border:1px solid currentColor;border-radius:0;transform:none;clip-path:none}
#gfq-01-panel[data-theme=sf] .gfq-rw-row{background-color:var(--card2)}
#gfq-01-panel[data-theme=sf] .gfq-rw-row b.gfq-num,#gfq-01-panel[data-theme=sf] .gfq-rc-row b.gfq-num{color:var(--amb)}
#gfq-01-panel[data-theme=sf] .gfq-rw-row.cond b.gfq-num{color:var(--sub)}
#gfq-01-panel[data-theme=sf] .gfq-chip{border-radius:0}
/* receipt */
#gfq-01-panel[data-theme=sf] .gfq-rc-total{background:var(--indd);color:var(--mark);border:1px solid var(--line)}
#gfq-01-panel[data-theme=sf] .gfq-rc-total b{color:var(--amb)}
#gfq-01-panel[data-theme=sf] .gfq-stamp{border-color:var(--mark);color:var(--mark);transform:none}
/* achievements: outlined badges with a segmented progress bar instead of hexagons */
/* misc surfaces that were light */
#gfq-01-panel[data-theme=sf] :is(.gfq-card,.gfq-qrw,.gfq-items-body)>button+button{margin-left:6px}
#gfq-01-panel[data-theme=sf] .gfq-cal-day{border:1px solid #ffffff0d;border-radius:0}
#gfq-01-panel[data-theme=sf] .gfq-cal-day.today b{color:var(--mark)}
#gfq-01-panel[data-theme=sf] .gfq-cal-day.late{background:#e3735d14}
#gfq-01-panel[data-theme=sf] :is(.gfq-cal-day i,.gfq-cal-list li span){background:transparent;color:var(--ink);border-left:2px solid var(--sub)}
#gfq-01-panel[data-theme=sf] :is(.gfq-cal-day i.k-pay,.gfq-cal-day i.k-item,.gfq-cal-list li.k-pay span,.gfq-cal-list li.k-item span){background:#e6b24a1a;color:var(--amb);border-left-color:var(--amb)}
#gfq-01-panel[data-theme=sf] :is(.gfq-cal-day i.k-in,.gfq-cal-list li.k-in span){background:#58c7931a;color:var(--grn);border-left-color:var(--grn)}
#gfq-01-panel[data-theme=sf] :is(.gfq-cal-day i.k-out,.gfq-cal-list li.k-out span){background:#e3735d1a;color:var(--red);border-left-color:var(--red)}
#gfq-01-panel[data-theme=sf] :is(.gfq-cal-day i.k-chapter,.gfq-cal-list li.k-chapter span){background:#3fd3e61a;color:var(--mark);border-left-color:var(--mark)}
#gfq-01-panel[data-theme=sf] .gfq-units button{border:1px solid var(--line);border-radius:0;background:transparent;color:var(--ink)}
#gfq-01-panel[data-theme=sf] .gfq-units button:hover:not(:disabled){border-color:var(--mark);color:var(--mark)}
#gfq-01-panel[data-theme=sf] .gfq-units button[aria-pressed=true]{background:var(--mark);border-color:var(--mark);color:#061a1e}
#gfq-01-panel[data-theme=sf] .gfq-board{border-color:var(--line);background-color:var(--card)}
#gfq-01-panel[data-theme=sf] :is(.gfq-glyph-big,.gfq-glyph){text-shadow:none}
#gfq-01-panel[data-theme=sf] .gfq-qdesc{color:#b7c2cb}
#gfq-01-panel[data-theme=sf] .gfq-slot:hover:not(:disabled){background-color:var(--hi)}
#gfq-01-panel[data-theme=sf] .gfq-tk-stub{background:var(--paper2);color:var(--ink);border-left:1px dashed var(--line)}
#gfq-01-panel[data-theme=sf] .gfq-tk-stub::before,#gfq-01-panel[data-theme=sf] .gfq-tk-stub::after{background:var(--paper);border-color:var(--line)}
#gfq-01-panel[data-theme=sf] .gfq-pinbox img{border:1px solid var(--mark);border-radius:0;box-shadow:none}
#gfq-01-panel[data-theme=sf] .gfq-pin-dot{border-radius:0;background:radial-gradient(circle,var(--mark) 0 4px,transparent 4.5px),linear-gradient(var(--mark),var(--mark)) 50% 0/1px 100% no-repeat,linear-gradient(var(--mark),var(--mark)) 0 50%/100% 1px no-repeat;opacity:.8;box-shadow:none;border:1px solid var(--line)}
#gfq-01-panel[data-theme=sf] .gfq-plate .gfq-glyph{text-shadow:none}
#gfq-01-panel[data-theme=sf] .gfq-here,#gfq-01-panel[data-theme=sf] .gfq-plate-tag,#gfq-01-panel[data-theme=sf] .gfq-drop-k{background:var(--ind);color:var(--onacc)}
#gfq-01-panel[data-theme=sf] :is(input,select,textarea){background:var(--paper2);color:var(--ink);border:1px solid var(--line);border-radius:0}
#gfq-01-panel[data-theme=sf] :is(input,select,textarea):focus{outline:1px solid var(--mark);outline-offset:0}
#gfq-01-panel[data-theme=sf] .gfq-meter{border-radius:0;background:#ffffff14}
#gfq-01-panel[data-theme=sf] .gfq-meter i{background:repeating-linear-gradient(90deg,var(--mark) 0 4px,transparent 4px 6px)}
#gfq-01-panel[data-theme=sf] details>summary{color:var(--ink)}
`;
  // v0.10.2: mobile viewport, inner scrolling and narrow quest layout; desktop is unchanged.
  style.textContent+=`
@media (max-width:760px), (max-height:480px) and (pointer:coarse) {
  #gfq-01-panel {
    position:fixed!important;inset:0!important;top:0!important;left:0!important;
    right:0!important;bottom:0!important;margin:0!important;
    transform:none!important;width:100%!important;max-width:100%!important;
    height:100vh!important;height:100dvh!important;
    max-height:100vh!important;max-height:100dvh!important;
    min-height:0!important;box-sizing:border-box!important;overflow:hidden!important;
    padding:0!important;
  }
  #gfq-01-panel .gfq-frame {
    display:grid;grid-template-columns:minmax(0,1fr)!important;
    grid-template-rows:auto minmax(0,1fr)!important;
    width:100%;height:100%;min-height:0;max-height:100%;overflow:hidden;
  }
  #gfq-01-panel .gfq-side {min-width:0;min-height:0;max-width:100%;overflow:hidden;}
  #gfq-01-panel .gfq-tabs {
    overflow-x:auto!important;overflow-y:hidden!important;
    min-width:0;max-width:100%;-webkit-overflow-scrolling:touch;touch-action:pan-x;
  }
  #gfq-01-panel .gfq-tabs button {flex-shrink:0;}
  #gfq-01-panel .gfq-main {
    min-width:0!important;min-height:0!important;max-height:100%!important;
    overflow-x:hidden!important;overflow-y:auto!important;
    -webkit-overflow-scrolling:touch;touch-action:pan-y;
    overscroll-behavior-y:contain;
    padding-bottom:max(24px,env(safe-area-inset-bottom))!important;
  }
  #gfq-01-panel .gfq-quests {
    display:grid;grid-template-columns:minmax(0,1fr)!important;
    gap:12px;min-width:0;max-width:100%;align-items:stretch;
  }
  #gfq-01-panel .gfq-qside {position:static!important;top:auto;min-width:0;}
  #gfq-01-panel .gfq-qlist {
    min-height:0;max-height:min(30vh,180px)!important;max-height:min(30dvh,180px)!important;
    overflow-y:auto!important;-webkit-overflow-scrolling:touch;touch-action:pan-y;
    overscroll-behavior:contain;
  }
  #gfq-01-panel .gfq-qdetail,
  #gfq-01-panel .gfq-qbody,
  #gfq-01-panel .gfq-qhead,
  #gfq-01-panel .gfq-qfoot {
    min-width:0;max-width:100%;overflow-wrap:anywhere;
  }
  #gfq-01-panel .gfq-card {max-width:100%;overflow-wrap:anywhere;}
}
@media (max-width:380px) {
  #gfq-01-panel .gfq-main {padding-left:10px!important;padding-right:10px!important;}
  #gfq-01-panel .gfq-qhead h3 {font-size:18px;}
  #gfq-01-panel .gfq-qbody {padding:12px;}
  #gfq-01-panel .gfq-qfoot {display:flex;flex-wrap:wrap;gap:6px;padding:10px;}
}
`;
  // v0.10.5: landscape phones (Gacha Forge runs landscape only). The themed mobile tab bar above now applies here too,
  // so each theme keeps its own look; this block only trims height and restores the two-column quest view.
  style.textContent+=`
@media (max-height:500px) and (orientation:landscape) and (pointer:coarse) {
 #gfq-01-panel .gfq-frame{grid-template-columns:minmax(0,1fr)!important;grid-template-rows:auto minmax(0,1fr)!important;}
 #gfq-01-panel .gfq-side{padding:3px 8px 3px 10px!important;gap:6px!important;max-height:none!important;overflow:hidden!important;}
 #gfq-01-panel .gfq-brand-mark{width:22px;height:22px;flex:none;}
 #gfq-01-panel .gfq-tabs{overflow-x:auto!important;overflow-y:hidden!important;touch-action:pan-x;}
 #gfq-01-panel .gfq-tabs button{flex:1 0 auto;min-width:56px;padding-top:1px;padding-bottom:1px;gap:1px;}
 #gfq-01-panel .gfq-tab-ic{width:24px;height:22px;}
 #gfq-01-panel .gfq-tab-ic svg{width:17px;height:17px;}
 #gfq-01-panel .gfq-tab-l{font-size:11px;line-height:1.15;white-space:nowrap;}
 #gfq-01-panel .gfq-side-foot{display:none!important;}
 #gfq-01-panel .gfq-main{padding:0 14px max(16px,env(safe-area-inset-bottom))!important;padding-left:max(14px,env(safe-area-inset-left))!important;padding-right:max(14px,env(safe-area-inset-right))!important;}
 #gfq-01-panel .gfq-top{flex-wrap:nowrap!important;gap:10px;margin:0 -14px 10px!important;padding:6px 14px!important;}
 #gfq-01-panel .gfq-top h2{font-size:20px!important;flex:none;}
 #gfq-01-panel .gfq-worldbar{order:0!important;flex:1 1 auto!important;flex-basis:auto!important;min-width:0;display:flex;justify-content:flex-end;}
 #gfq-01-panel #gfq-world,#gfq-01-panel .gfq-drop{max-width:320px!important;}
 #gfq-01-panel .gfq-close{width:34px;height:34px;margin-left:0;}
 #gfq-01-panel .gfq-quests{grid-template-columns:minmax(200px,32%) minmax(0,1fr)!important;align-items:start!important;}
 #gfq-01-panel .gfq-qlist{max-height:none!important;}
 #gfq-01-panel .gfq-qhead{padding:12px 16px;}
 #gfq-01-panel .gfq-qcrest{width:46px;height:56px;}
 #gfq-01-panel .gfq-qhead h3{font-size:19px;}
 #gfq-01-panel .gfq-ticket{grid-template-columns:auto minmax(0,1fr)!important;}
 #gfq-01-panel .gfq-tk-stub{display:none;}
 #gfq-01-panel .gfq-photo{width:130px;height:166px;}
 #gfq-01-panel .gfq-tk-photo{justify-content:flex-start!important;align-self:start!important;padding:22px 12px 14px!important;}
 #gfq-01-panel .gfq-photo span{font-size:64px!important;}
 #gfq-01-panel .gfq-faces{grid-template-columns:repeat(auto-fill,minmax(96px,1fr))!important;}
 #gfq-01-panel .gfq-placecard{grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important;}
 #gfq-01-panel .gfq-cal-day{min-height:44px;}
 #gfq-01-panel .gfq-cal-pad{min-height:44px;}
}
`;
  // v0.12.0: phones. Landscape: the tab bar becomes a narrow icon rail on the left (the screen is only ~360-430px
  // tall, and the bar plus the title row took a quarter of it), the page title is hidden (the rail shows the tab),
  // and cards, lists and portraits are tighter. Portrait: the world picker shares the title row.
  style.textContent+=`
@media (max-height:500px) and (orientation:landscape) and (pointer:coarse) {
 #gfq-01-panel .gfq-frame,#gfq-01-panel[data-theme] .gfq-frame{grid-template-columns:62px minmax(0,1fr)!important;grid-template-rows:minmax(0,1fr)!important;}
 #gfq-01-panel .gfq-side,#gfq-01-panel[data-theme] .gfq-side{flex-direction:column!important;align-items:stretch!important;justify-content:flex-start!important;gap:0!important;max-height:none!important;padding:6px 3px max(6px,env(safe-area-inset-bottom)) max(3px,env(safe-area-inset-left))!important;overflow-x:hidden!important;overflow-y:auto!important;border-bottom:0!important;}
 #gfq-01-panel .gfq-brand,#gfq-01-panel[data-theme] .gfq-brand{display:none!important;}
 #gfq-01-panel .gfq-tabs,#gfq-01-panel[data-theme] .gfq-tabs{flex-direction:column!important;flex:0 0 auto!important;gap:2px!important;padding:0!important;margin:0!important;overflow:visible!important;touch-action:pan-y!important;}
 #gfq-01-panel .gfq-tabs button,#gfq-01-panel[data-theme] .gfq-tabs button{flex:0 0 auto!important;width:100%!important;min-width:0!important;flex-direction:column!important;align-items:center!important;gap:1px!important;padding:4px 0!important;}
 #gfq-01-panel .gfq-tab-ic,#gfq-01-panel[data-theme] .gfq-tab-ic{width:28px!important;height:24px!important;}
 #gfq-01-panel .gfq-tab-ic svg{width:17px!important;height:17px!important;}
 #gfq-01-panel .gfq-tab-l,#gfq-01-panel[data-theme] .gfq-tab-l{font-size:10px!important;line-height:1.1!important;letter-spacing:0!important;}
 #gfq-01-panel .gfq-main{font-size:13px;padding-left:12px!important;padding-right:max(12px,env(safe-area-inset-right))!important;}
 #gfq-01-panel .gfq-top,#gfq-01-panel[data-theme] .gfq-top{padding:5px 12px!important;margin:0 -12px 8px!important;border-bottom-width:3px!important;}
 #gfq-01-panel .gfq-top h2{position:absolute!important;width:1px!important;height:1px!important;overflow:hidden!important;clip:rect(0 0 0 0)!important;white-space:nowrap!important;}
 #gfq-01-panel .gfq-drop{max-width:none!important;margin-left:0!important;}
 #gfq-01-panel .gfq-drop summary{height:32px!important;}
 #gfq-01-panel .gfq-close{width:32px!important;height:32px!important;}
 #gfq-01-panel .gfq-card{margin:8px 0!important;padding:8px 12px 8px 16px!important;}
 #gfq-01-panel .gfq-qitem{padding:6px 10px!important;gap:8px!important;}
 #gfq-01-panel .gfq-qhead{padding:10px 14px!important;gap:12px!important;}
 #gfq-01-panel .gfq-qcrest{width:38px!important;height:46px!important;}
 #gfq-01-panel .gfq-qcrest span{font-size:13px!important;}
 #gfq-01-panel .gfq-qhead h3{font-size:17px!important;}
 #gfq-01-panel .gfq-faces{grid-template-columns:repeat(auto-fill,minmax(88px,1fr))!important;gap:8px!important;}
 #gfq-01-panel .gfq-face-img{aspect-ratio:1/1!important;}
 #gfq-01-panel .gfq-photo{width:104px!important;height:132px!important;}
}
@media (max-width:760px) and (orientation:portrait) {
 #gfq-01-panel .gfq-top,#gfq-01-panel[data-theme] .gfq-top{flex-wrap:nowrap!important;gap:8px!important;padding-top:8px!important;padding-bottom:8px!important;}
 #gfq-01-panel .gfq-top h2{font-size:20px!important;flex:none!important;}
 #gfq-01-panel .gfq-worldbar{order:0!important;flex:1 1 auto!important;flex-basis:auto!important;min-width:0!important;}
 #gfq-01-panel .gfq-drop{max-width:none!important;margin-left:0!important;}
 #gfq-01-panel .gfq-drop summary{height:36px!important;}
 #gfq-01-panel .gfq-close{width:36px!important;height:36px!important;flex:none!important;}
 #gfq-01-panel .gfq-card{margin:10px 0!important;padding:10px 12px 10px 16px!important;}
}
`;
  // v0.12.0: kept separately so the popups can carry their own copy into the fullscreen element's shadow root.
  const gfqToastCss=`
#${ID}-toasts,#${ID}-qtoasts{position:fixed;margin:0;padding:0;border:0;background:transparent;overflow:visible;display:flex;flex-direction:column;align-items:stretch;gap:10px;z-index:2147483002;pointer-events:none;--paper:#f1efea;--ink:#202229;--sub:#67655f;--k:#3b3f7a;--serif:"Noto Serif KR","Nanum Myeongjo","AppleMyungjo","Batang",serif;--sans:"Pretendard","Noto Sans KR",system-ui,sans-serif}
#${ID}-toasts{inset:16px 16px auto auto;width:min(360px,calc(100vw - 32px))}
#${ID}-qtoasts{inset:0;margin:auto;width:min(440px,calc(100vw - 32px));height:fit-content;max-height:calc(100dvh - 32px)}
#${ID}-toasts:not(:popover-open),#${ID}-qtoasts:not(:popover-open){display:none}
:is(#${ID}-toasts,#${ID}-qtoasts) .gfq-toast{pointer-events:auto;position:relative;display:grid;grid-template-columns:64px minmax(0,1fr);width:100%;padding:0;border:1.5px solid var(--ink);border-radius:0;background:var(--paper);color:var(--ink);text-align:left;font:14px/1.5 var(--sans);box-shadow:0 18px 50px #000a,6px 6px 0 #00000040;cursor:pointer;animation:gfq-toast-in .28s cubic-bezier(.2,.9,.3,1.2)}
:is(#${ID}-toasts,#${ID}-qtoasts) .gfq-t-stub{display:grid;place-items:center;background:var(--k);color:#fff;border-right:2px dashed var(--paper);position:relative}
:is(#${ID}-toasts,#${ID}-qtoasts) .gfq-t-stub svg{width:28px;height:28px}
:is(#${ID}-toasts,#${ID}-qtoasts) .gfq-t-body{display:flex;flex-direction:column;gap:2px;padding:14px 18px 14px 20px;min-width:0}
:is(#${ID}-toasts,#${ID}-qtoasts) .gfq-t-body b{font:700 12px/1.3 var(--sans);letter-spacing:.06em;color:var(--k)}
:is(#${ID}-toasts,#${ID}-qtoasts) .gfq-t-body span{font:700 17px/1.45 var(--serif);color:var(--ink);overflow-wrap:anywhere}
:is(#${ID}-toasts,#${ID}-qtoasts) .gfq-toast:hover{box-shadow:0 18px 50px #000a,6px 6px 0 #00000055;transform:translateY(-1px)}
:is(#${ID}-toasts,#${ID}-qtoasts) .gfq-toast:focus-visible{outline:3px solid #f0c02f;outline-offset:2px}
:is(#${ID}-toasts,#${ID}-qtoasts) .gfq-toast-quest,:is(#${ID}-toasts,#${ID}-qtoasts) .gfq-toast-step{--k:#3b3f7a}
:is(#${ID}-toasts,#${ID}-qtoasts) .gfq-toast-money,:is(#${ID}-toasts,#${ID}-qtoasts) .gfq-toast-rep{--k:#2f6a4e}
:is(#${ID}-toasts,#${ID}-qtoasts) .gfq-toast-item,:is(#${ID}-toasts,#${ID}-qtoasts) .gfq-toast-benefit,:is(#${ID}-toasts,#${ID}-qtoasts) .gfq-toast-credential{--k:#4c5196}
:is(#${ID}-toasts,#${ID}-qtoasts) .gfq-toast-date,:is(#${ID}-toasts,#${ID}-qtoasts) .gfq-toast-due{--k:#5d4a86}
:is(#${ID}-toasts,#${ID}-qtoasts) .gfq-toast-place{--k:#2f5a82}
:is(#${ID}-toasts,#${ID}-qtoasts) .gfq-toast-review,:is(#${ID}-toasts,#${ID}-qtoasts) .gfq-toast-info{--k:#94552c}
:is(#${ID}-toasts,#${ID}-qtoasts) .gfq-toast-offer{cursor:default;border-width:2px;box-shadow:0 0 0 6px #f0c02f55,0 18px 50px #000b}
:is(#${ID}-toasts,#${ID}-qtoasts) .gfq-offer-row{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
:is(#${ID}-toasts,#${ID}-qtoasts) .gfq-offer-ev{display:block;margin-top:4px;font:13px/1.5 var(--sans);color:var(--sub);overflow-wrap:anywhere}
:is(#${ID}-toasts,#${ID}-qtoasts) .gfq-offer-row button[data-o=del]{background:transparent;color:#a3342a;border-color:#a3342a}
:is(#${ID}-toasts,#${ID}-qtoasts) .gfq-offer-row button{font:700 13px var(--sans);padding:8px 18px;border-radius:0;border:1.5px solid var(--ink);background:var(--k);color:#fff;cursor:pointer}
:is(#${ID}-toasts,#${ID}-qtoasts) .gfq-offer-row button[data-o=later]{background:transparent;color:var(--ink)}
:is(#${ID}-toasts,#${ID}-qtoasts) .gfq-offer-row button:focus-visible{outline:3px solid #f0c02f;outline-offset:2px}
:is(#${ID}-toasts,#${ID}-qtoasts)[data-theme=east]{--paper:#faf8f4;--ink:#262523}:is(#${ID}-toasts,#${ID}-qtoasts)[data-theme=east] :is(.gfq-toast-quest,.gfq-toast-step){--k:#2b2a28}:is(#${ID}-toasts,#${ID}-qtoasts)[data-theme=east][data-tone=porcelain] :is(.gfq-toast-quest,.gfq-toast-step){--k:#1f3f6e}:is(#${ID}-toasts,#${ID}-qtoasts)[data-theme=east][data-tone=celadon] :is(.gfq-toast-quest,.gfq-toast-step){--k:#4e7466}:is(#${ID}-toasts,#${ID}-qtoasts)[data-theme=east] .gfq-toast{border:1px solid #d6cfc2;box-shadow:0 14px 34px #0007}:is(#${ID}-toasts,#${ID}-qtoasts)[data-theme=east] .gfq-t-stub{border-right:1px solid #b39c6e}:is(#${ID}-toasts,#${ID}-qtoasts)[data-theme=east] .gfq-offer-row button[data-o=yes]{background:var(--k);border-color:var(--k)}
:is(#${ID}-toasts,#${ID}-qtoasts)[data-theme=fantasy]{--paper:#fbf6e9;--ink:#3a2b1b}:is(#${ID}-toasts,#${ID}-qtoasts)[data-theme=fantasy] .gfq-toast{border:1px solid #8a6f4a;box-shadow:inset 0 0 0 3px #fbf6e9,inset 0 0 0 4px #c7b28b,0 14px 34px #0009}:is(#${ID}-toasts,#${ID}-qtoasts)[data-theme=fantasy] :is(.gfq-toast-quest,.gfq-toast-step){--k:#6b4f2e}
:is(#${ID}-toasts,#${ID}-qtoasts)[data-theme=sf] .gfq-toast{clip-path:polygon(0 0,calc(100% - 12px) 0,100% 12px,100% 100%,0 100%);border:1px solid #3fd3e688;border-radius:0;box-shadow:inset 3px 0 0 #3fd3e6,0 10px 30px #0008}:is(#${ID}-toasts,#${ID}-qtoasts)[data-theme=sf]{--paper:#1d2126;--ink:#dbe3e9;--serif:"Bahnschrift","DIN Alternate","Roboto Condensed","Pretendard","Noto Sans KR",sans-serif}:is(#${ID}-toasts,#${ID}-qtoasts)[data-theme=sf] :is(.gfq-toast-quest,.gfq-toast-step){--k:#3fd3e6}
:is(#${ID}-toasts,#${ID}-qtoasts)[data-theme=school]{--paper:#fbfbfe;--ink:#23263a}:is(#${ID}-toasts,#${ID}-qtoasts)[data-theme=school] :is(.gfq-toast-quest,.gfq-toast-step){--k:#3d63b0}:is(#${ID}-toasts,#${ID}-qtoasts)[data-theme=school] .gfq-toast{border-radius:10px;overflow:hidden}
@keyframes gfq-toast-in{from{opacity:0;transform:scale(.94) translateY(8px)}to{opacity:1;transform:none}}
@media(prefers-reduced-motion:reduce){:is(#${ID}-toasts,#${ID}-qtoasts) .gfq-toast{animation:none}}
#${ID}-toasts .gfq-toast{grid-template-columns:46px minmax(0,1fr);box-shadow:0 10px 28px #0008,4px 4px 0 #00000033}#${ID}-toasts .gfq-t-stub svg{width:22px;height:22px}#${ID}-toasts .gfq-t-body{padding:10px 14px 10px 14px}#${ID}-toasts .gfq-t-body span{font-size:14px}#${ID}-toasts .gfq-t-body b{font-size:11px}
`;
  style.textContent+=gfqToastCss+`
.${ID}-ask{width:min(440px,calc(100vw - 32px));max-height:calc(100dvh - 32px);overflow:auto;padding:20px 22px 16px;border:1.5px solid #202229;border-radius:0;background:#f1efea;color:#202229;box-shadow:0 18px 50px #000a,6px 6px 0 #00000040;font:14px/1.55 "Pretendard","Noto Sans KR",system-ui,sans-serif;box-sizing:border-box}
.${ID}-ask::backdrop{background:#0006}
.${ID}-ask .gfq-ask-msg{margin:0 0 14px;white-space:pre-wrap;overflow-wrap:anywhere}
.${ID}-ask :is(input,textarea){display:block;width:100%;box-sizing:border-box;margin:0 0 14px;padding:8px 10px;border:1.5px solid #202229;border-radius:0;background:#fff;color:#202229;font:inherit}
.${ID}-ask textarea{resize:vertical;font:12px/1.5 ui-monospace,Consolas,monospace}
.${ID}-ask .gfq-ask-row{display:flex;justify-content:flex-end;gap:8px}
.${ID}-ask button{font:700 13px "Pretendard","Noto Sans KR",system-ui,sans-serif;padding:8px 18px;border-radius:0;border:1.5px solid #202229;background:#3b3f7a;color:#fff;cursor:pointer}
.${ID}-ask button[value=no]{background:transparent;color:#202229}
.${ID}-ask button:focus-visible{outline:3px solid #f0c02f;outline-offset:2px}
`;
  document.head.append(style);
  const HOST_TAG = 'marinara-capability-gacha-forge';
  let gameHost = null, gameRoot = null, gameObserver = null, gameDebounce = 0;
  function findHost(){ return document.querySelector(HOST_TAG); }
  function getButton(){return gameRoot?.querySelector('button[data-gfq="top"]');}
  function placeButton(){
    if(!gameRoot)return;
    if(getButton())return;
    const fs=[...gameRoot.querySelectorAll('.gf-fs-bar')].find(el=>el.classList.contains('icon-button'));
    if(!fs || !fs.parentElement)return;
    const b=document.createElement('button');b.type='button';b.className='icon-button';b.dataset.gfq='top';
    b.title='퀘스트';b.setAttribute('aria-label','퀘스트');b.innerHTML='<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true"><path d="M12 2.8 20.6 12 12 21.2 3.4 12z"/><path d="M12 7.8v5.4"/><circle cx="12" cy="16.3" r=".6" fill="currentColor"/></svg>';
    b.addEventListener('pointerdown',e=>e.stopPropagation());
    b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();openPanel();});
    fs.parentElement.insertBefore(b,fs);
  }
  function mount(){
    if(!document.body)return;
    if(root){root.remove();root=null;}
    const host=findHost();
    if(host!==gameHost || (host && host.shadowRoot!==gameRoot)){
      if(gameObserver){gameObserver.disconnect();gameObserver=null;}
      gameHost=host;gameRoot=host?.shadowRoot||null;
      if(gameRoot){
        gameObserver=new MutationObserver(()=>{if([toastBox,questBox].some(b=>b&&!b.isConnected))gfqToastPlace();if(gameDebounce)return;gameDebounce=setTimeout(()=>{gameDebounce=0;placeButton();gfqSceneTick();},120);});
        gameObserver.observe(gameRoot,{childList:true,subtree:true});
      }
    }
    placeButton();
  }
  function openPanel(){if(panel){panel.close();panel.remove();panel=null;mount();return;}gfqSyncPull('open');panel=document.createElement('dialog');panel.id=ID+'-panel';panel.setAttribute('aria-label','퀘스트');document.body.append(panel);panel.addEventListener('cancel',e=>{e.preventDefault();openPanel();});render();panel.showModal();mount();}
  // Story context preview. Does not intercept or modify official Gacha Forge model calls.
  function buildQuestContext(){
    const w=current();if(!w)return '';
    const active=w.quests.filter(q=>!q.claimed).slice(0,24);
    const fields=w.fields.slice(0,35);
    const items=w.items.filter(i=>i.state!=='pending'&&i.kind!=='voucher').slice(0,35),pendingItems=w.items.filter(i=>i.state==='pending').slice(0,15),vouchers=w.items.filter(i=>i.kind==='voucher'&&i.qty>0).slice(0,15);
    return [
      '[WORLD QUEST CONTEXT — user-maintained reference]',
      'World: '+data.world,
      ...(gfqCurrentDate(w)?['In-world date: '+gfqCurrentDate(w).date+(gfqCurrentClock(w)?' '+gfqClockText(gfqCurrentClock(w)):'')+' ('+gfqCurrentDate(w).basis+')']:[]),
      'Active quests:',
      ...(active.length?active.map(q=>'- '+q.title+' ('+q.type+'): '+q.detail+' ['+q.progress+'/'+q.target+']; reward note: '+q.reward):['- none']),
      'Character/world assets:',
      ...(fields.length?fields.map(f=>'- '+f.name+': '+f.value+' '+f.unit):['- none']),
      'Story inventory:',
      ...(items.length?items.map(i=>'- '+i.name+': '+i.qty):['- none']),
      ...(vouchers.length?['Benefits/vouchers held (uses left):',...vouchers.map(i=>'- '+i.name+': '+i.qty)]:[]),
      ...(pendingItems.length?['Promised but not yet received (not owned):',...pendingItems.map(i=>'- '+i.name+(i.timing?' (expected: '+i.timing.text+', said in '+i.timing.anchor+')':''))]:[]),
      'Treat these entries as established reference only when consistent with the story. Never assume a reward was paid, a task completed, or an item transferred without an explicit narrative event. Do not invent player actions or dialogue. Do not change Gacha Forge system currency.',
      '[/WORLD QUEST CONTEXT]'
    ].join('\n').slice(0,11000);
  }
  async function copyQuestContext(){
    const txt=buildQuestContext();
    if(!txt)return alert('먼저 월드를 선택해 주세요.');
    try{await navigator.clipboard.writeText(txt);alert('퀘스트 문맥을 복사했습니다. 공식 스토리 지침에 직접 붙여넣어 주세요. 아직 자동 주입 기능은 지원하지 않습니다.');}
    catch{(await gfqPrompt('복사한 내용을 스토리 지침에 붙여넣어 주세요:',txt));}
  }

  // Official Gacha Forge 1.8.12 read-only API integration.
  const GAME_API='/api/gacha-forge';
  let worldSyncBusy=false, worldSyncTimer=null, scanBusy=false, lastSyncError='', linkedRunId='';
  const chapterFingerprints=new Map();
  async function gameJson(path,body){
    const opts=body===undefined?{method:'GET',credentials:'same-origin'}:{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)};
    const res=await fetch(GAME_API+path,opts);
    if(!res.ok)throw Error('HTTP '+res.status+' '+path);
    const j=await res.json();
    if(j&&j.ok===false)throw Error(j.error||'게임 조회 실패');
    return j;
  }

  // Observe existing, successfully authorised Gacha Forge traffic without extracting credentials.
  const observed={runId:'',name:'',lastSeen:0};
  const priorFetch=window.fetch;
  function attachObservedRun(id,name=''){
    const runId=String(id||'').trim();
    if(!runId || runId.length>128)return;
    // v0.12.0: a new run must not inherit the previous run's name (it labelled new worlds with the old world's name).
    if(observed.runId!==runId)observed.name='';
    observed.runId=runId;
    if(name)observed.name=String(name).trim().slice(0,100);
    observed.lastSeen=Date.now();
    let key=Object.keys(data.worlds).find(k=>data.worlds[k]?.gfRunId===runId);
    if(!key){
      const label=observed.name||('게임 월드 '+runId.slice(0,8));
      const legacy=data.worlds[label];
      if(legacy&&!legacy.gfRunId){key=label;legacy.gfRunId=runId;}
      else{key=data.worlds[label]?label+' ('+runId.slice(0,8)+')':label;data.worlds[key]=blank();data.worlds[key].gfRunId=runId;}
    }
    if(!data.worlds[key]?.gfRunId)data.worlds[key].gfRunId=runId;
    if(observed.name&&data.worlds[key].gfDisplayName!==observed.name){data.worlds[key].gfDisplayName=observed.name;save();if(panel)render();}
    const changed=data.world!==key;data.world=key;linkedRunId=runId;lastSyncError='';
    if(changed)save();
    if(panel&&changed)render();
  }
  // Read the metadata of successful game responses only; never make unauthorised chapter requests.
  function rememberChapters(runId,reply,path){
    if(!runId||!reply||typeof reply!=='object')return;
    const key=Object.keys(data.worlds).find(k=>data.worlds[k]?.gfRunId===String(runId));
    if(!key)return;
    const world=data.worlds[key],rows=Array.isArray(reply.chapters)?reply.chapters:null;
    if(!rows)return;
    if(/\/chapters$/.test(path)){
      world.gfChapterIndex=rows.slice(0,200).map(c=>({chapter:c.chapter,title:c.title,premise:c.premise,cleared:!!c.cleared,normal:c.normal}));
    }else if(/\/continuity$/.test(path)){
      world.gfContinuityIndex=rows.slice(0,200).map(c=>({chapter:c.chapter,title:c.title,storyBeats:c.storyBeats,complete:!!c.complete,compressed:!!c.compressed}));
    }else return;
    const fingerprint=JSON.stringify([world.gfChapterIndex||null,world.gfContinuityIndex||null]);
    if(chapterFingerprints.get(key)===fingerprint)return;
    chapterFingerprints.set(key,fingerprint);
    world.gfScannedAt=now();save();if(panel&&data.world===key&&currentTab==='history')render();
    gfqAutoSchedule(key);
  }

  // Conservative story intake: already delivered game data only. No new generation or server writes.
  function intakeStory(runId,reply,path,req){
    if(!runId||!(/\/(beat|story|run)(\/|$)/.test(path)))return;
    const key=Object.keys(data.worlds).find(k=>data.worlds[k]?.gfRunId===String(runId));
    if(!key)return;
    const w=data.worlds[key];w.gfStorySamples ||= [];
    const beat=reply?.beat||reply?.story||reply;
    const samples=[];
    function walk(v,depth=0){
      if(depth>5||samples.length>=75||!v)return;
      if(Array.isArray(v)){for(const item of v.slice(0,80))walk(item,depth+1);return;}
      if(typeof v!=='object')return;
      for(const [k,value] of Object.entries(v)){
        if(['prompt','system','instructions','context','lore','history','messages','request'].includes(k.toLowerCase()))continue;
        if(['text','narration','narrative','dialogue','content','line','prose'].includes(k.toLowerCase())&&typeof value==='string'&&(value.trim().length>12||gfqDateHeading(value))){
          samples.push(value.trim().slice(0,1600));
        } else if(value&&typeof value==='object'&&['segments','beat','story','scene','lines','dialogues','events'].includes(k.toLowerCase()))walk(value,depth+1);
      }
    }
    walk(beat);
    if(!samples.length)return;
    const chapter=String(req.chapter??beat.chapter??reply.chapter??'?');
    const index=String(req.storyIndex??beat.storyIndex??reply.storyIndex??'?');
    let changed=false;
    for(const text of samples){
      const signature=chapter+'|'+index+'|'+text;
      let hash=2166136261;for(let i=0;i<signature.length;i++)hash=Math.imul(hash^signature.charCodeAt(i),16777619)>>>0;
      const id='e'+hash.toString(36);
      if(w.gfStorySamples.some(e=>e.id===id))continue;
      w.gfStorySamples.push({id,chapter,index,text,at:now()});changed=true;
    }
    if(changed){
      // v0.3.5: record scenes dropped by the 180-scene cap so missing payments can be diagnosed.
      const over=w.gfStorySamples.length-180;
      if(over>0){w.gfEvicted||={};for(const e of w.gfStorySamples.slice(0,over)){const c=String(e.chapter);w.gfEvicted[c]=(w.gfEvicted[c]||0)+1;}}
      w.gfStorySamples=w.gfStorySamples.slice(-180);save();if(panel&&currentTab==='history'&&data.world===key)render();
      gfqAutoSchedule(key);}
  }
  // v0.5.1: the game's /state lists each run with its lorebook settings; keep a copy (no extra request).
  function gfqRememberLore(runId,v){
    const run=(Array.isArray(v?.runs)?v.runs.find(x=>x&&x.runId===runId):null)||(v?.run?.runId===runId?v.run:null)||(v?.activeRun?.runId===runId?v.activeRun:null);
    if(!run||!run.lore||typeof run.lore!=='object')return;
    const key=Object.keys(data.worlds).find(k=>data.worlds[k]?.gfRunId===runId);if(!key)return;
    const lore=gfqCleanLore(run.lore),w=data.worlds[key];
    if(JSON.stringify(w.gfRunLore)!==JSON.stringify(lore)){w.gfRunLore=lore;save();}
  }
  // v0.6.0: protagonist (persona) and places, read from replies the game already receives. No extra requests.
  function gfqWorldOfRun(runId){const key=Object.keys(data.worlds).find(k=>data.worlds[k]?.gfRunId===runId);return key?data.worlds[key]:null;}
  function gfqRememberHero(runId,v){
    const run=(Array.isArray(v?.runs)?v.runs.find(x=>x&&x.runId===runId):null)||(v?.activeRun?.runId===runId?v.activeRun:null)||(v?.run?.runId===runId?v.run:null);
    const p=run?.protagonist;if(!p||typeof p!=='object'||!String(p.name||'').trim())return;
    const w=gfqWorldOfRun(runId);if(!w)return;
    const hero={name:String(p.name).trim().slice(0,40),personaId:String(p.personaId||'').slice(0,80),avatarPath:String(p.avatarPath||'').slice(0,400)};
    const old=w.gfHero||{};
    if(old.name===hero.name&&old.personaId===hero.personaId&&old.avatarPath===hero.avatarPath)return;
    w.gfHero={...old,...hero};if(old.personaId!==hero.personaId)delete w.gfHero.avatar;
    if(!String(w.protagonist||'').trim()){w.protagonist=hero.name;record(w,'주인공 이름을 게임 설정에서 가져왔습니다: '+hero.name);}
    save();if(panel&&currentTab==='profile')render();
  }
  const gfqPlaceKey=n=>String(n||'').replace(/\s+/g,' ').trim().toLowerCase().slice(0,60);
  // v0.7.7: hand edits. alias[k] = other key (merged) or '' (deleted by the player). Followed when the game sends that name again.
  function gfqAliasOf(alias,k){for(let i=0;i<8&&alias&&Object.prototype.hasOwnProperty.call(alias,k);i++){k=alias[k];if(!k)return '';}return k;}
  function gfqRememberPlaces(runId,v,path,req){
    const w=gfqWorldOfRun(runId);if(!w||!v||typeof v!=='object')return;
    const P=w.gfPlaces&&typeof w.gfPlaces==='object'?w.gfPlaces:(w.gfPlaces={});let changed=false;
    const put=name=>{const n=String(name||'').replace(/\s+/g,' ').trim().slice(0,60),k=gfqAliasOf(w.gfPlaceAlias,gfqPlaceKey(n));if(!k)return null;if(!P[k]){P[k]={name:n,chapters:[],scenes:[]};changed=true;}return P[k];};
    if(/\/chapter-plan$/.test(path)&&Array.isArray(v.plan?.nodes)){
      const ch=Number(req.chapter)||0;
      for(const n of v.plan.nodes){
        if(!n||n.type!=='story'||!n.location)continue;const p=put(n.location);if(!p)continue;
        if(ch&&!p.chapters.includes(ch)){p.chapters.push(ch);p.chapters.sort((a,b)=>a-b);changed=true;}
        const sc={chapter:ch,index:Number(n.index)||0,title:String(n.title||'').slice(0,60),goal:String(n.goal||'').slice(0,160)};
        const at=p.scenes.findIndex(s=>s.chapter===sc.chapter&&s.index===sc.index);
        if(at<0){p.scenes.push(sc);p.scenes.sort((a,b)=>a.chapter-b.chapter||a.index-b.index);p.scenes=p.scenes.slice(-16);changed=true;}
        else if(p.scenes[at].title!==sc.title||p.scenes[at].goal!==sc.goal){p.scenes[at]=sc;changed=true;}
      }
    }
    if(/\/locations$/.test(path)&&v.places&&typeof v.places==='object'){
      for(const s of Object.values(v.places)){if(!s||!s.name||!s.url)continue;const p=put(s.name);const u=String(s.url).slice(0,400);if(p&&p.url!==u){p.url=u;changed=true;}}
    }
    if(!changed)return;
    const keys=Object.keys(P);if(keys.length>80)for(const k of keys.slice(0,keys.length-80))delete P[k];
    save();if(panel&&currentTab==='places')render();
  }
  // Ordered by first appearance (chapter, scene); places known only from a background image go last.
  function gfqPlaceList(w){
    const first=p=>p.scenes?.[0]?[p.scenes[0].chapter,p.scenes[0].index]:[1e9,0];
    return Object.entries(w.gfPlaces||{}).map(([key,p])=>({key,...p})).sort((a,b)=>{const x=first(a),y=first(b);return x[0]-y[0]||x[1]-y[1]||a.name.localeCompare(b.name);});
  }
  // The scene background the reader is looking at names the current place (read when a line settles).
  function gfqPlaceTick(w){
    const bg=gameRoot?.querySelector('[data-bg="a"]')?.style?.backgroundImage||'';
    const m=bg.match(/url\(["']?(.*?)["']?\)/);if(!m||!m[1])return;
    const hit=Object.entries(w.gfPlaces||{}).find(([,p])=>p.url&&(m[1]===p.url||m[1].endsWith(p.url)));
    if(!hit||w.gfPlaceNow?.key===hit[0])return;
    const first=!w.gfPlaceNow;w.gfPlaceNow={key:hit[0],at:now()};save();if(panel&&currentTab==='places')render();
    // v0.7.0: check-in. Announce the new place and the open quests that mention it.
    if(!first){const qs=(w.quests||[]).filter(q=>!q.claimed&&(q.title+' '+(q.detail||'')).includes(hit[1].name));
      gfqToast('장소 이동',hit[1].name+(qs.length?' · 관련 퀘스트: '+qs.slice(0,2).map(q=>q.title).join(', ')+(qs.length>2?' 외 '+(qs.length-2)+'개':''):''),'place');}
  }
  const gfqAvatarTried=new Set();
  function gfqHeroAvatar(w){
    const h=w.gfHero||{};
    if(h.avatar)return h.avatar;
    if(h.personaId&&!gfqAvatarTried.has(h.personaId)){
      gfqAvatarTried.add(h.personaId);
      gfqApi('/api/characters/personas/'+encodeURIComponent(h.personaId),'GET').then(r=>{
        const a=String(r?.avatarPath||'').slice(0,400);if(!a||w.gfHero?.personaId!==h.personaId)return;
        w.gfHero.avatar=a;save();if(panel&&currentTab==='profile')render();
      }).catch(()=>{});
    }
    return h.avatarPath||'';
  }
  // v0.6.2: the Background Manager extension looks for any visible text like '챕터 4' to place its label. An invisible
  // word joiner inside '챕터' keeps our panel and toasts out of that search; it looks and reads the same.
  const gfqNoMatch=h=>String(h).replace(/챕터/g,'챕\u2060터');
  const gfqImgSrc=s=>/^(\/(?!\/)|https?:\/\/|data:image\/)/.test(String(s||''))?String(s):'';
  function gfqCleanLore(l){
    const ids=v=>[...new Set((Array.isArray(v)?v:[]).map(x=>String(x||'').trim()).filter(Boolean))].slice(0,24);
    const num=v=>v===null||v===undefined||v===''?null:(Number.isFinite(Number(v))?Number(v):null);
    return {worldIds:ids(l?.worldIds),castIds:ids(l?.castIds),worldBudget:num(l?.worldBudget),castBudget:num(l?.castBudget),beat:l?.beat===true||l?.beat==='true'};
  }
  // Pure: our lorebook first (so a tight budget never drops it), every other setting kept.
  function gfqMergeLore(lore,lorebookId,connect){
    const l=gfqCleanLore(lore),rest=l.worldIds.filter(id=>id!==lorebookId);
    return connect?{...l,worldIds:[lorebookId,...rest].slice(0,24),beat:true}:{...l,worldIds:rest};
  }
  function nameOfRun(x){return String(x?.name||x?.title||x?.worldName||x?.world?.name||'').trim().slice(0,100);}
  function absorbGameReply(req,response){
    const type=response?.headers?.get?.('content-type')||'';
    if(!response?.ok||!type.includes('json'))return;
    const size=Number(response.headers?.get?.('content-length')||0);
    if(size>1024*1024)return;
    response.clone().json().then(async v=>{
      if(!v||typeof v!=='object')return;
      if(gfqSyncWait)await gfqSyncWait;
      const active=v.activeRun;
      const runId=req.runId||active?.runId||v.activeRunId||v.run?.runId;
      let name=nameOfRun(active)||nameOfRun(v.run);
      if(!name&&Array.isArray(v.runs)){const match=v.runs.find(x=>x?.runId===runId);name=nameOfRun(match);}
      if(!name&&Array.isArray(v.worlds)){const match=v.worlds.find(x=>x?.runId===runId);name=nameOfRun(match);}
      // One save and one panel render for the whole reply instead of one per step.
      if(runId)gfqHolding(()=>{attachObservedRun(runId,name);rememberChapters(runId,v,req.url||'');intakeStory(runId,v,req.url||'',req);gfqRememberLore(runId,v);gfqRememberHero(runId,v);gfqRememberPlaces(runId,v,req.url||'',req);gfqRememberCast(runId,v,req.url||'',req);});
    }).catch(()=>{});
  }
  const observedFetch=function(input,options){
    const result=priorFetch.apply(this,arguments);
    try{
      const url=new URL(typeof input==='string'?input:input?.url,location.href);
      if(url.origin!==location.origin || !url.pathname.startsWith('/api/gacha-forge/'))return result;
      let req={};
      if(typeof options?.body==='string'){
        try{const body=JSON.parse(options.body);if(body&&typeof body==='object')req=body;}catch{}
      }
      if(req.runId)attachObservedRun(req.runId);
      req.url=url.pathname;
      if(result?.then && /\/(?:state|runs|chapters|chapter-plan|locations|roster|unit|continuity|beat|story|run)(?:\/|$)/.test(url.pathname))result.then(response=>absorbGameReply(req,response)).catch(()=>{});
    }catch{}
    return result;
  };
  window.fetch=observedFetch;
  async function syncWorld(){
    if(worldSyncBusy||!gameRoot)return;
    if(observed.runId){attachObservedRun(observed.runId,observed.name);return;}
    lastSyncError='게임 통신에서 월드 정보를 아직 확인하지 못했습니다. 가챠 포지에서 월드를 선택하거나 스토리를 열어 주세요.';
    if(panel)render();
    return;
    /* direct unauthenticated /state calls deliberately disabled.
    worldSyncBusy=true;
    try{
      const state=await gameJson('/state');
      const run=state.activeRun||state.runs?.find(r=>r.runId===state.activeRunId);
      if(!run?.runId){lastSyncError='게임이 활성 월드를 반환하지 않았습니다. 가챠 포지에서 월드를 선택해 주세요.';if(panel)render();return;}
      const id=String(run.runId), name=String(run.name||'이름 없는 월드').trim();
      if(!id)return;
      let key=Object.keys(data.worlds).find(k=>data.worlds[k]?.gfRunId===id);
      if(!key){
        const legacy=data.worlds[name];
        if(legacy&&!legacy.gfRunId){key=name;legacy.gfRunId=id;}
        else{
          key=data.worlds[name]?name+' ('+id.slice(0,8)+')':name;
          data.worlds[key]=blank();data.worlds[key].gfRunId=id;
        }
      }
      if(data.world!==key){data.world=key;}
      linkedRunId=id;lastSyncError='';
      save();if(panel)render();
    }catch(e){lastSyncError=String(e?.message||e);if(panel)render();}
    finally{worldSyncBusy=false;} */
  }
  async function scanExistingChapters(){
    const w=current();
    if(!w?.gfRunId){alert('먼저 게임 월드 연결을 확인해 주세요.');return;}
    alert('403 오류를 방지하기 위해 별도 조회 요청을 보내지 않습니다. 게임에서 기존 스토리 또는 챕터 화면을 열어 주세요. 해당 화면의 정상 응답을 관찰하여 가져올 수 있는 기록만 반영합니다.');
  }
  function chapterIndexHTML(w){
    const chapters=w.gfChapterIndex||[];
    if(!chapters.length)return '<div class="gfq-muted">조회된 챕터 목록이 없습니다. 기존 장면 본문은 아직 가져오지 않았습니다.</div>';
    return '<h3>기존 스토리 목록 ('+chapters.length+'개)</h3><p class="gfq-muted">공식 API에서 조회한 제목·줄거리·완료 상태입니다. 장면 본문 및 자산 거래 분석 결과는 포함되지 않습니다.</p>'+chapters.map(c=>'<div class="gfq-card"><b>챕터 '+esc(c.chapter)+' · '+esc(c.title)+'</b><div class="gfq-muted">'+esc(c.premise||'줄거리 정보가 없습니다')+'</div><small>'+ (c.cleared?'완료':'진행 중')+'</small></div>').join('');
  }

  // Reuse the engine's public connection metadata. Do not read, transmit or store API keys.
  let aiConnections=[],aiConnectionError='',aiConnectionLoading=false;
  async function refreshAiConnections(){
    if(aiConnectionLoading)return;
    aiConnectionLoading=true;aiConnectionError='';
    try{
      const response=await fetch('/api/connections',{method:'GET',credentials:'same-origin'});
      if(!response.ok)throw Error('HTTP '+response.status);
      const raw=await response.json();
      const items=Array.isArray(raw)?raw:Array.isArray(raw?.connections)?raw.connections:[];
      aiConnections=items.filter(x=>x?.id&&!['image_generation','video_generation'].includes(String(x.provider||'')))
        .map(x=>({id:String(x.id),name:String(x.name||x.model||x.id),model:String(x.model||'')}));
      if(!aiConnections.length)aiConnectionError='사용 가능한 텍스트 AI 연결이 없습니다.';
    }catch(e){aiConnectionError='연결 목록을 불러오지 못했습니다: '+String(e?.message||e);}
    finally{aiConnectionLoading=false;if(panel&&currentTab==='settings')render();}
  }
  function gfqWorldRulesHtml(w){
    const ctx=gfqRuleCtx(w);
    return '<div class="gfq-card"><b>월드 분석 기준</b><p class="gfq-muted">AI 분석은 주인공에게 귀속되는 돈·물품·자격·계약·의뢰만 후보로 고릅니다. 이름이 비어 있으면 \'주인공(플레이어 캐릭터)\'로 안내합니다.</p>'+
      '<label for="gfq-hero">주인공 이름</label><input id="gfq-hero" maxlength="40" placeholder="예: 홍길동" value="'+esc(w.protagonist||'')+'">'+
      '<label><input type="checkbox" id="gfq-legacy" style="width:auto" '+(ctx.legacy?'checked':'')+'> 기존 월드 전용 보정 규칙(v0.3.4) 사용</label>'+
      '<p class="gfq-muted">v0.3.4까지 특정 챕터·사건에 맞춰 넣었던 보정입니다. 처음 만든 월드에서만 켜 두시고, 새 월드에서는 꺼 두시기를 권장합니다.</p></div>';
  }
  function aiSettingsHTML(){
    const selected=String(data.aiConnectionId||'');
    const choices=aiConnections.map(c=>'<option value="'+esc(c.id)+'" '+(selected===c.id?'selected':'')+'>'+esc(c.name)+(c.model?' · '+esc(c.model):'')+'</option>').join('');
    return '<div class="gfq-card"><b>AI 스토리 분석 연결</b><p class="gfq-muted">마리나라에 등록된 텍스트 AI 연결을 사용합니다. 별도 API 키를 입력하지 않습니다.</p>'+
      '<label for="gfq-ai-connection">분석 모델</label><select id="gfq-ai-connection"><option value="">분석 연결을 선택해 주세요</option>'+choices+'</select>'+
      '<p class="gfq-muted">'+(aiConnectionError?esc(aiConnectionError):'선택한 연결로 스토리를 분석할 수 있습니다.')+'</p>'+
      '<button data-action="refresh-ai-connections">연결 목록 새로고침</button>'+
      '<label for="gfq-ai-mode">분석 실행 방식</label><select id="gfq-ai-mode">'+[['manual','수동 분석 (기록 탭의 버튼으로 실행)'],['scene','스토리가 생성되면 바로 자동 분석 (권장)'],['chapter','다음 챕터가 시작된 뒤 지난 챕터 자동 분석']].map(([v,l])=>'<option value="'+v+'" '+((['chapter','scene'].includes(data.aiMode)?data.aiMode:'manual')===v?'selected':'')+'>'+l+'</option>').join('')+'</select>'+
      '<label><input type="checkbox" id="gfq-auto-apply" style="width:auto" '+(data.autoApply?'checked':'')+'> 분석 결과 자동 반영</label>'+
      '<label><input type="checkbox" id="gfq-scene-timed" style="width:auto" '+(data.sceneTimed!==false?'checked':'')+' '+(data.autoApply?'':'disabled')+'> 해당 대사가 나올 때 반영·알림 (새 퀘스트는 수락 창 표시)</label>'+
      '<p class="gfq-muted">자동 반영을 켜면 원문 근거·금액·연결 검증을 통과한 항목은 바로 퀘스트와 프로필(돈·소지품)에 반영되고, 불확실한 항목만 검토 목록에 남습니다. 반영 직전 상태를 저장하므로 기록 탭에서 마지막 자동 반영을 되돌릴 수 있습니다. 자동 분석은 게임 통신을 관찰해, 새 스토리가 들어오고 6초 동안 추가 응답이 없을 때 아직 분석하지 않은 장면만 한 번 분석합니다. 챕터가 한 번에 생성되면 그 챕터 전체가 한 번에 분석됩니다. 장면이 조금씩 들어오는 경우 호출이 잦아질 수 있으니, 그때는 \'다음 챕터가 시작된 뒤\' 방식을 써 주세요.</p>'+
      '</div>';
  }

  // Structured AI review pipeline. Transport is intentionally decoupled from the host's private model runtime.
  // v0.3.6: per-world rule context. Rules written for the original world (v0.3.4 rule pack)
  // run only where that pack is enabled; every other world uses the generic path.
  const GFQ_LEGACY_PACK='legacy-0.3.4';
  const GFQ_GENERIC=Object.freeze({legacy:false,hero:''});
  function gfqRuleCtx(w){
    if(!w)return GFQ_GENERIC;
    if(w.protagonist===undefined){
      // One-time migration: the world the v0.3.4 rules were written for is recognised from its own stored story.
      const texts=(w.gfChapterIndex||[]).map(c=>String(c.premise||'')).concat((w.gfStorySamples||[]).map(e=>String(e.text||'')));
      const legacy=texts.some(t=>t.includes('채서래'));
      w.protagonist=legacy?'채서래':'';
      if(legacy&&!w.gfRulePack)w.gfRulePack=GFQ_LEGACY_PACK;
    }
    return {legacy:w.gfRulePack===GFQ_LEGACY_PACK,hero:String(w.protagonist||'').trim()};
  }
  const gfqEsc=s=>String(s).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  function gfqEventEligible(x,ctx=GFQ_GENERIC){
    if(!x||!['quest','asset','item','credential','contract','benefit'].includes(x.category))return false;
    if(x.owner&&x.owner!=='player')return false;
    const name=String(x.name||''),quote=String(x.evidence||''),both=name+' '+quote;
    if(x.category==='asset'){
      if(x.financialStatus==='not_applicable')return false;
      if(['명','톤','개'].includes(String(x.unit||'')))return false;
      if(ctx.legacy&&/대피|셔터|송장|오차율|용해로 압력|고철 더미|쐐기 파손/.test(name))return false;
    }
    if(!ctx.legacy)return true;
    if(x.category==='quest'&&/각성 사태|폭주 공명 위험|압력 상승|밀수품 발견|마수 각성 사태|수당 정산|보수 정산|시료 채취|셔터 폐쇄|연구원 대피/.test(name))return false;
    if(x.category==='credential'&&/수령을 위해|서명 인장/.test(both))return false;
    if(x.category==='item'&&/앰플.*장전|추가 장전/.test(both)&&!new RegExp(gfqEsc(ctx.hero||'채서래')+'.{0,30}(받|획득|소지|장전)').test(quote))return false;
    if(x.category==='item'&&/각성제|밀수품/.test(name)&&!new RegExp(gfqEsc(ctx.hero||'채서래')+'.*(획득|수령|소지)').test(quote))return false;
    return true;
  }
  // v0.4.4: world calendar. Dates come only from the story text; a day change without a written date is an estimate.
  // v0.13.0: fictional calendars ('제국력 312년 4월 9일'), month-day and 'N일차' headings, the time of day,
  // and a world-fitting date when the story never writes one (estimate; anything written in the story wins).
  function gfqUTC(y,m,d){const t=new Date(Date.UTC(2000,0,1));t.setUTCFullYear(y,m-1,d);return t;}
  function gfqIso(t){return String(t.getUTCFullYear()).padStart(4,'0')+'-'+String(t.getUTCMonth()+1).padStart(2,'0')+'-'+String(t.getUTCDate()).padStart(2,'0');}
  function gfqYmd(y,m,d){
    if(!(y>=1&&y<=9999&&m>=1&&m<=12&&d>=1&&d<=31))return null;
    const t=gfqUTC(y,m,d);if(t.getUTCMonth()!==m-1)return null;
    return gfqIso(t);
  }
  function gfqDatesIn(text){
    const out=[];
    for(const m of String(text||'').matchAll(/(?:([가-힣]{1,5}(?:력|기))\s*)?(\d{1,4})\s*(년\s*|[-./])\s*(\d{1,2})\s*(?:[-./]|월\s*)\s*(\d{1,2})\s*일?/gu)){
      // a short year needs an era name or '년' ('제국력 312.4.9', '312년 4월 9일'), so '3.5.1' is not a date
      if(m[2].length<4&&!m[1]&&!/년/.test(m[3]))continue;
      const v=gfqYmd(+m[2],+m[4],+m[5]);if(v&&!out.includes(v))out.push(v);
    }
    return out;
  }
  function gfqEraIn(text){const m=String(text||'').match(/([가-힣]{1,5}(?:력|기))\s*\d{1,4}\s*(?:년|[-./]\s*\d)/u);return m?m[1]:'';}
  function gfqAddDays(ymd,n){const [y,m,d]=ymd.split('-').map(Number);return gfqIso(gfqUTC(y,m,d+n));}
  const GFQ_DAY_WORDS=/(다음\s?날|이튿날|이틀|사흘|나흘|닷새|하루가|밤이 지나|\d+\s*일\s*(?:뒤|후|만에|이 지나)|며칠|일주일)/u;
  // --- v0.13.0: time of day. 'HH:MM' (24h) when a clock time is written, otherwise a period word. ---
  const GFQ_PERIODS=['새벽','아침','오전','점심','오후','저녁','밤','심야'];
  function gfqPeriodOfHour(h){return h<4?'심야':h<6?'새벽':h<9?'아침':h<12?'오전':h<14?'점심':h<18?'오후':h<21?'저녁':h<24?'밤':'심야';}
  // The first clock time in a text → {time:'HH:MM',period}. hint: the period in force, for a bare '7시'.
  function gfqTimeIn(text,hint){
    const s=String(text||'');
    const m=s.match(/(오전|오후|새벽|아침|낮|점심|저녁|밤|심야|AM|PM|am|pm)?\s*(\d{1,2})\s*(?::\s*(\d{2})(?!\d)|시(?![간대작장민청각점])(?!\s*방향)\s*(?:(\d{1,2})\s*분|(반))?)/u);
    if(m){
      let h=+m[2];const mi=m[3]?+m[3]:m[4]?+m[4]:m[5]?30:0,p=m[1]||'';
      if(h<=24&&mi<=59){
        if(/^(오후|저녁|밤|PM|pm)$/.test(p)&&h<12)h+=12;
        else if(/^(낮|점심)$/.test(p)&&h<7)h+=12;
        else if(/^(오전|새벽|아침|심야|AM|am)$/.test(p)&&h===12)h=0;
        else if(p==='밤'&&h===12)h=0;
        else if(!p&&h<12&&h>=1&&['오후','저녁','밤'].includes(hint))h+=12;
        h%=24;
        // keep the story's own word ('오후 6시' stays 오후); the hour decides when none is given
        return {time:String(h).padStart(2,'0')+':'+String(mi).padStart(2,'0'),period:GFQ_PERIODS.includes(p)?p:gfqPeriodOfHour(h)};
      }
    }
    if(/정오/.test(s))return {time:'12:00',period:'점심'};
    if(/자정/.test(s))return {time:'00:00',period:'심야'};
    return null;
  }
  // A period named or described in a text ('해가 지고' → 저녁).
  function gfqPeriodIn(text){
    const s=String(text||'');
    for(const [p,re] of [['심야',/심야|한밤중|자정/],['새벽',/새벽|동틀|동이 트|여명/],['저녁',/저녁|노을|해 질|해가 지|석양|땅거미|퇴근길/],['점심',/점심|정오|한낮/],['아침',/아침|해가 뜨|해돋이|조식|출근길/],['오전',/오전/],['오후',/오후|해가 기울/],['밤',/밤(?![나송톨])|달빛|야간|어둠이 내려/]])if(re.test(s))return p;
    return '';
  }
  // A story day runs from 04:00 to 04:00, so '밤 → 심야' is the same night and '밤 → 아침' is the next day.
  function gfqClockRank(c){
    if(!c)return null;
    if(c.time){const h=+c.time.slice(0,2),m=+c.time.slice(3,5);return (h<4?h+24:h)*60+m;}
    const i=GFQ_PERIODS.indexOf(c.period);return i<0?null:[4,6,9,12,14,18,21,24][i]*60;
  }
  // true when going from clock a to clock b means a new day (b is clearly earlier in the day than a).
  function gfqClockWraps(a,b){const x=gfqClockRank(a),y=gfqClockRank(b);return x!==null&&y!==null&&y<x-90;}
  function gfqClockText(c){
    if(!c)return '';
    if(!c.time)return c.period||'';
    const h=+c.time.slice(0,2),mi=c.time.slice(3,5);
    return (c.period||gfqPeriodOfHour(h))+' '+(h%12||12)+(mi==='00'?'시':':'+mi);
  }
  const gfqClockOf=o=>o&&(o.time||o.period)?{...(o.time?{time:o.time}:{}),period:o.period||gfqPeriodOfHour(+String(o.time).slice(0,2))}:null;
  // Pure: validate the AI's clock for one batch. A time must be written in its evidence; a period must be named or described there.
  function gfqClockFrom(tl,texts){
    if(!tl||typeof tl!=='object')return null;
    const loc=raw=>{raw=typeof raw==='string'?raw.trim():'';if(raw.length<2)return null;return gfqLocateEvidence(raw,texts)||(texts.some(t=>String(t).includes(raw))?raw:null);};
    const hm=typeof tl.currentTime==='string'?tl.currentTime.trim().match(/^(\d{1,2}):(\d{2})$/):null;
    if(hm&&+hm[1]<24&&+hm[2]<60){
      const tev=loc(tl.timeEvidence),c=tev?gfqTimeIn(tev,''):null,want=String(+hm[1]).padStart(2,'0')+':'+hm[2];
      if(c&&(c.time===want||(+c.time.slice(0,2))%12===(+hm[1])%12&&c.time.slice(3)===hm[2]))return {time:want,period:gfqPeriodOfHour(+hm[1]),timeEvidence:tev};
    }
    const p=typeof tl.timeOfDay==='string'?tl.timeOfDay.trim():'';
    if(GFQ_PERIODS.includes(p)){
      const pev=loc(tl.timeOfDayEvidence),c=pev?gfqTimeIn(pev,''):null;
      if(pev&&(gfqPeriodIn(pev)===p||c?.period===p))return {period:p,timeEvidence:pev};
    }
    return null;
  }
  // Pure: validate the AI's timeline for one batch. Returns {date,basis,evidence[,time,period,timeEvidence]} or null.
  function gfqTimelineFrom(tl,texts,prevDate,prevClock){
    if(!tl||typeof tl!=='object')return null;
    const clock=gfqClockFrom(tl,texts),withClock=o=>clock?{...o,...clock}:o;
    const ev=typeof tl.dateEvidence==='string'&&tl.dateEvidence.trim().length>=4?gfqLocateEvidence(tl.dateEvidence.trim(),texts):null;
    const date=typeof tl.currentDate==='string'?tl.currentDate.trim():'';
    if(ev&&date&&gfqDatesIn(ev).includes(date))return withClock({date,basis:'원문',evidence:ev});
    const raw=typeof tl.daysEvidence==='string'?tl.daysEvidence.trim():'';
    // Day-change cues are short ('다음 날 아침'), so a verbatim match is accepted here.
    const n=Number(tl.daysPassed),dev=raw.length>=2?(gfqLocateEvidence(raw,texts)||(texts.some(t=>String(t).includes(raw))?raw:null)):null;
    if(prevDate&&Number.isSafeInteger(n)&&n>=1&&n<=60&&dev&&GFQ_DAY_WORDS.test(dev))return withClock({date:gfqAddDays(prevDate,n),basis:'추정',evidence:dev});
    // v0.13.0: no written day change, but the clock went back (밤 → 아침): the next morning. Otherwise the same day.
    if(prevDate&&clock)return {date:gfqClockWraps(prevClock,clock)?gfqAddDays(prevDate,1):prevDate,basis:'추정',evidence:clock.timeEvidence,...clock};
    return null;
  }
  // Pure: the AI's world-fitting date for a story that never writes one. A year the story does write wins over the AI's.
  function gfqWorldDateFrom(tl,texts){
    const raw=typeof tl?.worldDate==='string'?tl.worldDate.trim():'';
    const m=raw.match(/^(\d{1,4})-(\d{1,2})-(\d{1,2})$/);if(!m)return null;
    const years=gfqYearsIn((texts||[]).join('\n'));
    const y=years.length&&!years.some(v=>v.year===+m[1])?years[0].year:+m[1];
    const date=gfqYmd(y,+m[2],+m[3]);if(!date)return null;
    const era=typeof tl.era==='string'?tl.era.trim():'';
    const clock=gfqClockOf({time:/^\d{2}:\d{2}$/.test(String(tl.worldTime||''))&&+String(tl.worldTime).slice(0,2)<24?tl.worldTime:'',period:GFQ_PERIODS.includes(tl.worldTimeOfDay)?tl.worldTimeOfDay:''});
    return {date,reason:String(tl.worldDateReason||'').replace(/\s+/g,' ').trim().slice(0,120),
      ...(era&&/^[가-힣]{1,5}(?:력|기)$/.test(era)&&(texts||[]).some(t=>String(t).includes(era))?{era}:{}),...(clock||{})};
  }
  // Years written in the story ('2033년', '제국력 312년'), most frequent first.
  function gfqYearsIn(text){
    const n=new Map();
    for(const m of String(text||'').matchAll(/(?:([가-힣]{1,5}(?:력|기))\s*)?(\d{1,4})\s*년(?!\s*(?:전|후|뒤|간|째|동안|만|차|생))(?:\s*(\d{1,2})\s*월)?/gu)){
      if(m[2].length<4&&!m[1])continue;const y=+m[2];if(!(y>=1&&y<=9999))continue;
      const e=n.get(y)||{year:y,count:0,era:m[1]||'',month:0};e.count++;if(m[1])e.era=m[1];if(m[3]&&+m[3]>=1&&+m[3]<=12)e.month=+m[3];n.set(y,e);
    }
    return [...n.values()].sort((a,b)=>b.count-a.count);
  }
  // Pure fallback when no AI answer is available: a written year (or this year) and the season the story describes.
  function gfqGuessWorldDate(w,nowYear){
    const text=gfqStoryRecords(w).map(r=>r.text).join('\n')+'\n'+String(w?.gfDisplayName||'');
    const y=gfqYearsIn(text)[0]||null;
    const count=re=>(text.match(re)||[]).length;
    const seasons=[[4,1,'봄',count(/봄|벚꽃|개나리|입학식|새 학기/gu)],[7,15,'여름',count(/여름|장마|매미|폭염|열대야/gu)],[10,10,'가을',count(/가을|단풍|낙엽|추석/gu)],[12,15,'겨울',count(/겨울|눈이 내|폭설|함박눈|크리스마스|성탄/gu)]].sort((a,b)=>b[3]-a[3]);
    const s=seasons[0][3]?seasons[0]:null,month=y?.month||(s?s[0]:3),day=y?.month?1:(s?s[1]:2);
    const year=y?y.year:(nowYear||new Date().getFullYear());
    const reason=[y?'원문의 '+(y.era?y.era+' ':'')+y.year+'년'+(y.month?' '+y.month+'월':''):'연도 단서 없음 → 현재 연도',s&&!y?.month?s[2]+' 묘사':''].filter(Boolean).join(', ');
    return {date:gfqYmd(year,month,day),reason,...(y?.era?{era:y.era}:{})};
  }
  function gfqCurrentDate(w){
    const auto=Object.entries(w?.gfDates||{}).map(([ch,v])=>({ch:Number(ch)||0,...v})).filter(v=>v.date).sort((a,b)=>a.ch-b.ch).pop()||null;
    // v0.4.6: a date line the reader has reached, or a manual entry, is 'now'. Dates analysed ahead
    // of the reader (a chapter generated but not yet read) only apply to later chapters.
    const man=w?.gfDateManual?{...w.gfDateManual,basis:w.gfDateManual.by==='ai'?'세계관 추정':'직접 입력',ms:Number(w.gfDateManual.ms||0)}:null;
    const read=w?.gfReadingDate?{...w.gfReadingDate,basis:w.gfReadingDate.est?'추정':'읽은 장면',ms:Number(w.gfReadingDate.ms||0)}:null;
    const live=[man,read].filter(Boolean).sort((a,b)=>a.ms-b.ms).pop()||null;
    const clock=o=>gfqClockOf(o)||{};
    if(live&&(!auto||Number(live.chapter||0)>=auto.ch))return {date:live.date,basis:live.basis,source:live.chapter?'챕터 '+live.chapter+(live.basis==='직접 입력'?' 이후':''):'',chapter:Number(live.chapter||0),ms:live.ms,...(live.reason?{reason:live.reason}:{}),...clock(live)};
    if(auto)return {date:auto.date,basis:auto.basis,source:'챕터 '+auto.ch,chapter:auto.ch,evidence:auto.evidence,...clock(auto)};
    // v0.13.0: the story has not written a date yet: the world-fitting date chosen for it.
    const a=w?.gfDateAnchor;
    return a?.date?{date:a.date,basis:'세계관 추정',source:a.chapter?'챕터 '+a.chapter+'부터':'',chapter:Number(a.chapter||0),ms:Number(a.ms||0),...(a.reason?{reason:a.reason}:{}),...clock(a)}:null;
  }
  // v0.13.0: the time of day now. A clock reading counts only for the date it was read on.
  function gfqCurrentClock(w){
    const d=gfqCurrentDate(w),cands=[];
    if(d&&(d.time||d.period))cands.push({...d,ms:Number(d.ms||0),chapter:Number(d.chapter||0),date:d.date});
    for(const [k,basis] of [['gfReadingTime','읽은 장면'],['gfTimeManual','직접 입력']]){const c=w?.[k];if(c&&(c.time||c.period))cands.push({...c,basis,ms:Number(c.ms||0),chapter:Number(c.chapter||0)});}
    const ok=cands.filter(c=>!d||(c.chapter>=Number(d.chapter||0)&&c.ms>=Number(d.ms||0)&&(!c.date||c.date===d.date)));
    const best=ok.sort((a,b)=>a.ms-b.ms).pop();
    return best?{...gfqClockOf(best),basis:best.basis}:null;
  }
  const gfqWeekday=ymd=>{const [y,m,d]=ymd.split('-').map(Number);return '일월화수목금토'[gfqUTC(y,m,d).getUTCDay()];};
  function gfqDayDiff(a,b){const t=x=>{const [y,m,d]=x.split('-').map(Number);return gfqUTC(y,m,d).getTime();};return Math.round((t(b)-t(a))/864e5);}
  // Display: '2033.04.09', or '제국력 312년 4월 9일' in a world with its own calendar (no weekday there).
  function gfqDateText(w,ymd){
    if(!ymd)return '';const [y,m,d]=ymd.split('-').map(Number);
    return w?.gfEra?w.gfEra+' '+y+'년 '+m+'월 '+d+'일':y<1000?y+'년 '+m+'월 '+d+'일':ymd.replace(/-/g,'.');
  }
  function gfqDayText(w,ymd){if(!ymd)return '';const wd=w?.gfEra?'':gfqWeekday(ymd);return gfqDateText(w,ymd)+(wd?' ('+wd+')':'');}
  // '내일 이 시간' said in chapter 3 → the date it points to, when chapter 3's date is known.
  function gfqResolveTiming(w,t){
    if(!t||!t.text)return null;
    const ch=(String(t.anchor||'').match(/챕터\s*(\d+)/u)||[])[1];
    const cur=ch&&!w?.gfDates?.[ch]?.date?gfqCurrentDate(w):null;
    const base=t.base||(ch&&w?.gfDates?.[ch]?.date)||(cur&&Number(cur.chapter)===Number(ch)?cur.date:null)||null;if(!base)return null;
    const m=t.text.match(/(\d+)\s*일\s*(?:후|뒤)/u);
    const n=m?+m[1]:/모레/.test(t.text)?2:/(내일|익일|다음\s?날)/u.test(t.text)?1:/(오늘|금일)/.test(t.text)?0:null;
    return n===null?null:gfqAddDays(base,n);
  }
  // v0.4.5: date headings. A line that is just a date ('2033-04-09', '[2033년 4월 9일 (수)]') sets the date
  // for every line below it until the next heading, across scenes and chapters.
  // v0.13.0: also '4월 9일 (수) 저녁', '3일차', 'DAY 3', 'D+2', a time line ('오후 3시 20분', '[밤]') and fictional eras.
  // Pure: a marker line → {date?,era?,md?,day?,time?,period?}; anything else → null.
  function gfqParseStamp(line){
    let t=String(line||'').trim();
    if(!t||t.length>40)return null;
    const deco=/^[\[\(<【〈《「『*#\-—–~=]/u.test(t);
    t=t.replace(/^[\[\(<【〈《「『*#\-—–~=\s]+/u,'');
    let out=null,rest='',m;
    if((m=t.match(/^(?:([가-힣]{1,5}(?:력|기))\s*)?(\d{1,4})\s*(년\s*|[-./])\s*(\d{1,2})\s*(?:[-./]|월\s*)\s*(\d{1,2})\s*일?/u))&&(m[2].length===4||m[1]||/년/.test(m[3]))){
      const d=gfqYmd(+m[2],+m[4],+m[5]);if(d){out={date:d,...(m[1]?{era:m[1]}:{})};rest=t.slice(m[0].length);}
    }
    let strict=false;
    if(!out&&(m=t.match(/^(\d{1,2})\s*월\s*(\d{1,2})\s*일/u))&&+m[1]>=1&&+m[1]<=12&&+m[2]>=1&&+m[2]<=31){out={md:[+m[1],+m[2]]};rest=t.slice(m[0].length);strict=true;}
    if(!out&&(m=t.match(/^(?:제\s*)?(\d{1,4})\s*일\s*차|^day\s*(\d{1,4})(?![\d])|^d\s*\+\s*(\d{1,4})(?![\d])/iu))){out={day:m[1]?+m[1]:m[2]?+m[2]:+m[3]+1};rest=t.slice(m[0].length);strict=true;if(!(out.day>=1))return null;}
    if(out){
      const c=gfqTimeIn(rest,'');
      if(c)Object.assign(out,c);else{const p=gfqPeriodIn(rest);if(p)out.period=p;}
      // a month-day or day-count line must be a marker, not the start of a sentence ('4월 9일, 그녀는 …')
      if(strict&&rest.replace(/[월화수목금토일]요일|\([월화수목금토일]\)/gu,'').replace(/\d{1,2}\s*(?::\s*\d{2}|시(?:\s*\d{1,2}\s*분|\s*반)?)/gu,'').replace(/오전|오후|새벽|아침|낮|점심|저녁|밤|심야|정오|자정|무렵|즈음|쯤|경/gu,'').replace(/[\s\[\]\(\)<>【】〈〉《》「」『』*#\-—–~=.,·|:]+/gu,'').length)return null;
      return out;
    }
    // a line that is only a time: '오후 3시 20분', '[밤]', '— 새벽 —'
    const bare=t.replace(/[\]\)>】〉》」』*#\-—–~=\s.,]+$/u,'').trim();
    if(!bare||bare.length>16)return null;
    if(/^(?:(?:오전|오후|새벽|아침|낮|점심|저녁|밤|심야)\s*\d{1,2}\s*(?::\s*\d{2}|시(?:\s*(?:\d{1,2}\s*분|반))?)|\d{1,2}\s*시(?:\s*(?:\d{1,2}\s*분|반))?|정오|자정)(?:\s*(?:무렵|경|즈음|쯤))?$/u.test(bare))return gfqTimeIn(bare,'');
    if(deco){const p=bare.replace(/\s*(?:무렵|즈음|쯤)$/u,'');if(GFQ_PERIODS.includes(p))return {period:p};}
    return null;
  }
  function gfqDateHeading(line){const s=gfqParseStamp(line);return s&&s.date||null;}
  // Pure: a parsed marker → the date it names, given the date in force, the last 'N일차' seen and the world-fitting date.
  function gfqResolveStamp(s,cur,lastDay,anchor){
    if(!s)return null;
    if(s.date)return s.date;
    if(s.md){
      const base=cur||anchor;if(!base)return null;const y=+base.slice(0,4);
      let d=gfqYmd(y,s.md[0],s.md[1]);if(!d)return null;
      if(gfqDayDiff(base,d)<-200)d=gfqYmd(y+1,s.md[0],s.md[1])||d; // the year rolled over
      return d;
    }
    if(s.day){
      if(lastDay?.date&&lastDay.n)return gfqAddDays(lastDay.date,s.day-lastDay.n);
      if(cur)return cur;
      return anchor?gfqAddDays(anchor,s.day-1):null;
    }
    return null;
  }
  function gfqDateMap(w){
    let cur=null,lastDay=null,clock=null,est=false;const recs=[],anchor=w?.gfDateAnchor?.date||null;
    for(const r of gfqStoryRecords(w)){
      const changes=[],start=cur;let off=0,hasDate=false,hasClock=false;
      for(const line of r.text.split('\n')){
        const s=gfqParseStamp(line);
        if(s){
          let d=gfqResolveStamp(s,cur,lastDay,anchor);const c=gfqClockOf(s),marked=!!d;
          // a clock going back without a date marker: the next day (an estimate the AI timeline may still refine)
          if(!d&&c&&cur&&gfqClockWraps(clock,c)){d=gfqAddDays(cur,1);est=true;}
          else if(d)est=!s.date&&!(s.md&&cur)&&!(s.day&&(lastDay||cur));
          if(d){if(d!==cur)clock=null;cur=d;if(marked)hasDate=true;if(s.day)lastDay={n:s.day,date:d};}
          if(c){clock=c;hasClock=true;}
          if(cur&&(d||c))changes.push({at:off,date:cur,...(s.era?{era:s.era}:{}),...(clock||{})});
        }
        off+=line.length+1;
      }
      recs.push({source:r.source,text:r.text,start,changes,end:cur,endClock:clock,endEst:est,hasDate,hasClock});
    }
    return recs;
  }
  function gfqDateAt(map,evidence){
    if(!evidence)return null;
    for(const r of map){
      let at=r.text.indexOf(evidence);
      if(at<0){const loc=gfqLocateEvidence(evidence,[r.text]);if(!loc)continue;at=r.text.indexOf(loc);}
      let d=r.start;for(const c of r.changes)if(c.at<=at)d=c.date;
      return d;
    }
    return null;
  }
  // Per chapter: the date (and clock) its markers leave in force. kind 'date' = chapters with a date marker,
  // 'clock' = chapters with only time markers (their date is the one carried in).
  function gfqHeadingDates(map,kind='date'){
    const chOf=r=>(String(r.source).match(/^챕터\s*([^·\s]+)/u)||[])[1];
    const dated=new Set(map.filter(r=>r.hasDate).map(chOf)),out={};
    for(const r of map){
      const ch=chOf(r);
      if(!ch||ch==='?'||!r.changes.length||!r.end||(kind==='date')!==dated.has(ch))continue;
      const c=r.endClock;
      out[ch]={date:r.end,basis:kind==='date'&&!r.endEst?'원문':'추정',evidence:(kind==='date'?'날짜 표시 ':'시각 표시 ')+r.end+(c?' '+gfqClockText(c):''),source:'챕터 '+ch,...(c||{})};
    }
    return out;
  }
  const gfqHeadingClocks=map=>gfqHeadingDates(map,'clock');
  const gfqMapEra=map=>{for(const r of map)for(const c of r.changes)if(c.era)return c.era;return '';};
  function gfqStampDates(map,p){
    p.date=gfqDateAt(map,p.evidence)||p.date||null;
    if(p.category==='quest'){const l=gfqEvidenceList(p);p.endDate=gfqDateAt(map,l[l.length-1])||p.date;}
    return p;
  }
  // v0.3.12: words that mark cash income vs. discounts/free services.
  const GFQ_CASH_WORDS=/(수당|보수|급여|기본급|정산금|대금|상금|사례금|보상금|지원금|위로금|일당|월급|용역비)/u;
  const GFQ_DISCOUNT_WORDS=/(감면|할인|우대|면제|무상|무료)/u;
  // Every amount written in a text (1,400,000 / 140만 / 1.5억 / 50퍼센트 ...).
  // v0.7.3: currencies differ by world (원, 골드, 냥, 전, 금화, 크레딧 …). Units are kept as the story writes them, mapped to
  // one name per currency; totals are kept per currency and never mixed. The main currency is chosen by the player,
  // else the one the story uses most, else the theme's usual one.
  const GFQ_CURRENCIES=[['원',['원'],1e6],['골드',['골드','gold','Gold','GOLD','G'],1e3],['실버',['실버','silver','Silver'],1e4],['금화',['금화'],100],['은화',['은화'],1e3],['동전',['동화','동전'],1e4],['냥',['냥','량'],100],['전',['전','푼','문','닢'],1e3],['돈',['돈쭝','돈'],10],['관',['관'],10],['크레딧',['크레딧','credits','credit','Credits','Credit','CR','Cr'],1e4],['달러',['달러','불','$'],1e4],['엔',['엔','¥'],1e6],['위안',['위안'],1e4],['유로',['유로','€'],1e4],['코인',['코인','coin','coins'],1e3]];
  const GFQ_UNIT_OF=new Map(GFQ_CURRENCIES.flatMap(([u,al])=>al.map(a=>[a.toLowerCase(),u])));
  const gfqUnit=u=>{const s=String(u||'').trim();return GFQ_UNIT_OF.get(s.toLowerCase())||s;};
  const gfqIsMoneyUnit=u=>GFQ_CURRENCIES.some(c=>c[0]===gfqUnit(u));
  const GFQ_THEME_UNIT={modern:'원',east:'냥',fantasy:'골드',sf:'크레딧',school:'원'};
  const GFQ_UNIT_ALT=GFQ_CURRENCIES.flatMap(c=>c[1]).sort((a,b)=>b.length-a.length).map(a=>a.replace(/[$]/g,'\\$')).join('|');
  const GFQ_NATIVE_NUM='(?:(?:열|스물|스무|서른|마흔|쉰|예순|일흔|여든|아흔)(?:한|하나|두|둘|세|셋|네|넷|다섯|여섯|일곱|여덟|아홉)?|한|두|세|석|서|네|넉|너|다섯|닷|여섯|엿|일곱|여덟|아홉)';
  // Korean number words: sino ('삼백', '이천오백') or native ('열', '스물두', '닷').
  function gfqKNum(s){
    s=String(s||'').replace(/\s+/g,'');if(!s)return NaN;
    if(/^[일이삼사오육칠팔구십백천만억]+$/u.test(s)){
      const d={일:1,이:2,삼:3,사:4,오:5,육:6,칠:7,팔:8,구:9},p={십:10,백:100,천:1000};let total=0,sec=0,num=0;
      for(const ch of s){if(d[ch])num=d[ch];else if(p[ch]){sec+=(num||1)*p[ch];num=0;}else if(ch==='만'||ch==='억'){total+=(sec+num||1)*(ch==='만'?1e4:1e8);sec=0;num=0;}}
      return total+sec+num;
    }
    const tens={열:10,스물:20,스무:20,서른:30,마흔:40,쉰:50,예순:60,일흔:70,여든:80,아흔:90},ones={한:1,하나:1,두:2,둘:2,세:3,셋:3,석:3,서:3,네:4,넷:4,넉:4,너:4,다섯:5,닷:5,여섯:6,엿:6,일곱:7,여덟:8,아홉:9};
    let n=0;for(const [k,v] of Object.entries(tens))if(s.startsWith(k)){n=v;s=s.slice(k.length);break;}
    if(s){if(!(s in ones))return NaN;n+=ones[s];}
    return n||NaN;
  }
  // Every money amount in a text, with its currency: [{n, unit}]. Digits ('1,200 골드', '3만 냥') and words ('닷 냥', '은화 서른 닢' style '서른 닢').
  function gfqMoneyIn(text){
    const t=String(text||''),out=[];
    const re=new RegExp('(\\d[\\d,]*(?:\\.\\d+)?)\\s*(억|만|천)?\\s*('+GFQ_UNIT_ALT+')(?![A-Za-z])','gu');
    for(const m of t.matchAll(re)){const n=Number(m[1].replace(/,/g,''))*(m[2]==='억'?1e8:m[2]==='만'?1e4:m[2]==='천'?1e3:1);if(Number.isFinite(n))out.push({n,unit:gfqUnit(m[3]),at:m.index,end:m.index+m[0].length});}
    const rw=new RegExp('(?<![가-힣\\d,.])([일이삼사오육칠팔구십백천만억]+|'+GFQ_NATIVE_NUM+')\\s*('+GFQ_UNIT_ALT+')(?![A-Za-z])','gu');
    for(const m of t.matchAll(rw)){if(m[2]==='원'&&!/[백천만억]/u.test(m[1]))continue;if(['문','불','량'].includes(m[2])||(m[2]==='전'&&/^[일이삼사오육칠팔구]$/u.test(m[1])))continue;const n=gfqKNum(m[1]);if(Number.isFinite(n)&&n>0)out.push({n,unit:gfqUnit(m[2]),at:m.index,end:m.index+m[0].length});}
    // '은화 서른 닢', '금화 12닢': the counter 닢 belongs to the coin named just before it.
    for(const x of out){const raw=t.slice(x.at,x.end);if(/닢\s*$/u.test(raw)){const before=t.slice(Math.max(0,x.at-8),x.at).match(/(금화|은화|동화|동전|엽전|은전|금전)\s*$/u);x.unit=before?gfqUnit(before[1]==='엽전'||before[1]==='금전'||before[1]==='은전'?'전':before[1]):'전';}}
    return out;
  }
  const gfqCurCache=new Map();
  function gfqDetectUnit(w){
    const samples=w?.gfStorySamples||[],key=samples.length+'|'+(samples[samples.length-1]?.id||'')+'|'+(w?.gfLedger||[]).length;
    const hit=gfqCurCache.get(w);if(hit&&hit.key===key)return hit.unit;
    const count=new Map();
    for(const s of samples.slice(-120))for(const m of gfqMoneyIn(s.text))count.set(m.unit,(count.get(m.unit)||0)+1);
    for(const t of w?.gfLedger||[])if(gfqIsMoneyUnit(t.unit))count.set(gfqUnit(t.unit),(count.get(gfqUnit(t.unit))||0)+3);
    const best=[...count].sort((a,b)=>b[1]-a[1])[0];const unit=best&&best[1]>=2?best[0]:'';
    gfqCurCache.set(w,{key,unit});return unit;
  }
  function gfqMainUnit(w){return (w?.gfCurrency&&String(w.gfCurrency))||gfqDetectUnit(w)||GFQ_THEME_UNIT[w?.gfTheme]||'원';}
  const gfqMoneyScale=u=>(GFQ_CURRENCIES.find(c=>c[0]===gfqUnit(u))||[0,0,1e3])[2];
  // v0.7.7 storage: browsers give each site roughly 5M characters of localStorage. Measure, warn once, and clean only on request.
  var GFQ_STORE_LIMIT=5e6,gfqStoreWarned=false; // var: save() can run before this line during start-up
  function gfqStorageWarn(len){if(gfqStoreWarned||len<(GFQ_STORE_LIMIT||5e6)*0.7)return;gfqStoreWarned=true;try{gfqToast('저장 공간 '+Math.round(len/GFQ_STORE_LIMIT*100)+'% 사용','설정 탭의 저장 공간에서 정리할 수 있습니다. 정리 전에 백업 내보내기를 권해 드립니다.','warn');}catch{}}
  const GFQ_STORE_PARTS=[['gfStorySamples','스토리 장면'],['history','변경 기록'],['aiProposals','검토 대기'],['gfLedger','거래 내역'],['quests','퀘스트'],['gfCast','인물'],['gfPlaces','장소'],['gfChapterIndex','챕터 목록']];
  function gfqStorageInfo(w){
    const len=v=>{try{return JSON.stringify(v??null).length;}catch{return 0;}};
    const snap=gfqSnapLen(),total=len(data)+snap,cur=len(w),parts=GFQ_STORE_PARTS.map(([k,label])=>({k,label,n:len(w?.[k])})).filter(x=>x.n>4);
    const known=parts.reduce((a,x)=>a+x.n,0);parts.sort((a,b)=>b.n-a.n);
    return {total,snap,ratio:total/GFQ_STORE_LIMIT,cur,other:Math.max(0,total-cur-snap),parts,rest:Math.max(0,cur-known)};
  }
  function gfqStoragePlan(w){
    const s=w.gfStorySamples||[],chs=[...new Set(s.map(x=>Number(x.chapter)).filter(Number.isFinite))].sort((a,b)=>b-a).slice(0,3);
    return {samples:s.filter(x=>!chs.includes(Number(x.chapter))).length,history:Math.max(0,(w.history||[]).length-200),keep:chs.sort((a,b)=>a-b)};
  }
  function gfqKB(n){return n>=1e6?(n/1e6).toFixed(1)+'M':n>=1e3?Math.round(n/1e3)+'K':String(n);}
  function gfqStorageHtml(w){
    const st=gfqStorageInfo(w),pl=gfqStoragePlan(w),pct=Math.min(100,Math.round(st.ratio*100));
    return '<div class="gfq-card gfq-store"><b>저장 공간</b><div class="gfq-meter'+(pct>=70?' hot':'')+'" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+pct+'" aria-label="저장 공간 사용량"><i style="width:'+Math.max(2,pct)+'%"></i></div>'+
      '<p class="gfq-muted">브라우저 저장소 약 '+gfqKB(GFQ_STORE_LIMIT)+'자 중 <b>'+gfqKB(st.total)+'자('+pct+'%)</b>를 쓰고 있습니다. 이 월드 '+gfqKB(st.cur)+(st.other>200?' · 다른 월드 '+gfqKB(st.other):'')+(st.snap?' · 자동 복원 지점 '+gfqKB(st.snap):'')+'</p>'+
      '<div class="gfq-store-parts">'+st.parts.slice(0,6).map(x=>'<span>'+esc(x.label)+' <b class="gfq-num">'+gfqKB(x.n)+'</b></span>').join('')+'</div>'+
      (pl.samples||pl.history?'<p class="gfq-muted">정리하면 최근 챕터('+esc(pl.keep.join(', '))+')를 뺀 스토리 장면 '+pl.samples+'개와 오래된 변경 기록 '+pl.history+'개를 지웁니다. 퀘스트·거래·인물·장소는 그대로 둡니다. 지운 장면은 기록 탭의 \'기존 스토리 목록 조회\'로 다시 모을 수 있습니다.</p>'+btn('저장 공간 정리','storage-clean'):'<p class="gfq-muted">지금은 정리할 항목이 없습니다.</p>')+'</div>';
  }
  function gfqCurrencyHtml(w){
    const cur=w.gfCurrency||'',auto=gfqDetectUnit(w),main=gfqMainUnit(w);
    return '<div class="gfq-card"><b>주 화폐</b><p class="gfq-muted">소지금·돈 요약은 주 화폐로 계산합니다. 다른 화폐 거래도 각각 기록되며 서로 더하지 않습니다. 지금 주 화폐: <b>'+esc(main)+'</b>'+(auto?' (스토리에서 가장 많이 나온 화폐: '+esc(auto)+')':' (스토리에서 아직 화폐를 찾지 못해 테마 기본값을 씁니다)')+'</p>'+
      '<div class="gfq-row gfq-units">'+'<button data-action="pick-unit" data-id="" aria-pressed="'+(!cur)+'">자동</button>'+GFQ_CURRENCIES.map(([u])=>'<button data-action="pick-unit" data-id="'+esc(u)+'" aria-pressed="'+(cur===u)+'">'+esc(u)+'</button>').join('')+btn('직접 입력','pick-unit-custom')+'</div></div>';
  }
  function gfqAmountsIn(text){
    const out=new Set(),t=String(text||'');
    for(const m of t.matchAll(/(\d[\d,]*(?:\.\d+)?)\s*(억|만|천)?/gu)){
      const n=Number(m[1].replace(/,/g,''));if(!Number.isFinite(n))continue;
      out.add(m[2]==='억'?n*1e8:m[2]==='만'?n*1e4:m[2]==='천'?n*1e3:n);
      if(m[2]==='만'||m[2]==='억')out.add(n); // "140만" may also be read as 140
    }
    for(const x of gfqMoneyIn(t))out.add(x.n); // v0.7.3: '닷 냥', '삼백 골드'
    return out;
  }
  function gfqSafeProposal(x,ctx=GFQ_GENERIC){
    const result={...x};
    const q=String(result.evidence||''),name=String(result.name||'');
    // v0.3.10: "N원 상당의 <물품>" is the value of goods, never cash owed or received.
    if(['asset','contract'].includes(result.category)&&!GFQ_CASH_WORDS.test(name)&&new RegExp('(?:'+GFQ_UNIT_ALT+')\\s*상당(?:의)?\\s*(?!금액|현금|액수)\\S','u').test(q)){
      const got=/(수령했|받았|건네받|지급받았|손에 넣)/u.test(q);
      Object.assign(result,{category:'item',status:got?'confirmed':'active',financialStatus:got?'ownership':'pending',
        value:typeof result.amount==='number'?result.amount:(gfqMoneyIn(q)[0]?.n??null),valueUnit:gfqIsMoneyUnit(result.unit)?gfqUnit(result.unit):(gfqMoneyIn(q)[0]?.unit||''),amount:null,unit:'',
        auditNote:'금액은 물품의 가치이며 현금이 아닙니다. '+(got?'수령한 물품':'수령 예정 물품')+'으로 분류했습니다.'});
    }
    // v0.3.11: a future discount (e.g. '공임 50퍼센트 감면 보장') is a benefit voucher, not money.
    if(['asset','contract'].includes(result.category)&&!GFQ_CASH_WORDS.test(name)&&(String(result.unit||'')==='%'||/퍼센트|%/.test(name))&&GFQ_DISCOUNT_WORDS.test(name+' '+q)){
      result.category='benefit';
    }
    // v0.3.12: money labelled as a benefit goes back to the ledger (수당·보수는 이용권이 아니라 자산입니다).
    if(result.category==='benefit'&&GFQ_CASH_WORDS.test(name)&&(gfqIsMoneyUnit(result.unit)||!GFQ_DISCOUNT_WORDS.test(name))){
      const mixed=GFQ_DISCOUNT_WORDS.test(name);
      Object.assign(result,{category:'asset',financialStatus:['received','receivable','pending'].includes(result.financialStatus)?result.financialStatus:'pending',
        auditNote:'금전 보수이므로 혜택이 아닌 거래로 분류했습니다.'+(mixed?' 함께 언급된 할인·감면 혜택은 별도 항목으로 확인해 주세요.':'')});
    }
    if(['asset','contract'].includes(result.category)&&gfqIsCond(result)){
      Object.assign(result,{financialStatus:'conditional',auditNote:'조건부 보장입니다(철수·실패 같은 조건이 생길 때만 받는 최소 금액). 총액에 더하지 않고 거래 내역·받을 돈에도 넣지 않습니다.'});
    }
    if(result.category==='benefit'){
      // Voucher: a discount you can use later. Record: a waiver/free service already applied to a specific job. Permanent: ongoing perk.
      const future=/(감면|할인|우대)/u.test(name+' '+q)&&(String(result.unit||'')==='%'||/퍼센트|%|\d+\s*회|이용권|쿠폰|할인권|감면권/u.test(name+' '+q))&&!/(무상 적용|면제합니다|적용되며|적용됩니다)/u.test(q);
      result.benefitMode=result.benefitConsumed?'record':future?'voucher':result.benefitPermanent?'permanent':'record';
      result.benefitUses=Math.max(1,Math.min(99,Number.isSafeInteger(Number(result.benefitUses))?Number(result.benefitUses):1));
      result.auditNote=result.auditNote||(result.benefitMode==='voucher'?'앞으로 쓸 수 있는 할인 혜택입니다. 승인하면 이용권으로 소지품에 추가됩니다.':result.benefitMode==='permanent'?'상시 혜택입니다. 승인하면 프로필 탭의 보유 혜택으로 등록됩니다.':'이미 적용된 면제·무상 혜택입니다. 승인하면 기록만 남깁니다.');
    }
    if(['asset','contract'].includes(result.category)&&result.financialStatus==='received'){
      // Settled/closed accounts are not necessarily bank deposits.
      if(!/(입금(?:됐|되었|받았|완료| 확인)|계좌.{0,24}(입금|입금됐|들어왔)|송금(?:받|완료)|잔액.{0,20}(증가|늘어)|실제.{0,12}(수령|지급받)|(?:판매 ?대금|대금|현금|값).{0,16}(?:받았|건네받|수령했))/u.test(q)){
        result.financialStatus='receivable';result.auditNote='계좌 입금 근거가 없어 미수·정산 기록으로 보류했습니다.';
      }
    }
    // v0.3.5: the same deposit rule applies to quests and their reward candidates.
    if(result.category==='quest'){
      const deposit=/(입금(?:됐|되었|받았|완료| 확인)|계좌.{0,24}(입금|입금됐|들어왔)|송금(?:받|완료)|잔액.{0,20}(증가|늘어)|실제.{0,12}(수령|지급받)|(?:판매 ?대금|대금|현금|값).{0,16}(?:받았|건네받|수령했))/u;
      const done=result.status==='completed';
      if(result.financialStatus==='received'&&!deposit.test(q))result.financialStatus=done?'receivable':'pending';
      if(Array.isArray(result.questRewards)){
        let downgraded=false;
        result.questRewards=result.questRewards.map(r=>{
          if(!r||typeof r!=='object'||r.certainty!=='received'||r.kind!=='money')return r;
          if(deposit.test(String(r.evidence||''))||deposit.test(q))return r;
          downgraded=true;return {...r,certainty:done?'confirmed':'pending'};
        });
        if(downgraded)result.auditNote='보상 정산 표현만 있고 계좌 입금 근거가 없어 수령 확인에서 '+(done?'확정(미입금)':'지급 예정')+'으로 낮췄습니다.';
      }
    }
    if(result.category==='item'&&(/(내일|예정|제작 중|제작 건|수령하시게|상당)/.test(q)||gfqIsMoneyUnit(result.unit))){
      result.status='active';result.financialStatus='pending';
      result.auditNote='미수령·제작 중 물품 또는 시가 정보로 보입니다.';
    }
    if(ctx.legacy&&result.category==='asset'&&result.financialStatus==='pending'&&result.unit==='원'&&/(기본 수당|위험 수당)/.test(name))result.auditNote='동일 용역 보수 총액의 구성 항목일 수 있습니다. 합계에 중복 포함하지 마세요.';
    if(ctx.legacy&&result.category==='asset'&&result.financialStatus==='pending'&&result.amount===1400000&&/총액|정산/.test(name))result.auditNote='95만 원과 45만 원을 포함한 총액일 수 있습니다. 중복 합산하지 마세요.';
    // v0.3.5: only the evidenced Physical-class C license is normalised; other licenses keep their own names.
    if(ctx.legacy&&result.category==='credential'&&/면허/.test(name)&&/물리계/.test(name+' '+q)&&/C\s*급/.test(name+' '+q))result.name='물리계 C급 정식 면허';
    return result;
  }
  // v0.3.5: tolerant evidence lookup. Ignores spacing, quote style and light punctuation,
  // then returns the exact original span so stored evidence always matches the saved story.
  const GFQ_SKIP=/[\s.,!?~…·:;'"“”‘’「」『』()\[\]<>\-—–_*]/u;
  function gfqNormMap(text){
    const s=String(text||'').normalize('NFC');let out='';const map=[];
    for(let i=0;i<s.length;i++){if(GFQ_SKIP.test(s[i]))continue;out+=s[i];map.push(i);}
    return {s,out,map};
  }
  function gfqLocateEvidence(evidence,texts){
    const needle=gfqNormMap(evidence).out;
    if(needle.length<6)return null;
    for(const t of texts){
      const raw=String(t||'');
      if(raw.includes(evidence))return evidence;
      const m=gfqNormMap(raw),at=m.out.indexOf(needle);
      if(at<0)continue;
      return m.s.slice(m.map[at],m.map[at+needle.length-1]+1);
    }
    return null;
  }
  // v0.3.5: chronological story records (chapter premise first, then scenes in order).
  function gfqStoryRecords(w){
    const num=v=>{const n=Number(v);return Number.isFinite(n)?n:Number.MAX_SAFE_INTEGER;};
    const rows=[
      ...(w.gfChapterIndex||[]).map((c,i)=>({source:'챕터 '+c.chapter+' · 줄거리'+(c.cleared?' (게임 기록: 클리어)':''),text:String(c.premise||''),ch:num(c.chapter),ix:-1,order:i})),
      ...(w.gfStorySamples||[]).map((x,i)=>({source:'챕터 '+x.chapter+' · 장면 '+x.index,text:String(x.text||''),ch:num(x.chapter),ix:num(x.index),order:i,id:x.id}))
    ].filter(x=>x.text.trim());
    rows.sort((a,b)=>a.ch-b.ch||a.ix-b.ix||a.order-b.order);
    return rows.map(x=>({source:x.source,text:x.text,ch:x.ch,...(x.id?{id:x.id}:{})}));
  }
  // v0.3.9: one batch per chapter, because the game generates the story a chapter at a time.
  // A chapter too long for one call is split into consecutive parts; later parts and chapters
  // still see earlier results through the running context.
  function gfqChapterBatches(records,limit=15000){
    const batches=[];let batch=null,chars=0;
    const chapterOf=r=>String(r.source||'').match(/^챕터\s*([^·]+?)\s*·/)?.[1]||'?';
    for(const r of records){
      const item={source:r.source,text:String(r.text).slice(0,3500),...(r.id?{id:r.id}:{})},ch=chapterOf(r);
      if(!batch||batch.chapter!==ch||(batch.length&&chars+item.text.length>limit)){
        batch=[];batch.chapter=ch;batch.part=batches.filter(b=>b.chapter===ch).length+1;batches.push(batch);chars=0;
      }
      batch.push(item);chars+=item.text.length;
    }
    for(const b of batches){
      const parts=batches.filter(x=>x.chapter===b.chapter).length;
      b.label=(b.chapter==='?'?'챕터 미상':'챕터 '+b.chapter)+(parts>1?' '+b.part+'/'+parts+'부':'');
    }
    return batches;
  }
  function gfqChapterHashes(batches){
    const text=new Map();
    for(const b of batches)text.set(b.chapter,(text.get(b.chapter)||'')+b.map(t=>t.source+'\n'+t.text).join('\n'));
    const out={};
    for(const [ch,t] of text){let h=2166136261;for(let i=0;i<t.length;i++)h=Math.imul(h^t.charCodeAt(i),16777619)>>>0;out[ch]=h.toString(36)+':'+t.length;}
    return out;
  }
  function gfqParseChapterRange(input,list){
    const want=new Set(),nums=list.map(Number);
    for(const part of String(input).split(/[,\s]+/).filter(Boolean)){
      const m=part.match(/^(\d+)\s*[-~]\s*(\d+)$/);
      if(m){const a=Math.min(+m[1],+m[2]),b=Math.max(+m[1],+m[2]);list.forEach((c,i)=>{if(nums[i]>=a&&nums[i]<=b)want.add(c);});}
      else if(list.includes(part))want.add(part);
    }
    return want;
  }
  // v0.3.5: parse model output; if the reply was cut off, recover every complete event object.
  function gfqParseEvents(raw,key='events'){
    const text=String(raw||'').trim().replace(/^\x60\x60\x60(?:json)?\s*/i,'').replace(/\s*\x60\x60\x60$/,'');
    try{const v=JSON.parse(text);const ev=Array.isArray(v)?v:v?.[key];if(Array.isArray(ev))return {events:ev,partial:false,root:Array.isArray(v)?null:v};}catch{}
    const whole=text.match(/\{[\s\S]*\}/);
    if(whole){try{const v=JSON.parse(whole[0]);if(Array.isArray(v?.[key]))return {events:v[key],partial:false,root:v};}catch{}}
    const at=text.search(new RegExp('"'+key+'"\\s*:\\s*\\[')),start=at>=0?text.indexOf('[',at):text.indexOf('[');
    if(start<0)return null;
    const events=[];let depth=0,inStr=false,esc=false,objStart=-1;
    for(let i=start+1;i<text.length;i++){
      const c=text[i];
      if(inStr){if(esc)esc=false;else if(c==='\\')esc=true;else if(c==='"')inStr=false;continue;}
      if(c==='"'){inStr=true;continue;}
      if(c==='{'){if(depth===0)objStart=i;depth++;}
      else if(c==='}'){depth--;if(depth===0&&objStart>=0){try{events.push(JSON.parse(text.slice(objStart,i+1)));}catch{}objStart=-1;}}
      else if(c===']'&&depth===0)break;
    }
    let root=null;const tl=text.match(/"timeline"\s*:\s*(\{[^{}]*\})/);if(tl){try{root={timeline:JSON.parse(tl[1])};}catch{}}
    return events.length?{events,partial:true,root}:null;
  }
  // v0.3.5: one validation path shared by AI analysis and JSON import.
  function gfqBuildProposal(x,evidence,ctx=GFQ_GENERIC){
    const safe=gfqSafeProposal({...x,evidence},ctx);
    return {id:uid(),category:safe.category,name:String(safe.name).slice(0,100),status:safe.status,evidence:String(evidence).slice(0,600),
      ...(safe.category!==x.category?{originalCategory:x.category}:{}),
      questTitle:String(x.questTitle||'').slice(0,90),questObjective:String(x.questObjective||'').slice(0,350),questRewards:Array.isArray(x.questRewards)?x.questRewards.slice(0,8):[],
      source:String(x.source||'').slice(0,120),amount:typeof safe.amount==='number'&&Number.isFinite(safe.amount)?safe.amount:null,
      unit:String(gfqIsMoneyUnit(safe.unit)?gfqUnit(safe.unit):(safe.unit||'')).slice(0,30),owner:String(x.owner||'unknown'),eventKind:String(x.eventKind||''),
      financialStatus:safe.financialStatus,auditNote:safe.auditNote||'',...(typeof safe.value==='number'?{value:safe.value,...(safe.valueUnit?{valueUnit:safe.valueUnit}:{})}:{}),
      ...(safe.category==='benefit'?{benefitUses:safe.benefitUses||1,benefitMode:safe.benefitMode||'record',benefitPermanent:safe.benefitMode==='permanent',benefitConsumed:safe.benefitMode==='record'}:{}),
      ...(Array.isArray(x.soldItems)&&x.soldItems.length&&['received','receivable','pending'].includes(safe.financialStatus)?{soldItems:x.soldItems.slice(0,5).filter(v=>v&&typeof v.name==='string'&&v.name.trim()).map(v=>({name:v.name.trim().slice(0,80),qty:Number.isSafeInteger(Number(v.qty))&&Number(v.qty)>0?Math.min(999,Number(v.qty)):1}))}:{}),
      ...(Array.isArray(x.purchasedItems)&&x.purchasedItems.length&&safe.financialStatus==='paid'?{purchasedItems:x.purchasedItems.slice(0,5).filter(v=>v&&typeof v.name==='string'&&v.name.trim()).map(v=>({name:v.name.trim().slice(0,80),qty:Number.isSafeInteger(Number(v.qty))&&Number(v.qty)>0?Math.min(999,Number(v.qty)):1,received:v.received!==false}))}:{}),
      equipType:String(x.equipType||'').slice(0,30),equipSlot:String(x.equipSlot||'').slice(0,50),equipOptions:String(x.equipOptions||'').slice(0,500),equipEvidence:String(x.equipEvidence||'').slice(0,500),
      transactionId:String(x.transactionId||'').slice(0,100),timing:String(x.timing||'').slice(0,80),linkTo:String(x.linkTo||'').slice(0,12)};
  }
  // Returns {proposal} or {reason} so callers can report why candidates were dropped.
  function gfqScreenEvent(x,texts,ctx=GFQ_GENERIC){
    if(!x||typeof x!=='object')return {reason:'format'};
    if(typeof x.name!=='string'||!x.name.trim()||typeof x.evidence!=='string'||x.evidence.trim().length<8)return {reason:'format'};
    if(!gfqEventEligible(x,ctx)||!['completed','active','confirmed','uncertain'].includes(x.status))return {reason:'filtered'};
    const evidence=gfqLocateEvidence(x.evidence.trim(),texts);
    if(!evidence)return {reason:'evidence'};
    const p=gfqBuildProposal(x,evidence,ctx);
    // v0.3.12: a number the AI wrote must actually be in the quoted text (e.g. 900,000원 when the text says 950,000원).
    if(p.category==='quest'){p.amount=null;p.unit='';}
    else if(typeof p.amount==='number'&&(gfqIsMoneyUnit(p.unit)||p.unit==='%')&&!gfqAmountsIn(evidence).has(p.amount)){
      p.auditNote=[p.auditNote,'AI가 제시한 금액 '+gfqAmount(p.amount,p.unit)+'이(가) 원문 근거에 없어 금액을 비웠습니다.'].filter(Boolean).join(' ');p.amount=null;
    }
    // Equipment stats must have a separate verbatim evidence quote; guesses are dropped.
    if(p.category==='item'){
      const raw=typeof x.equipEvidence==='string'&&x.equipEvidence.trim().length>=8?gfqLocateEvidence(x.equipEvidence.trim(),texts):null;
      if(!raw||!p.equipOptions||!raw.includes(p.equipOptions.trim())){
        p.equipOptions='';p.equipEvidence='';
      }else p.equipEvidence=raw.slice(0,500);
      if(!['무기','방어구','장신구','도구'].includes(p.equipType))p.equipType='';
    }
    // Rewards written inside a quest are kept only when their own evidence is found in this chapter's text.
    if(p.category==='quest'&&p.questRewards.length){
      p.questRewards=p.questRewards.map(r=>{
        if(!r||typeof r!=='object')return null;
        const ev=typeof r.evidence==='string'&&r.evidence.trim().length>=6?gfqLocateEvidence(r.evidence.trim(),texts):null;
        if(!ev)return null;
        const amount=typeof r.amount==='number'&&(!(gfqIsMoneyUnit(r.unit)||String(r.unit||'')==='%')||gfqAmountsIn(ev).has(r.amount))?r.amount:null;
        return {...r,evidence:ev,amount};
      }).filter(Boolean);
    }
    return {proposal:p};
  }
  function gfqDuplicate(a,b,ctx=GFQ_GENERIC){
    if(a.category!==b.category)return false;
    if(a.evidence===b.evidence)return true;
    if(!ctx.legacy)return false;
    if(a.category==='credential'&&/물리계.*면허/.test(a.name)&&/물리계.*면허/.test(b.name))return true;
    if(a.category==='quest'&&/성수동 냉장 물류창고|게이트 앵커/.test(a.name)&&/성수동 냉장 물류창고|게이트 앵커/.test(b.name))return true;
    return false;
  }
  // v0.3.5: Korean display labels. Stored values stay in English codes for compatibility.
  const GFQ_LABELS={
    category:{quest:'퀘스트',asset:'자산·거래',item:'소지품',credential:'자격·면허',contract:'계약',benefit:'혜택'},
    status:{completed:'완료',active:'진행 중',confirmed:'확인됨',uncertain:'불확실'},
    money:{received:'입금 확인',paid:'지출',pending:'지급 예정',receivable:'미수금(확정·미입금)',waived:'면제',ownership:'지분·소유',conditional:'조건부 보장',not_applicable:'금전 무관',uncertain:'미확인'},
    certainty:{conditional:'조건부 보장',received:'수령 확인',confirmed:'확정·미수령',pending:'지급 예정',suggested:'제안·미지급',uncertain:'미확인'}
  };
  const gfqLabel=(kind,v)=>v?(GFQ_LABELS[kind]?.[v]||String(v)):'구분 전';
  const gfqAmount=(amount,unit)=>typeof amount==='number'&&Number.isFinite(amount)?amount.toLocaleString('ko-KR')+(unit?' '+unit:''):'미확인';
  // v0.3.5: relative timing ("내일 이 시간") has no meaning without the scene it was said in.
  const GFQ_TIMING=/(?:내일|모레|금일|오늘|익일|다음\s?날)(?:\s*(?:이 시간|오전|오후|저녁|아침))?(?:\s*\d{1,2}\s*시(?:\s*정각|\s*\d{1,2}\s*분|\s*반)?)?(?:\s*까지)?|(?:임무|작업|용역|제작)\s*완료\s*(?:즉시|시|후)|\d+\s*일\s*(?:후|뒤|이내)/u;
  function gfqTiming(x){
    const found=[...String(x.evidence||'').matchAll(new RegExp(GFQ_TIMING.source,'gu'))].map(m=>m[0].trim()).filter((v,i,a)=>v&&a.indexOf(v)===i);
    const t=String(x.timing||'').trim()||found.join(' · ');
    return t?{text:t.slice(0,80),anchor:String(x.source||'').slice(0,120),...(x.date?{base:x.date}:{})}:null;
  }
  const gfqTimingText=t=>t?t.text+(t.anchor?' ('+t.anchor+' 시점 기준)':''):'';
  function aiReviewHtml(w){
    const rows=Array.isArray(w.aiProposals)?w.aiProposals:[];
    return '<h3>AI 분석 결과 검토 ('+rows.length+'개)</h3>'+
      '<p class="gfq-muted">설정에서 선택한 AI 연결로 분석합니다. 원문을 확인한 후보만 승인할 수 있으며, 분석만으로 자산은 변경되지 않습니다.</p>'+gfqDiagnosticsHtml(w)+
      '<label for="gfq-ai-range">분석 범위</label><select id="gfq-ai-range"><option value="new" '+((data.aiRange||'new')==='new'?'selected':'')+'>새로 추가·변경된 챕터만</option><option value="all" '+(data.aiRange==='all'?'selected':'')+'>전체 챕터</option><option value="pick" '+(data.aiRange==='pick'?'selected':'')+'>챕터 직접 지정</option></select> '+
      '<button data-action="invoke-quest-bridge">AI 분석 실행</button> <button data-action="prepare-ai-prompt">분석 지침 복사</button> <button data-action="import-ai-result">AI 분석 JSON 가져오기</button>'+
      (rows.length?'<div class="gfq-row"><button data-action="select-all-ai">전체 선택</button><button data-action="unselect-all-ai">선택 해제</button><button data-action="approve-selected-ai">선택 승인</button><button data-action="delete-selected-ai">선택 삭제</button><button data-action="delete-all-ai" class="gfq-danger">전체 삭제</button></div>':'')+
      (rows.map(x=>'<div class="gfq-card"><div class="gfq-row"><input type="checkbox" class="gfq-ai-check" aria-label="분석 후보 선택" value="'+esc(x.id)+'" style="width:17px;height:17px;flex:none"><b class="gfq-fill">'+esc(gfqLabel('category',x.category))+' · '+esc(x.name)+'</b><small>'+esc(gfqLabel('status',x.status))+(x.category==='quest'?'':' · '+esc(gfqLabel('money',['asset','contract'].includes(x.category)&&gfqIsCond(x)?'conditional':x.financialStatus)))+'</small></div>'+(['asset','contract'].includes(x.category)&&gfqIsCond(x)?'<p class="gfq-muted"><b>조건부 보장</b> · 철수·실패 같은 조건이 생길 때만 받는 최소 금액입니다. 승인해도 거래 내역과 받을 돈에 더하지 않고 기록만 남깁니다.'+((w.aiProposals||[]).some(q=>q.category==='quest'&&(q.questRewards||[]).some(r=>r&&r.name===x.name))||(w.quests||[]).some(q=>(q.rewardDetails||[]).some(r=>r.name===x.name))?' 같은 내용이 퀘스트 보상에 이미 들어 있으니 제외해도 됩니다.':'')+'</p>':'')+(x.linkedQuest?'<p class="gfq-muted">퀘스트 \''+esc(x.linkedQuest)+'\'의 보상으로 연결됨 · 승인하면 거래 내역에 기록되고 그 퀘스트 보상과 이어집니다.</p>':'')+'<p>'+esc(x.evidence)+'</p><div class="gfq-muted">수량·금액: '+esc(gfqAmount(x.amount,x.unit))+' · 출처: '+esc(x.source||'미확인')+'</div>'+(gfqTiming(x)?'<div class="gfq-muted">'+(x.category==='quest'?'기한·시점':'지급·수령 시점')+': '+esc(gfqTimingText(gfqTiming(x)))+(gfqResolveTiming(w,gfqTiming(x))?' → '+esc(gfqResolveTiming(w,gfqTiming(x))):'')+'</div>':'')+(x.value?'<div class="gfq-muted">물품 가치: '+esc(gfqAmount(x.value,x.valueUnit||gfqMainUnit(w)))+' (현금 아님)</div>':'')+gfqClearedHint(w,x)+(x.date?'<div class="gfq-muted">세계관 날짜: '+esc(x.date)+(x.endDate&&x.endDate!==x.date?' ~ '+esc(x.endDate):'')+'</div>':'')+gfqProposalLinkExtra(x)+(x.deferred?'<div class="gfq-muted"><b>장면 도달 대기</b> · 해당 대사가 나오면 자동으로 반영합니다. 지금 반영하려면 [확인 후 반영]을 눌러 주세요.</div>':'')+(x.category==='quest'?'<div class="gfq-muted">목표: '+esc(gfqQuestPresentation(gfqSafeProposal(x,gfqRuleCtx(w))).objective)+'</div>'+gfqProposalQuestExtra(w,x)+'<div class="gfq-muted">보상 후보: '+esc(gfqQuestPresentation(gfqSafeProposal(x,gfqRuleCtx(w))).rewardList.map(gfqRewardText).join(' · '))+'</div>':'')+(x.auditNote?'<p class="gfq-muted">검토 주의: '+esc(x.auditNote)+'</p>':'')+'<div class="gfq-row"><button data-action="approve-ai-proposal" data-id="'+esc(x.id)+'">확인 후 반영</button><button data-action="remove-ai-proposal" data-id="'+esc(x.id)+'">제외</button></div></div>').join('')||'<p class="gfq-muted">검토 대기 중인 AI 분석 결과가 없습니다.</p>');
  }
  // v0.3.13: deterministic safety net for missed payments. Every story sentence that states a won amount
  // together with a payment cue is checked against candidates, quest rewards and the ledger.
  const GFQ_PAY_CUE=/(수당|보수|급여|기본급|정산|지급|입금|송금|대금|상금|사례금|보상금|지원금|일당|용역비|받으|받았|드립니다|보장)/u;
  function gfqSumTotals(amounts){
    const out=new Set(),list=amounts.filter(n=>Number.isFinite(n)&&n>0).slice(0,10);
    for(const t of list){
      const rest=list.filter(n=>n<t);
      for(let mask=1;mask<(1<<rest.length);mask++){const sub=rest.filter((_,i)=>mask&(1<<i));if(sub.length>=2&&sub.reduce((a,b)=>a+b,0)===t){out.add(t);break;}}
    }
    return out;
  }
  function gfqMissingMoney(w){
    const covered=new Set(),texts=[];
    const addAmounts=t=>{for(const n of gfqAmountsIn(t))covered.add(n);};
    for(const p of (w.aiProposals||[])){if(typeof p.amount==='number')covered.add(p.amount);if(typeof p.value==='number')covered.add(p.value);addAmounts(p.evidence);for(const r of (p.questRewards||[])){if(typeof r.amount==='number')covered.add(r.amount);addAmounts(r.name);}}
    for(const t of (w.gfLedger||[])){if(typeof t.amount==='number')covered.add(t.amount);for(const h of (t.history||[]))addAmounts(h.evidence);}
    for(const q of (w.quests||[]))for(const r of (q.rewardDetails||[]))if(typeof r.amount==='number')covered.add(r.amount);
    for(const k of (w.aiAcceptedKeys||[]))addAmounts(k);
    for(const i of (w.items||[]))if(typeof i.value==='number')covered.add(i.value);
    for(const d of (w.gfMoneyDismissed||[]))covered.add(d);
    const out=[],seen=new Set();
    for(const rec of gfqStoryRecords(w)){
      for(const sentence of rec.text.split(/(?<=[.!?。])\s+|\n+/u)){
        if(!GFQ_PAY_CUE.test(sentence))continue;
        const money=gfqMoneyIn(sentence).filter(x=>!/^\s*상당/u.test(sentence.slice(x.end))),found=money.map(x=>x.n);
        // v0.4.3: a running total (1,200,000 + 1,300,000 + 1,400,000 = 3,900,000) is a recap, not a payment.
        const totals=gfqSumTotals(found);
        for(const n of found){
          if(!Number.isFinite(n)||n<=0||covered.has(n)||seen.has(n)||totals.has(n))continue;
          seen.add(n);out.push({amount:n,unit:money.find(x=>x.n===n)?.unit||'원',source:rec.source,sentence:sentence.trim().slice(0,300),recap:/(전날|어제|지난|앞서|이전|이미|에 이어|까지 더하면|누적|합계|모두 합)/u.test(sentence)});
          if(out.length>=30)return out;
        }
      }
    }
    return out;
  }
  function gfqMissingMoneyHtml(w){
    const list=w.gfMissingMoney||[];
    if(!list.length)return '';
    return '<div class="gfq-card"><b>누락 의심 금액 ('+list.length+'개)</b><p class="gfq-muted">원문에 지급 관련 금액이 있지만 검토 후보·퀘스트 보상·거래 내역 어디에도 없는 문장입니다. AI 분석이 빠뜨렸을 수 있습니다. 상태를 직접 정해 후보로 추가하거나, 지급과 무관하면 무시해 주세요.</p>'+
      list.map((m,i)=>'<div class="gfq-muted"><b>'+esc(gfqAmount(m.amount,m.unit||'원'))+'</b> · '+esc(m.source)+(m.recap?' · 지난 지급을 되짚는 문장':'')+'<br>'+esc(m.sentence)+'</div><div class="gfq-row">'+((w.gfLedger||[]).some(t=>t.amount===null)?btn('금액 미확인 거래에 채우기','money-fill-ledger','data-idx="'+i+'"'):'')+btn('후보로 추가','money-to-candidate','data-idx="'+i+'"')+btn('무시','money-dismiss','data-idx="'+i+'"')+'</div>').join('')+
      '<div class="gfq-row">'+btn('누락 금액 다시 검사','money-rescan')+'</div></div>';
  }
  function gfqDiagnosticsHtml(w){
    const a=w.gfLastAnalysis,ev=w.gfEvicted&&Object.entries(w.gfEvicted);
    const parts=[];
    if(a)parts.push('<div class="gfq-muted">최근 분석 ('+esc(a.at)+'): '+esc(gfqAnalysisSummary(a)).replace(/\n/g,'<br>')+'</div>');
    if(ev&&ev.length)parts.push('<div class="gfq-muted">보관 한도(장면 180개)를 넘어 삭제된 오래된 장면: '+ev.map(([c,n])=>'챕터 '+esc(c)+' '+n+'개').join(', ')+'. 이 장면에 있던 거래는 분석 대상에 포함되지 않습니다.</div>');
    if(Array.isArray(w.gfAutoLog)&&w.gfAutoLog.length)parts.push('<details><summary class="gfq-muted">최근 자동 분석 기록 ('+w.gfAutoLog.length+')</summary>'+w.gfAutoLog.slice().reverse().map(l=>'<div class="gfq-muted">'+esc(l.at)+' · 챕터 '+esc(l.chapters.join(', '))+' · 새 장면 '+l.scenes+'개('+l.chars+'자) · '+esc(l.result)+'</div>').join('')+'</details>');
    if(w.gfUndo)parts.push('<div class="gfq-row">'+btn('마지막 자동 반영 되돌리기 ('+w.gfUndo.count+'개 · '+esc(w.gfUndo.at)+')','undo-auto')+'</div>');
    return (parts.length?'<div class="gfq-card">'+parts.join('')+'</div>':'')+gfqMissingMoneyHtml(w);
  }
  function gfqQuestGroup(x,ctx=GFQ_GENERIC){
    if(!ctx.legacy)return '';
    const t=[x.name,x.questTitle,x.questObjective,x.evidence].join(' '),source=String(x.source||'');
    if(/챕터 3/.test(source)&&/제1공방|파쇄동|용해로|철각견|공명 저지선|냉각 밸브|설비 방어|진입로/.test(t))return 'foundry';
    if(/챕터 1/.test(source)&&/냉장 물류창고|게이트 앵커/.test(t))return 'coldstore';
    if(/챕터 2/.test(source)&&/격리동|마수 탈주/.test(t))return 'containment';
    return '';
  }
  function gfqIntegrateQuests(events,ctx=GFQ_GENERIC){
    // The grouping below is the v0.3.4 rule pack; generic consolidation arrives with stage 3.
    if(!ctx.legacy)return events.slice();
    const groups=new Map(),result=[];
    for(const e of events){
      const key=e.category==='quest'?gfqQuestGroup(e,ctx):'';
      if(!key){result.push(e);continue;}
      if(!groups.has(key))groups.set(key,[]);
      groups.get(key).push(e);
    }
    for(const [key,group] of groups){
      const first={...group[0]};
      if(key==='foundry'){
        first.name='제1공방 긴급 방어 작전';
        first.questTitle=first.name;
        first.questObjective='제1공방의 오염 사태를 조사하고 지하 용해로 진입로를 확보한 뒤 비상 냉각 밸브를 열고 게이트 파편을 파괴해 폭발을 막는다.';
        first.questSteps=['오염 원인 조사','지하 용해로 진입로 확보','비상 냉각 밸브 개방','게이트 파편 파괴'];
        first.status=group.some(x=>x.status==='active')?'active':first.status;
      }else{
        first.questTitle=key==='coldstore'?'성수동 냉장 물류창고 게이트 안정화':'협회 격리동 긴급 수습';
        first.questSteps=group.length>1?group.map(x=>x.questObjective||x.name).filter(Boolean).slice(0,6):[];
      }
      first.sourceEvidence=group.map(x=>x.evidence).filter(Boolean);
      result.push(first);
    }
    const foundry=result.find(x=>x.category==='quest'&&gfqQuestGroup(x,ctx)==='foundry');
    const contract=result.find(x=>['asset','contract'].includes(x.category)&&x.amount===1400000&&x.unit==='원'&&/챕터 3/.test(x.source||'')&&/계약|수당|보수|정산/.test(x.name||''));
    if(foundry&&contract){
      foundry.questRewards=[{name:'긴급 설비 방어 보수 (기본 950,000원 + 위험 450,000원)',kind:'money',certainty:'pending',amount:1400000,unit:'원',evidence:contract.evidence}];
      foundry.rewardTransactionId=contract.transactionId||'';
    }
    // The contractual total is the ledger candidate; components are its breakdown, not separate deposits.
    const total=result.find(x=>['asset','contract'].includes(x.category)&&x.amount===1400000&&String(x.unit)==='원'&&/챕터 3/.test(x.source||'')&&/긴급.*(방어|설비)|표준 긴급 방어/.test(x.name||''));
    if(total){
      total.name='긴급 설비 방어 보수 총액';
      total.financialStatus='pending';
      total.auditNote='기본 수당 950,000원 + 위험 수당 450,000원의 합계입니다. 구성 금액은 별도의 수입이 아닙니다.';
      for(let i=result.length-1;i>=0;i--){
        const x=result[i];if(x===total||!['asset','contract'].includes(x.category)||!/챕터 3/.test(x.source||''))continue;
        if((x.amount===950000&&/기본 수당/.test(x.name||''))||(x.amount===450000&&/위험 수당/.test(x.name||'')))result.splice(i,1);
      }
    }
    // An offer and its formal contract are not two different contracts.
    const offer=result.find(x=>x.category==='contract'&&/긴급 설비 방어 용역 위촉/.test(x.name||''));
    if(offer&&total){const ix=result.indexOf(offer);if(ix>=0)result.splice(ix,1);}
    return result;
  }
  // v0.3.15: quests with sub-goals show sub-goal progress; plain quests keep the count-based progress.
  function gfqStepLine(steps,done){
    return steps.map((t,i)=>(done[i]?'✓ ':'○ ')+t).join(' · ');
  }
  function gfqProposalQuestExtra(w,x){
    const parts=[];
    if(x.updateOf){const q=(w.quests||[]).find(v=>v.id===x.updateOf);parts.push(q?'기존 퀘스트 갱신: '+q.title:'갱신 대상 퀘스트를 찾지 못해 새 퀘스트로 등록됩니다');}
    if(x.mergedCount>1)parts.push('통합된 후보 '+x.mergedCount+'개');
    const p=gfqQuestPresentation(x);
    if(p.steps.length)parts.push('세부 목표: '+gfqStepLine(p.steps,p.stepDone));
    return parts.map(t=>'<div class="gfq-muted">'+esc(t)+'</div>').join('');
  }
  // v0.3.7: apply a consolidated candidate to an existing quest instead of creating a duplicate.
  function gfqUpdateQuest(w,q,x,quest){
    const key=t=>gfqNormMap(t).out;
    q.steps=Array.isArray(q.steps)?q.steps:[];
    q.stepDone=q.steps.map((_,i)=>Array.isArray(q.stepDone)&&q.stepDone[i]===true);
    quest.steps.forEach((text,i)=>{
      const at=q.steps.findIndex(t=>key(t)===key(text));
      if(at<0){q.steps.push(text);q.stepDone.push(quest.stepDone[i]);}
      else if(quest.stepDone[i])q.stepDone[at]=true;
    });
    q.steps=q.steps.slice(0,12);q.stepDone=q.stepDone.slice(0,12);
    q.rewardDetails=Array.isArray(q.rewardDetails)?q.rewardDetails:[];
    for(const r of quest.rewardList){
      if(r.kind==='reputation'&&r.certainty==='suggested'&&!r.assessed)continue;
      if(r.kind==='reputation'&&q.rewardDetails.some(v=>v.kind==='reputation'&&(v.assessed||q.reputationAwarded)))continue;
      const twin=r.kind==='money'&&typeof r.amount==='number'?q.rewardDetails.find(v=>v.kind==='money'&&v.amount===r.amount&&gfqUnit(v.unit)===gfqUnit(r.unit)&&gfqIsCond(v)===gfqIsCond(r)):null;
      if(twin){if((GFQ_CERT_RANK[r.certainty]||0)>(GFQ_CERT_RANK[twin.certainty]||0))twin.certainty=r.certainty;continue;}
      if(!q.rewardDetails.some(v=>v.name===r.name&&(v.amount??null)===(r.amount??null)))q.rewardDetails.push(r);
    }
    // A confirmed reward replaces the default reputation suggestion that has not been paid yet.
    if(!q.reputationAwarded&&q.rewardDetails.some(r=>r.kind!=='reputation'))q.rewardDetails=q.rewardDetails.filter(r=>!(r.kind==='reputation'&&r.certainty==='suggested'&&!r.assessed));
    if(!q.rewardDetails.length)q.rewardDetails=quest.rewardList;
    q.reward=q.rewardDetails.map(r=>r.name).join(' · ');
    if(!String(q.detail||'').trim())q.detail=quest.objective;
    q.sourceEvidence=[q.sourceEvidence,x.evidence].flat().filter(Boolean).slice(-12);
    let note='퀘스트 갱신: '+q.title;
    if(x.status==='completed'&&!q.claimed){q.claimed=true;q.progress=q.target;if(x.endDate||x.date)q.doneDate=x.endDate||x.date;note+=' → 완료';gfqAwardQuestReputation(w,q);}
    record(w,note+' · '+x.evidence);
  }
  // v0.7.7: money rewards with the same amount and currency are one reward written two ways ('보수 총액' and '세후 총액').
  // Shown once, keeping the most advanced state and remembering the other names. Saved data is not rewritten.
  const GFQ_CERT_RANK={received:5,confirmed:4,pending:3,conditional:2,suggested:1,uncertain:0};
  function gfqMergeMoneyRewards(list){
    const out=[];
    for(const r of (Array.isArray(list)?list:[])){
      if(!r||r.kind!=='money'||typeof r.amount!=='number'){out.push(r);continue;}
      const i=out.findIndex(v=>v&&v.kind==='money'&&v.amount===r.amount&&gfqUnit(v.unit)===gfqUnit(r.unit)&&gfqIsCond(v)===gfqIsCond(r));
      if(i<0){out.push({...r});continue;}
      const a=out[i],best=(r.txId&&!a.txId)||(!!r.txId===!!a.txId&&(GFQ_CERT_RANK[r.certainty]||0)>(GFQ_CERT_RANK[a.certainty]||0))?r:a;
      const names=[...new Set([a.name,r.name,...(a.aka||[])].filter(Boolean))];
      out[i]={...best,name:names[0],aka:names.slice(1),txId:best.txId||a.txId||r.txId,chainKey:best.chainKey||a.chainKey||r.chainKey};
    }
    return out;
  }
  function gfqDedupeRewards(list){
    const out=[];
    for(const r of list){
      const money=r.kind==='money'&&typeof r.amount==='number';
      const twin=money&&out.find(v=>v.kind==='money'&&v.amount===r.amount&&gfqUnit(v.unit)===gfqUnit(r.unit)&&gfqIsCond(v)===gfqIsCond(r));
      if(twin){if(!twin.chainKey&&r.chainKey)out[out.indexOf(twin)]=r;continue;}
      const nk=t=>gfqNormMap(t).out;
      if(!money&&out.some(v=>v.kind===r.kind&&(v.name===r.name||(r.evidence&&v.evidence&&nk(v.evidence)===nk(r.evidence))||(nk(v.name).length>=6&&nk(r.name).length>=6&&(nk(v.name).includes(nk(r.name))||nk(r.name).includes(nk(v.name)))))))continue;
      out.push(r);
    }
    // Amounts that add up exactly to another listed amount are its breakdown (e.g. 950,000 + 450,000 = 1,400,000).
    const money=out.filter(r=>r.kind==='money'&&typeof r.amount==='number'&&r.amount>0),drop=new Set();
    for(const total of [...money].sort((a,b)=>b.amount-a.amount)){
      if(drop.has(total))continue;
      const rest=money.filter(r=>r!==total&&!drop.has(r)&&r.amount<total.amount&&String(r.unit||'')===String(total.unit||'')).slice(0,10);
      for(let mask=1;mask<(1<<rest.length);mask++){const sub=rest.filter((_,i)=>mask&(1<<i));if(sub.length>=2&&sub.reduce((s,r)=>s+r.amount,0)===total.amount){sub.forEach(r=>drop.add(r));break;}}
    }
    return out.filter(r=>!drop.has(r));
  }
  function gfqRewardText(r){
    const shown=r.amount!==null&&r.amount!==undefined&&!(r.kind!=='reputation'&&gfqAmountsIn(r.name).has(r.amount));
    const amt=shown?' '+(r.kind==='reputation'?'+':'')+Number(r.amount).toLocaleString('ko-KR')+(r.unit?(r.kind==='reputation'?'':' ')+r.unit:''):'';
    const why=r.kind==='reputation'&&r.assessed&&r.evidence?' — '+String(r.evidence).replace(/^확장 명성 규칙 제안:?\s*/,''):'';
    return r.name+amt+' ('+(r.kind==='benefit'&&r.certainty==='received'?'적용됨':gfqLabel('certainty',r.certainty))+')'+why;
  }
  function gfqQuestPresentation(x){
    const raw=String(x.name||'').trim(),quote=String(x.evidence||''),source=String(x.source||'');
    const title=String(x.questTitle||raw).trim().slice(0,90);
    const objective=String(x.questObjective||x.objective||'').trim().slice(0,350)||
      (quote?('목표: '+quote.slice(0,230)):'목표 세부 정보 확인 필요');
    const rewardCandidates=Array.isArray(x.questRewards)?x.questRewards:[];
    const haveMoney=rewardCandidates.some(r=>r?.kind==='money'&&r.amount!==null&&r.amount!==undefined);
    // The default +1 filler never sits next to a money reward; an assessed reputation (v0.3.11) may.
    let activeRewards=haveMoney?rewardCandidates.filter(r=>r.kind!=='reputation'||r.assessed):rewardCandidates;
    const reps=activeRewards.filter(r=>r?.kind==='reputation');
    if(reps.length>1){const keep=reps.reduce((a,b)=>(b.assessed&&!a.assessed)||((b.assessed===a.assessed)&&(b.amount||1)>(a.amount||1))?b:a);activeRewards=activeRewards.filter(r=>r.kind!=='reputation'||r===keep);}
    const rewardList=gfqDedupeRewards(activeRewards.filter(r=>r&&typeof r.name==='string'&&r.name.trim())).slice(0,8).map(r=>({
      name:String(r.name).slice(0,100),
      kind:['money','item','credential','reputation','benefit','other'].includes(r.kind)?r.kind:'other',
      certainty:['received','confirmed','pending','suggested','uncertain'].includes(r.certainty)?r.certainty:'uncertain',
      amount:typeof r.amount==='number'&&Number.isFinite(r.amount)?r.amount:null,
      unit:String(r.unit||'').slice(0,24),
      evidence:String(r.evidence||'').slice(0,500),
      ...(r.chainKey?{chainKey:String(r.chainKey).slice(0,40)}:{}),
      ...(r.assessed?{assessed:true}:{})
    }));
    if(!rewardList.length)rewardList.push({name:'명성 상승',kind:'reputation',certainty:'suggested',amount:1,unit:'점',evidence:'원문에서 확정된 보상을 찾지 못해 제안한 비금전 보상입니다.'});
    let steps=Array.isArray(x.questSteps)?x.questSteps.map(v=>String(v)).filter(Boolean):[];
    // A single step that just repeats the objective is not a sub-goal.
    if(steps.length===1)steps=[];
    const stepDone=steps.map((_,i)=>Array.isArray(x.questStepDone)&&x.questStepDone[i]===true);
    return {title,objective,rewardList,source,steps,stepDone};
  }
  function gfqAwardQuestReputation(w,q){
    if(q.reputationAwarded)return false;
    const rewards=Array.isArray(q.rewardDetails)?q.rewardDetails:[];
    if(!rewards.some(r=>r.kind==='reputation'))return false;
    const field=w.fields.find(x=>x.name==='명성');
    if(field && (!/^\d+$/.test(String(field.value).trim())||String(field.unit||'')&&!['점',''].includes(String(field.unit)))){
      record(w,'명성 보상 반영 보류: 기존 명성 필드 형식을 확인해 주세요. 퀘스트 '+q.title);return false;
    }
    const reward=rewards.find(r=>r.kind==='reputation');
    const n=Math.max(1,Math.min(5,Math.round(Number(reward?.amount)||1)));
    if(field)field.value=String(Number(field.value)+n);
    else w.fields.push({id:uid(),name:'명성',value:String(n),unit:'점'});
    q.reputationAwarded=true;
    if(reward){reward.amount=n;reward.unit='점';reward.certainty='received';}
    record(w,'퀘스트 명성 보상 지급: '+q.title+' / 명성 +'+n+'점'+(reward?.assessed&&reward.evidence?' ('+reward.evidence+')':''));
    return true;
  }
  function aiAnalysisPrompt(w, records, contextText){
    const ctx=gfqRuleCtx(w),hero=ctx.hero?'주인공 '+ctx.hero:'주인공(플레이어 캐릭터)';
    const today=gfqCurrentDate(w);
    const clockNow=gfqCurrentClock(w);
    if(today)contextText=('[세계관 날짜] '+today.date+(w.gfEra?' ('+gfqDateText(w,today.date)+')':'')+(clockNow?' '+gfqClockText(clockNow)+(clockNow.time?' ('+clockNow.time+')':''):'')+' ('+today.basis+(today.source?' · '+today.source:'')+')')+(contextText?'\n'+contextText:'');
    const input=(records||gfqStoryRecords(w)).map(x=>'['+x.source+']\n'+x.text).join('\n\n');
    const owned=(w.items||[]).filter(i=>i.state!=='pending'&&i.kind!=='voucher'&&i.qty>0).slice(-60).map(i=>i.name+' ×'+i.qty).join(', ').slice(0,1500);
    return [
      '아이템 장비 옵션은 원문에 명시된 경우에만 equipType(무기|방어구|장신구|도구), equipSlot(장착 부위), equipOptions(원문에 그대로 적힌 옵션 내용), equipEvidence(원문 연속 인용)를 JSON 사건 필드에 추가합니다. 추측 옵션이나 실제 착용 여부는 만들지 마세요.',
      '한국어 RPG 세계의 사건과 금전 출납부를 분석합니다. 입력에 없는 사실과 금액은 절대 추정하지 않습니다. 줄거리 출처에 \'게임 기록: 클리어\'가 있으면 그 챕터의 임무가 게임에서 마무리됐다는 참고 정보입니다.',
      '반환 JSON: {"timeline":{"currentDate":"분석 대상 마지막 장면 시점의 세계관 날짜 YYYY-MM-DD, 원문에 날짜가 적혀 있을 때만","dateEvidence":"그 날짜가 적힌 원문 인용","daysPassed":"[세계관 날짜] 이후 마지막 장면까지 지난 날 수(원문에 다음 날·이틀 뒤처럼 적힌 경우만) 또는 null","daysEvidence":"날이 바뀐 원문 인용","currentTime":"마지막 장면 시점의 시각 HH:MM(24시간제), 원문에 시각이 적혀 있을 때만","timeEvidence":"그 시각이 적힌 원문 인용","timeOfDay":"마지막 장면의 때 새벽|아침|오전|점심|오후|저녁|밤|심야 중 하나, 원문 묘사로 알 수 있을 때만","timeOfDayEvidence":"그 때를 알 수 있는 원문 인용(예: 해가 지고, 점심을 먹고)"'+(today?'':',"worldDate":"원문에 날짜가 전혀 없을 때만: 이 세계관의 시대·계절·배경에 어울리는 그럴듯한 오늘 날짜 YYYY-MM-DD","worldDateReason":"그 날짜를 고른 근거 한 문장","era":"원문에 고유 연호(예: 제국력)가 있으면 그 이름, 없으면 빈 문자열"')+'},"events":[{"category":"quest|asset|item|credential|contract|benefit","name":"한국어 제목","status":"completed|active|confirmed|uncertain","financialStatus":"received|paid|pending|receivable|waived|ownership|conditional|not_applicable|uncertain","evidence":"원문에서 그대로 복사한 짧은 연속 문자열","source":"챕터/장면","amount":숫자 또는 null,"unit":"원문의 화폐 단위 그대로(원·골드·냥·전·금화·크레딧 등)|%|개 등","transactionId":"동일 계약 또는 정산 사건을 나타내는 간결한 문자열","linkTo":"이전 맥락 목록의 ID(t1, i2 등) 또는 빈 문자열","benefitUses":"혜택일 때 사용 가능 횟수(명시 없으면 1) 또는 null","benefitPermanent":false,"benefitConsumed":false,"purchasedItems":[{"name":"구매한 물품","qty":1,"received":true}],"soldItems":[{"name":"판매한 물품","qty":1}],"timing":"지급·수령·완료 시점을 나타내는 원문 표현 그대로(예: 내일 이 시간, 임무 완료 시, 금일 오후 6시) 또는 빈 문자열","owner":"player|npc|organization|unknown","eventKind":"task|payment|expense|discount|property|item_transfer|credential|contract","questTitle":"퀘스트형 간결한 제목","questObjective":"목표와 완료 조건을 자연스러운 문장으로 요약","questRewards":[{"name":"보상 명칭","kind":"money|item|credential|reputation|benefit|other","certainty":"received|confirmed|pending|suggested|uncertain","amount":null,"unit":"","evidence":"원문 인용 또는 빈 문자열"}]}]}',
      '반드시 화폐 단위가 있는 모든 입금/이체/정산/수당/보수/급여/보상/지급 완료 서술을 빠짐없이 검사합니다. 완료된 입금은 financialStatus=received, 돈을 지출했으면 paid, 약속한 미래 지급이면 pending, 받을 권리가 확정됐으나 미입금이면 receivable, 면제는 waived, 지분은 ownership으로 분류합니다. 화폐는 세계관마다 다릅니다(원, 골드, 냥, 전, 푼, 금화, 은화, 크레딧 등). unit에는 원문 단위를 그대로 적고, "닷 냥", "은화 서른 닢"처럼 글자로 쓴 수도 amount에 숫자로 넣습니다. 철수·실패처럼 어떤 조건이 생길 때만 보장되는 최소 금액(예: 중도 철수 시 기본급 50% 보장)은 conditional로 분류하며, 다른 보수에 더해지는 돈이 아닙니다.',
      '거래의 지급 의사나 보장만으로 실제 입금(received)으로 처리하지 않습니다. 금액을 확정했지만 입금 문장이 없으면 received를 쓰지 않습니다. 총액과 그 구성 수당은 같은 transactionId를 사용하고 각각 중복 수입으로 합산하지 않습니다.',
      'name은 반드시 한국어로 씁니다. 수당·보수·기본급·정산금처럼 돈으로 받는 것은 혜택(benefit)이 아니라 category=asset입니다.',
      '총액이 명시된 지급은 총액 1건만 출력하고, 기본 수당·위험 수당 같은 구성 내역은 따로 출력하지 않고 name에 괄호로 적습니다. 총액이 없으면 각 금액을 출력합니다. amount에는 원문에 적힌 숫자만 씁니다.',
      '할인·감면·면제·우선 이용·무료 서비스 같은 혜택은 category=benefit입니다. 앞으로 쓸 수 있으면 benefitUses(명시 없으면 1), 기한 없이 계속 적용되면 benefitPermanent=true, 이미 특정 거래에 적용되어 끝났으면 benefitConsumed=true입니다. amount에는 할인율(%)이나 면제 금액을 넣습니다.',
      '돈을 내고 물건을 산 구매는 category=asset, financialStatus=paid, eventKind=expense로 출력하고 purchasedItems에 산 물품과 수량을 넣습니다. 주문만 하고 아직 받지 않았으면 received=false입니다. 물건이 없는 지출(숙박비, 수수료 등)은 purchasedItems를 빈 배열로 둡니다.',
      '원문에 날짜만 적힌 줄(예: 2033-04-09)은 그 아래 장면의 날짜 표시입니다. 확장이 이 표시로 날짜를 직접 정하므로, 날짜 표시가 있으면 currentDate는 마지막 날짜 표시와 같게 씁니다.',
      'timeline에는 원문에 적힌 날짜와 날짜 변화만 넣습니다. 날짜가 적힌 문서·면허·통지 등이 오늘 발급·작성된 것이 분명할 때만 그 날짜를 currentDate로 씁니다. 과거·미래의 다른 날을 가리키는 날짜는 쓰지 않습니다. 근거가 없으면 빈 문자열과 null로 둡니다.',
      '원문에 \'4월 9일\'처럼 연도 없는 날짜만 있으면 [세계관 날짜]의 연도로 YYYY-MM-DD를 채웁니다. 세계관 고유 연호(예: 제국력 312년)는 숫자 연도를 그대로 씁니다(0312-04-09).',
      'currentTime·timeOfDay는 마지막 장면의 시점만 씁니다. 회상·예정된 다른 시각은 쓰지 않습니다. 시각이 적혀 있지 않아도 해가 지는 묘사, 점심 식사, 잠자리에 드는 장면처럼 때를 알 수 있으면 timeOfDay와 그 원문 인용을 씁니다.',
      ...(today?[]:['아직 [세계관 날짜]가 없습니다. 원문에 날짜가 전혀 없으면 worldDate에 세계관에 맞는 그럴듯한 날짜를 하나 정해 주세요. 원문에 연도(예: 2033년)나 계절 단서가 있으면 반드시 따르고, 현대·근미래 배경은 그 시대에 맞는 연도, 고유 연호가 있는 판타지 세계는 그 연호의 연도를 씁니다.']),
      '지난 지급을 되짚는 문장(예: 전날 A 1,200,000원과 오늘 B 1,300,000원에 이어 이번 금액까지 합계 3,900,000원)은 새 수입이 아닙니다. 각 과거 지급은 이전 맥락에 같은 항목이 있으면 linkTo로 연결하고 원문 금액을 amount에 넣어 금액을 보완합니다. 이전 맥락에 없으면 별도 항목으로 출력하되, 합계 금액은 출력하지 않습니다.',
      '물건을 팔고 대금을 받은 판매는 category=asset, eventKind=payment로 출력하고 soldItems에 판 물품과 수량을 넣습니다. 대금을 실제로 받았으면 received, 받기로만 했으면 receivable 또는 pending입니다.',
      'N원·N골드 상당처럼 값만 적힌 물품·장비·세트는 돈이 아닙니다. category=item으로 출력하고, 아직 받지 않았으면 financialStatus=pending, amount=null로 둡니다. 받을 돈(receivable)으로 처리하지 않습니다.',
      'timing에는 지급·수령·완료가 실제로 일어나는 시점이나 기한만 넣습니다. \'중도 철수 시\'처럼 일어나지 않을 수도 있는 가정 조건은 넣지 않습니다.',
      '면허·자격증은 credential, 제작 계약은 contract, 제작 중인 물품은 완료된 아이템으로 처리하지 않습니다. 퀘스트 수락/완료도 구분합니다. 모든 항목은 입력 원문에서 확인할 수 있는 evidence가 있어야 합니다.',
      hero+'에게 귀속되는 돈·물품·면허·계약·의뢰만 후보로 출력하세요. NPC나 길드의 자산/계약/서명, 단순 시설 사건, 반입량·대피 인원·압력·오차율 같은 수치 기록은 절대 후보가 아닙니다.',
      '단순 위험 발생은 퀘스트가 아닙니다. 실질적인 플레이어의 의뢰·수락·행동·달성 목적만 퀘스트입니다. 용역의 하위 수행 단계는 가능한 하나의 퀘스트로 합치세요.',
      'category=quest일 때 questTitle은 웹소설풍 자연스러운 의뢰 제목, questObjective는 장소·행동·완료 조건을 포함한 간결한 한국어 문장으로 작성합니다. 퀘스트를 사건 목록처럼 길게 나열하지 마세요.',
      'questRewards에는 스토리로 확인되는 수당·지급 예정 보수·면허·소재·제작 혜택만 넣되 원문의 동일 보상을 중복 기재하지 마세요. 지급된 금액과 지급 예정 금액을 반드시 구분합니다. 완료된 기존 퀘스트에 지급 예정 보수를 지급 완료로 날조하면 안 됩니다.',
      '명시된 보상이 없다면 questRewards는 빈 배열로 두세요. 확장이 명성 상승을 제안하되 실제 보상 획득이나 시스템 재화 증가로 취급하지 않습니다.',
      '정산 완료라는 요약만으로 실제 입금(received)을 확정할 수 없습니다. 계좌에 입금된 사실이 명시되어야 received입니다. 총액과 세부 수당을 중복 수입으로 더하지 마세요.',
      'owner 필드는 player|npc|organization|unknown 중 하나, eventKind 필드는 task|payment|expense|discount|property|item_transfer|credential|contract 중 하나를 필수 출력합니다. owner가 player가 아닌 항목은 결과에서 제외합니다.',
      ...(ctx.legacy?['예: 긴급 설비 수당 기본급 950000원과 위험수당 450000원, 총액 1400000원은 한 계약의 구성 내역입니다. 총액을 별도 두 번째 수입으로 계산하지 마세요.',
        '정산 완료라는 표현만으로 계좌 입금 완료를 확정하지 마세요. 수령이 확인된 입금만 received입니다. NPC의 앰플 장전은 플레이어 소지품 변화가 아닙니다.']
       :['예: 기본급과 위험 수당이 나오고 그 합계 총액이 함께 언급되면 한 계약의 구성 내역입니다. 총액을 별도 두 번째 수입으로 계산하지 마세요.',
        '정산 완료라는 표현만으로 계좌 입금 완료를 확정하지 마세요. 수령이 확인된 입금만 received입니다. 다른 인물이 물건을 사용·장전·보관한 것은 '+hero+'의 소지품 변화가 아닙니다.']),
      '특히 돈 관련 사건은 적은 금액도 누락하지 말고 각각 독립 사건으로 나열하세요. JSON 외 다른 출력은 금지합니다.',
      '월드: '+(w.gfDisplayName||data.world),
      ...(contextText?['[이전 맥락] 앞선 장면에서 이미 확인된 약속·거래·수령 예정 물품입니다.\n'+contextText,
        '분석 대상의 사건이 이전 맥락 항목의 후속(지급 실행, 입금, 지출, 물품 수령, 조건 충족)이면 그 ID를 linkTo에 넣고 같은 금액·단위를 씁니다. 같은 지급을 새 수입으로 따로 만들지 않습니다. 금액이 다르거나 다른 약속이면 linkTo를 비웁니다. 이전 맥락은 판단 참고용이며, evidence는 반드시 분석 대상 원문에서 복사합니다.']:[]),
      // v0.12.0: the AI did not know what is already owned, so a re-mentioned item came back as a new acquisition.
      ...(owned?['[이미 가진 소지품] '+hero+'이(가) 지금 가진 물건입니다: '+owned+'\n이 물건이 원문에 다시 나오거나 들고 있다는 묘사만 있는 것은 새로 얻은 것이 아닙니다. 새로 받거나 사서 개수가 늘어난 경우에만 item 사건으로 적고, 이름은 위 목록의 이름을 그대로 씁니다.']:[]),
      '[분석 대상]\n'+input
    ].join('\n\n');
  }
  async function prepareAiPrompt(){
    const w=current();if(!w)return;
    const txt=aiAnalysisPrompt(w);
    try{await navigator.clipboard.writeText(txt);alert('분석 지침을 복사했습니다. 다른 AI에서 직접 분석하신 경우 [AI 분석 JSON 가져오기]로 결과를 불러오실 수 있습니다. 설정에서 연결을 선택하셨다면 [AI 분석 실행]으로 바로 분석하실 수도 있습니다.');}
    catch{(await gfqPrompt('아래 지침을 복사해 주세요.',txt));}
  }

  function questModelText(v,depth=0){
    if(depth>6||v==null)return '';
    if(typeof v==='string')return v;
    if(Array.isArray(v))return v.map(x=>questModelText(x,depth+1)).filter(Boolean).join('\n');
    if(typeof v!=='object'||['reasoning','thinking','redacted_thinking'].includes(v.type))return '';
    for(const key of ['content','text','output_text','output','response','message','choices','data','result']){
      const text=questModelText(v[key],depth+1);if(text)return text;
    }
    return '';
  }
  // v0.3.8: running context so later scenes can be tied to earlier promises, payments and deliveries.
  const GFQ_RANK={pending:0,receivable:1,received:2};
  const gfqChainOf=t=>(Array.isArray(t.chainKeys)&&t.chainKeys[0])||t.id;
  function gfqContextItems(w,pool){
    const items=[],seen=new Set();
    const add=it=>{if(seen.has(it.chainKey))return;seen.add(it.chainKey);items.push(it);};
    for(const t of (w.gfLedger||[]))add({kind:'ledger',ref:t.id,chainKey:gfqChainOf(t),category:'money',name:t.name,amount:t.amount,unit:t.unit,state:t.state,timing:t.timing||null,source:t.history?.[0]?.source||'',open:!['received','paid','waived'].includes(t.state)});
    for(const i of (w.items||[]))if(i.state==='pending')add({kind:'item',ref:i.id,chainKey:i.chainKey||i.id,category:'item',name:i.name,amount:null,unit:'',state:'pending',timing:i.timing||null,source:'',open:true});
    for(const p of pool){
      if(p.role==='component')continue;
      if(gfqMoney(p))add({kind:'proposal',ref:p.id,chainKey:p.chainKey||p.id,category:'money',name:p.name,amount:p.amount,unit:p.unit,state:p.financialStatus,timing:gfqTiming(p),source:p.source,open:!['received','paid','waived'].includes(p.financialStatus)});
      else if(p.category==='item'&&p.financialStatus==='pending')add({kind:'proposal',ref:p.id,chainKey:p.chainKey||p.id,category:'item',name:p.name,amount:null,unit:'',state:'pending',timing:gfqTiming(p),source:p.source,open:true});
    }
    // Open entries first; the list is capped so each batch prompt grows by ~2,000 characters at most.
    const ordered=[...items.filter(x=>x.open),...items.filter(x=>!x.open)];
    const map=new Map(),lines=[];let chars=0,n=0;
    for(const it of ordered){
      const k=(it.category==='item'?'i':'t')+(++n);
      const line='['+k+'] '+(it.category==='item'?'물품':'거래')+' · '+it.name+(it.category==='money'?' · '+gfqAmount(it.amount,it.unit):'')+' · '+gfqLabel('money',it.state)+(it.timing?' · 시점: '+gfqTimingText(it.timing):(it.source?' · '+it.source:''));
      if(chars+line.length>2000)break;
      map.set(k,it);lines.push(line);chars+=line.length+1;
    }
    return {map,text:lines.join('\n')};
  }
  // Validates an AI-proposed link; returns 'ok', '' (no link) or a rejection reason.
  function gfqResolveLink(p,ctxMap){
    const raw=String(p.linkTo||'').trim();delete p.linkTo;
    if(!raw)return '';
    const it=ctxMap&&ctxMap.get(raw);
    if(!it)return 'unknown';
    const money=gfqMoney(p),item=p.category==='item';
    if(it.category==='money'?!money:!item)return 'category';
    if(money){
      if(typeof p.amount==='number'&&typeof it.amount==='number'&&p.amount!==it.amount)return 'amount';
      if(p.unit&&it.unit&&p.unit!==it.unit)return 'unit';
      const a=GFQ_RANK[it.state],b=GFQ_RANK[p.financialStatus];
      if(!(p.financialStatus===it.state||(a!==undefined&&b!==undefined&&b>=a)||(it.state==='pending'&&p.financialStatus==='paid')))return 'state';
      if(p.amount===null&&typeof it.amount==='number'){p.amount=it.amount;if(!p.unit)p.unit=it.unit;p.auditNote=[p.auditNote,'금액은 연결된 이전 기록에서 가져왔습니다.'].filter(Boolean).join(' ');}
    }
    p.chainKey=it.chainKey;p.linkInfo={kind:it.kind,name:it.name,from:it.state};
    return 'ok';
  }
  const GFQ_LINK_REASON={unknown:'없는 맥락 ID',category:'유형 불일치',amount:'금액 불일치',unit:'단위 불일치',state:'상태 역행'};
  function gfqApplyLink(p,ctxMap,stats){
    const r=gfqResolveLink(p,ctxMap);
    if(r==='ok'){stats.linked=(stats.linked||0)+1;return;}
    if(!r)return;
    stats.linkRejected=(stats.linkRejected||0)+1;
    p.auditNote=[p.auditNote,'이전 기록 연결 제안을 거부했습니다('+(GFQ_LINK_REASON[r]||r)+'). 별개 항목으로 검토해 주세요.'].filter(Boolean).join(' ');
  }
  // Generic version of the 950,000 + 450,000 = 1,400,000 rule: within one contract or scene,
  // amounts that add up exactly to another amount are its breakdown, not extra income.
  function gfqMarkComponents(list){
    const money=list.filter(p=>gfqMoney(p)&&typeof p.amount==='number'&&p.amount>0&&!p.role);
    const passes=[p=>String(p.transactionId||'').trim()?'tx:'+String(p.transactionId).trim()+'|'+p.unit:null,p=>p.source?'src:'+p.source+'|'+p.unit:null];
    let marked=0;
    for(const keyOf of passes){
      const groups=new Map();
      for(const p of money){if(p.role)continue;const k=keyOf(p);if(!k)continue;if(!groups.has(k))groups.set(k,[]);groups.get(k).push(p);}
      for(const g of groups.values()){
        if(g.length<3)continue;
        for(const total of [...g].sort((a,b)=>b.amount-a.amount)){
          if(total.role)continue;
          const rest=g.filter(p=>p!==total&&!p.role&&p.amount<total.amount).slice(0,10);
          let pick=null;
          for(let mask=1;mask<(1<<rest.length)&&!pick;mask++){
            const sub=rest.filter((_,i)=>mask&(1<<i));
            if(sub.length>=2&&sub.reduce((s,p)=>s+p.amount,0)===total.amount)pick=sub;
          }
          if(!pick)continue;
          total.role='total';total.componentNote='구성: '+pick.map(p=>p.name+' '+gfqAmount(p.amount,p.unit)).join(' + ');
          for(const c of pick){c.role='component';c.componentOf=total.id;c.chainKey=total.chainKey||total.id;c.auditNote='총액 '+gfqAmount(total.amount,total.unit)+'('+total.name+')의 구성 금액입니다. 별도 수입으로 기록하지 않습니다.';marked++;}
        }
      }
    }
    return marked;
  }
  // v0.3.10: the game's own chapter-cleared flag is shown as a hint; it never changes a status by itself.
  function gfqClearedHint(w,x){
    if(x.category!=='quest'||x.status==='completed')return '';
    const chs=[...String(x.source||'').matchAll(/챕터\s*([^\s·/]+)/gu)].map(m=>m[1]);
    const cleared=chs.length&&chs.every(c=>(w.gfChapterIndex||[]).some(v=>String(v.chapter)===c&&v.cleared));
    return cleared?'<div class="gfq-muted">참고: 게임 기록상 이 챕터는 클리어 상태입니다. 퀘스트 완료 여부를 확인해 주세요.</div>':'';
  }
  function gfqProposalLinkExtra(x){
    const parts=[];
    if(x.linkInfo)parts.push('이전 기록 연결: '+x.linkInfo.name+' ('+gfqLabel('money',x.linkInfo.from)+' → '+(x.category==='item'?(x.financialStatus==='pending'?'수령 예정':'수령'):gfqLabel('money',x.financialStatus))+')');
    if(x.role==='total'&&x.componentNote)parts.push(x.componentNote);
    if(x.role==='component')parts.push('구성 금액 · 승인해도 거래 내역에 별도 수입으로 기록하지 않습니다');
    if(x.category==='benefit')parts.push(x.benefitMode==='record'?'이미 적용된 혜택 · 승인하면 기록만 남깁니다':x.benefitMode==='permanent'?'상시 혜택 · 승인하면 프로필 탭에 \'보유 혜택\'으로 등록됩니다':'승인하면 소지품에 이용권 ×'+(x.benefitUses||1)+'로 추가됩니다');
    if(Array.isArray(x.soldItems)&&x.soldItems.length)parts.push('판매 물품: '+x.soldItems.map(v=>v.name+' ×'+v.qty).join(', ')+' · 승인하면 소지품에서 차감합니다');
    if(Array.isArray(x.purchasedItems)&&x.purchasedItems.length)parts.push('구매 물품: '+x.purchasedItems.map(v=>v.name+' ×'+v.qty+(v.received?'':' (수령 예정)')).join(', '));
    return parts.map(t=>'<div class="gfq-muted">'+esc(t)+'</div>').join('');
  }
  // v0.3.7: shared call into the engine's existing AI connection.
  async function gfqGenerate(host,connectionId,runId,system,user,maxTokens,signal){
    const opts={method:'POST',credentials:'same-origin',cache:'no-store',signal,
      headers:{'content-type':'application/json','x-marinara-csrf':'1'},
      body:JSON.stringify({connectionId,runId,streaming:false,
        messages:[{role:'system',content:system},{role:'user',content:user}],
        parameters:{maxTokens,temperature:0.1}})
    };
    const response=typeof host.apiFetch==='function'?await host.apiFetch('generate/raw',opts):
      typeof host.fetch==='function'?await host.fetch('/api/generate/raw',opts):await fetch('/api/generate/raw',opts);
    const body=await response.json().catch(()=>null);
    if(!response.ok)throw Error(String(body?.error||body?.message||('HTTP '+response.status)));
    return questModelText(body);
  }
  // v0.3.7: generic quest consolidation. The AI only proposes groupings by short ID;
  // the code validates every ID and never invents evidence, so a bad reply cannot corrupt data.
  function gfqConsolidationInput(w,pool){
    const cands=pool.filter(p=>p.category==='quest').slice(0,80);
    const open=(w.quests||[]).filter(q=>!q.claimed),done=(w.quests||[]).filter(q=>q.claimed);
    const quests=[...done.slice(-15),...open.slice(-25)];
    const candMap=new Map(),questMap=new Map();
    const candidates=cands.map((p,i)=>{const k='c'+(i+1);candMap.set(k,p.id);return {id:k,title:String(p.questTitle||p.name||'').slice(0,90),objective:String(p.questObjective||'').slice(0,220),status:p.status,source:p.source,evidence:String(p.evidence||'').slice(0,160)};});
    const existing=quests.map((q,i)=>{const k='e'+(i+1);questMap.set(k,q.id);return {id:k,title:String(q.title||'').slice(0,90),objective:String(q.detail||'').slice(0,220),steps:(q.steps||[]).slice(0,8),status:q.claimed?'completed':'active'};});
    // v0.3.10: money, item and credential candidates can be assigned to a mission as its rewards.
    const rewardMap=new Map();
    const rewards=pool.filter(p=>p.category!=='quest'&&p.role!=='component'&&gfqRewardFromProposal(p)).slice(0,40).map((p,i)=>{const k='r'+(i+1);rewardMap.set(k,p.id);return {id:k,kind:gfqLabel('category',p.category),name:String(p.name||'').slice(0,80),amount:gfqAmount(p.amount,p.unit),state:gfqLabel('money',p.financialStatus),source:p.source,evidence:String(p.evidence||'').slice(0,120)};});
    return {candidates,existing,candMap,questMap,rewards,rewardMap};
  }
  function gfqRewardFromProposal(p){
    const amount=typeof p.amount==='number'?p.amount:null,base={name:String(p.name||'').slice(0,100),amount,unit:String(p.unit||''),evidence:String(p.evidence||'').slice(0,500),chainKey:p.chainKey||p.id};
    if(['asset','contract'].includes(p.category)&&gfqIsCond(p))return {...base,kind:'money',certainty:'conditional'};
    if(gfqMoney(p)){
      if(p.financialStatus==='paid')return null;
      if(p.financialStatus==='waived')return {...base,kind:'benefit',certainty:'confirmed'};
      return {...base,kind:'money',certainty:{received:'received',receivable:'confirmed',pending:'pending',ownership:'confirmed'}[p.financialStatus]||'uncertain'};
    }
    if(p.category==='item')return {...base,amount:null,unit:'',kind:'item',certainty:p.financialStatus==='pending'?'pending':'confirmed'};
    if(p.category==='credential')return {...base,amount:null,unit:'',kind:'credential',certainty:['completed','confirmed'].includes(p.status)?'received':'pending'};
    if(p.category==='benefit')return {...base,kind:'benefit',certainty:p.benefitMode==='record'?'received':'confirmed'};
    return null;
  }
  function gfqConsolidationPrompt(input,hero){
    return [
      'RPG 퀘스트 기록을 정리합니다. \'새 퀘스트 후보\'와 \'등록된 퀘스트\'를 보고 같은 임무를 하나로 묶습니다.',
      '- 하나의 의뢰·작전·용역에 속한 조사, 이동, 전투, 보고, 정산 같은 세부 행동은 한 그룹으로 묶고 steps로 정리합니다.',
      '- 의뢰인·장소·목적이 다른 임무는 묶지 않습니다. 확신이 없으면 묶지 않습니다.',
      '- 새 후보가 등록된 퀘스트의 이어지는 장면(진행·완료)이면 existingQuestId에 그 퀘스트 ID(e로 시작)를 넣습니다.',
      '- 모든 새 후보 ID(c로 시작)는 정확히 한 그룹에만 넣습니다. 묶을 대상이 없는 후보도 단독 그룹으로 출력합니다.',
      '- title은 게임 의뢰처럼 간결한 한국어 제목, objective는 장소·행동·완료 조건을 담은 한 문장입니다.',
      '- steps는 시간순 2~6개입니다. done은 후보 내용으로 완료가 확인된 단계만 true입니다. done이 true면 doneBy에 그 단계를 끝낸 장면의 후보 ID(c로 시작) 하나를 넣습니다. 모르면 비워 둡니다.',
      '- status는 후보 중 완료가 확인될 때만 completed, 아니면 active입니다.',
      '- \'보상 후보\' 중 그 임무의 대가로 받는 수당·보수·물품·자격이 있으면 ID(r로 시작)를 rewardIds에 넣습니다. 임무와 무관한 거래, 다른 임무의 보상은 넣지 않습니다. 확신이 없으면 넣지 않습니다.',
      '- reputation은 이 확장의 명성 규칙에 따른 제안입니다. 임무의 규모와 공적을 보고 amount를 정합니다: 1 소규모 의뢰, 2 다수의 인명·시설을 지킨 주목할 공적, 3 협회·길드 차원에서 인정받을 공적, 4 도시 단위 위기 해결, 5 세계관 전체에 알려질 업적. reason에는 근거가 된 공적을 한 문장으로 적습니다. 공적이 불분명하면 1입니다.',
      '- 후보와 등록된 퀘스트에 없는 사건이나 보상을 만들지 않습니다. 주인공: '+(hero||'플레이어 캐릭터')+'.',
      '반환 JSON만 출력: {"groups":[{"memberIds":["c1"],"existingQuestId":"","rewardIds":[],"reputation":{"amount":1,"reason":""},"title":"","objective":"","steps":[{"text":"","done":false,"doneBy":""}],"status":"active"}]}',
      '[새 퀘스트 후보]\n'+JSON.stringify(input.candidates),
      '[등록된 퀘스트]\n'+JSON.stringify(input.existing),
      '[보상 후보]\n'+JSON.stringify(input.rewards||[])
    ].join('\n\n');
  }
  function gfqApplyConsolidation(pool,groups,candMap,questMap,rewardMap=new Map()){
    const byId=new Map(pool.filter(p=>p.category==='quest').map(p=>[p.id,p])),all=new Map(pool.map(p=>[p.id,p])),rewardUsed=new Set(),rewardTo=new Map();let rewardLinks=0;
    const clean=(v,n)=>String(v||'').replace(/\s+/g,' ').trim().slice(0,n);
    const used=new Set(),firstOf=new Map();let mergedGroups=0,updates=0;
    for(const g of (Array.isArray(groups)?groups:[]).slice(0,80)){
      if(!g||typeof g!=='object')continue;
      const members=[...new Set((Array.isArray(g.memberIds)?g.memberIds:[]).map(v=>candMap.get(String(v))))].filter(id=>id&&byId.has(id)&&!used.has(id));
      if(!members.length)continue;
      const existing=questMap.get(String(g.existingQuestId||''))||'';
      // Each reward candidate belongs to at most one mission.
      const linkIds=[];
      const linkedRewards=[...new Set((Array.isArray(g.rewardIds)?g.rewardIds:[]).map(v=>rewardMap.get(String(v))))].filter(id=>id&&all.has(id)&&!rewardUsed.has(id)).map(id=>{rewardUsed.add(id);linkIds.push(id);return gfqRewardFromProposal(all.get(id));}).filter(Boolean);
      // v0.3.11: assessed reputation (1-5 with a reason) is a proposal of this extension's own rule.
      const repN=Number(g.reputation?.amount),repReason=clean(g.reputation?.reason,120);
      if(Number.isFinite(repN)&&repN>=1)linkedRewards.push({name:'명성 상승',kind:'reputation',certainty:'suggested',amount:Math.max(1,Math.min(5,Math.round(repN))),unit:'점',assessed:true,evidence:'확장 명성 규칙 제안'+(repReason?': '+repReason:'')});
      if(members.length===1&&!existing&&!linkedRewards.length)continue; // nothing to merge: keep the original candidate untouched
      const ms=members.map(id=>byId.get(id));members.forEach(id=>used.add(id));
      const base=ms.find(p=>Array.isArray(p.questRewards)&&p.questRewards.length)||ms[0];
      const title=clean(g.title,90)||base.questTitle||base.name;
      for(const id of linkIds)rewardTo.set(id,title);
      const steps=(Array.isArray(g.steps)?g.steps:[]).slice(0,8).map(v=>typeof v==='string'?{text:v,done:false}:{text:v?.text,done:v?.done===true,by:candMap.get(String(v?.doneBy||''))}).map(v=>({text:clean(v.text,80),done:v.done,evidence:v.done&&v.by&&members.includes(v.by)?String(byId.get(v.by)?.evidence||''):''})).filter(v=>v.text);
      const anyDone=ms.some(p=>p.status==='completed'),allDone=ms.every(p=>p.status==='completed');
      const rewards=[...linkedRewards],seen=new Set(linkedRewards.map(r=>r.name+'|'+(r.amount??'')));
      rewardLinks+=linkedRewards.filter(r=>r.kind!=='reputation').length;
      // Rewards the extraction already wrote on the quest are dropped when a linked candidate has the same amount.
      for(const r of ms.flatMap(p=>Array.isArray(p.questRewards)?p.questRewards:[])){if(!r)continue;const k=String(r.name||'')+'|'+(r.amount??'');if(seen.has(k)||(typeof r.amount==='number'&&linkedRewards.some(v=>v.amount===r.amount&&v.unit===String(r.unit||''))))continue;seen.add(k);rewards.push(r);}
      const evidence=[...new Set(ms.flatMap(p=>Array.isArray(p.sourceEvidence)&&p.sourceEvidence.length?p.sourceEvidence:[p.evidence]).filter(Boolean))].slice(0,12);
      const merged={...base,id:uid(),name:title,questTitle:title,questObjective:clean(g.objective,350)||base.questObjective||'',
        questSteps:steps.map(v=>v.text),questStepDone:steps.map(v=>v.done),questStepEvidence:steps.map(v=>v.evidence),
        // Completion needs every member completed, or the AI's verdict backed by all listed steps being done.
        status:allDone||(g.status==='completed'&&anyDone&&steps.length>0&&steps.every(v=>v.done))?'completed':'active',
        questRewards:[...rewards.filter(r=>r.kind!=='reputation'),...rewards.filter(r=>r.kind==='reputation')].slice(0,8),sourceEvidence:evidence,
        source:[...new Set(ms.map(p=>p.source).filter(Boolean))].join(' / ').slice(0,120),
        mergedCount:ms.length,updateOf:existing};
      firstOf.set(members[0],merged);
      if(ms.length>1)mergedGroups++;if(existing)updates++;
    }
    const list=[];
    // v0.7.2: a conditional guarantee linked to a mission lives only on that mission; other linked rewards say where they belong.
    for(const p of pool){
      if(rewardTo.has(p.id)&&['asset','contract'].includes(p.category)&&gfqIsCond(p))continue;
      if(!used.has(p.id)){list.push(rewardTo.has(p.id)?{...p,linkedQuest:rewardTo.get(p.id)}:p);continue;}
      const m=firstOf.get(p.id);if(m)list.push(m);}
    return {list,mergedGroups,updates,absorbed:used.size,rewardLinks};
  }
  async function gfqConsolidateQuests(w,pool,host,connectionId,runId,signal){
    const input=gfqConsolidationInput(w,pool);
    if(!input.candidates.length||(input.candidates.length<2&&!input.existing.length&&!input.rewards.length))return {list:pool,skipped:true};
    const raw=await gfqGenerate(host,connectionId,runId,'Group RPG quest candidates into missions. Return only JSON.',gfqConsolidationPrompt(input,gfqRuleCtx(w).hero),3000,signal);
    const parsed=gfqParseEvents(raw,'groups');
    if(!parsed)throw Error('통합 응답에서 JSON을 찾지 못했습니다');
    return gfqApplyConsolidation(pool,parsed.events,input.candMap,input.questMap,input.rewardMap);
  }
  function gfqConsolidationSummary(c){
    if(!c||c.skipped)return '';
    if(c.error)return '퀘스트 통합: 실패해 개별 후보로 유지했습니다 ('+c.error+')';
    return '퀘스트 통합: 후보 '+c.absorbed+'개를 정리했습니다 (묶음 '+c.mergedGroups+'개, 기존 퀘스트 갱신 '+c.updates+'개, 보상 연결 '+(c.rewardLinks||0)+'개)';
  }
  // v0.4.0: the analysis core is shared by the manual button and the automatic triggers.
  let gfqBusy=false;
  async function invokeQuestBridge(){
    const w=current();if(!w)return;
    if(gfqBusy)return alert('분석이 이미 진행 중입니다. 끝난 뒤 다시 시도해 주세요.');
    const connectionId=String(data.aiConnectionId||'').trim();
    if(!connectionId)return alert('설정에서 분석용 AI 연결을 먼저 선택해 주세요.');
    const allRecords=gfqStoryRecords(w);
    if(!allRecords.length)return alert('분석할 스토리 기록이 없습니다.');
    const allBatches=gfqChapterBatches(allRecords),hashes=gfqChapterHashes(allBatches);
    // v0.3.11: analysis range. 'new' re-analyses only chapters that are new or changed since their last successful analysis.
    const mode=data.aiRange||'new';let chosen=allBatches;
    if(mode==='new'){
      chosen=allBatches.filter(b=>(w.gfAnalyzed||{})[b.chapter]!==hashes[b.chapter]);
      if(!chosen.length)return alert('새로 추가되거나 바뀐 챕터가 없습니다. 이미 분석한 챕터를 다시 보려면 분석 범위를 \'전체\' 또는 \'챕터 지정\'으로 바꿔 주세요.');
    }else if(mode==='pick'){
      const list=[...new Set(allBatches.map(b=>b.chapter))];
      const ans=(await ask('분석할 챕터를 입력해 주세요. (예: 4 또는 2-4)\n저장된 챕터: '+list.join(', '),list[list.length-1]||''));
      if(ans===null)return;
      const want=gfqParseChapterRange(ans,list);
      if(!want.size)return alert('입력한 범위에 해당하는 저장된 챕터가 없습니다.');
      chosen=allBatches.filter(b=>want.has(b.chapter));
    }
    const chapterCount=new Set(chosen.map(b=>b.chapter)).size,recordCount=chosen.reduce((n,b)=>n+b.length,0);
    if(!(await gfqConfirm((mode==='new'?'새로 추가·변경된 ':'')+'챕터 '+chapterCount+'개('+[...new Set(chosen.map(b=>b.chapter))].join(', ')+')의 스토리 '+recordCount+'개를 '+chosen.length+'회 나눠 분석하시겠습니까? 챕터마다 AI를 호출합니다.'+(data.autoApply?'\n\n자동 반영이 켜져 있어, 검증을 통과한 결과는 바로 반영됩니다.':''))))return;
    const r=await gfqRunAnalysis(data.world,chosen,hashes,{auto:false});
    if(r.error)return alert('AI 분석에 실패했습니다: '+r.error);
    alert('AI 분석이 완료되었습니다. '+r.found+'개의 새 후보를 찾았습니다.'+(r.applied?'\n자동 반영 '+r.applied+'개 · 검토 필요 '+r.left+'개':'')+'\n\n'+gfqAnalysisSummary(r.world.gfLastAnalysis));
  }
  // v0.13.0: the world-fitting starting date (used only while the story itself writes no date).
  function gfqSetAnchor(w,g,chapter,by){
    w.gfDateAnchor={date:g.date,chapter:String(chapter||''),by,at:now(),ms:Date.now(),...(g.reason?{reason:g.reason}:{}),...(gfqClockOf(g)||{})};
    if(g.era&&!w.gfEra)w.gfEra=g.era;
    record(w,'세계관 날짜 지정 ('+(by==='ai'?'AI 추정':'자동')+'): '+g.date+(g.reason?' · '+g.reason:''));
  }
  // The latest chapter the world knows of: a typed date applies from there on.
  function gfqLatestChapter(w,c){
    const n=[...Object.keys(w.gfDates||{}),...(w.gfStorySamples||[]).map(x=>x.chapter),...(w.gfChapterIndex||[]).map(x=>x.chapter),c?.chapter||0].map(Number).filter(Number.isFinite);
    return Math.max(0,...n);
  }
  // v0.13.0: the first date the story itself writes (or the player types) confirms the calendar. Every estimate made
  // before it (the world-fitting date and days counted from it) moves by the same number of days, so promises
  // counted from an estimate do not turn up as overdue. Returns the shift in days.
  function gfqRebase(w,written){
    const a=w?.gfDateAnchor;if(!a?.date||a.confirmed||!written)return 0;
    const cur=gfqCurrentDate(w),from=cur&&/추정/.test(cur.basis)?cur.date:a.date,delta=gfqDayDiff(from,written);
    a.confirmed=true;if(!delta)return 0;
    const sh=d=>d?gfqAddDays(d,delta):d;
    a.date=sh(a.date);
    for(const v of Object.values(w.gfDates||{}))if(v&&v.basis==='추정')v.date=sh(v.date);
    if(w.gfDateManual?.by==='ai')w.gfDateManual.date=sh(w.gfDateManual.date);
    if(w.gfReadingDate?.est)w.gfReadingDate.date=sh(w.gfReadingDate.date);
    for(const k of ['gfReadingTime','gfTimeManual','gfDayIndex'])if(w[k]?.date)w[k].date=sh(w[k].date);
    record(w,'추정 날짜를 원문 날짜에 맞춤: '+(delta>0?'+':'')+delta+'일 ('+from+' → '+written+')');
    return delta;
  }
  // v0.13.0: ask the analysis model for a date (and time of day) that fits the world. The reply is validated like any other.
  async function gfqAiWorldDate(w){
    const host=typeof marinara==='object'&&marinara?marinara:globalThis.marinara||{};
    const recs=gfqStoryRecords(w),premise=recs.filter(r=>/줄거리/.test(r.source)).map(r=>'['+r.source+'] '+r.text).join('\n').slice(0,3500);
    const recent=recs.filter(r=>!/줄거리/.test(r.source)).slice(-3).map(r=>'['+r.source+'] '+r.text).join('\n').slice(-2500);
    const texts=recs.map(r=>r.text);
    const prompt=['이 이야기 세계에 어울리는 \'오늘\'의 날짜와 때를 하나 정합니다. 반환 JSON: {"worldDate":"YYYY-MM-DD","era":"원문에 나오는 고유 연호 이름 또는 빈 문자열","worldTimeOfDay":"새벽|아침|오전|점심|오후|저녁|밤|심야 또는 빈 문자열","worldTime":"HH:MM 또는 빈 문자열","worldDateReason":"근거 한 문장"}',
      '원문에 연도(예: 2033년)·계절·명절·학기 같은 단서가 있으면 반드시 따릅니다. 현대·근미래 배경은 그 시대에 맞는 연도, 고유 연호가 있는 판타지 세계는 그 연호의 연도(예: 0312-04-09)를 씁니다. 마지막 장면의 때(아침·밤 등)를 알 수 있으면 worldTimeOfDay에 씁니다.',
      'JSON 외 다른 출력은 금지합니다.',
      '월드: '+(w.gfDisplayName||data.world)+(w.protagonist?' · 주인공: '+w.protagonist:''),
      '[줄거리]\n'+(premise||'(없음)'),'[최근 장면]\n'+(recent||'(없음)')].join('\n');
    const raw=await gfqGenerate(host,String(data.aiConnectionId||'').trim(),'gfq-date-'+Date.now().toString(36),'Choose an in-world calendar date that fits the story world. Return only JSON.',prompt,600);
    const m=String(raw||'').match(/\{[\s\S]*\}/);if(!m)throw Error('응답에서 JSON을 찾지 못했습니다');
    const g=gfqWorldDateFrom(JSON.parse(m[0]),texts);if(!g)throw Error('날짜 형식이 올바르지 않습니다');
    return g;
  }
  async function gfqRunAnalysis(worldKey,batches,hashes,opts={}){
    const w=data.worlds[worldKey];
    if(!w)return {error:'월드를 찾지 못했습니다.'};
    if(gfqBusy)return {error:'분석이 이미 진행 중입니다.'};
    const connectionId=String(data.aiConnectionId||'').trim();
    if(!connectionId)return {error:'AI 연결이 선택되지 않았습니다.'};
    gfqBusy=true;
    const requestRun='gfq-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,9);
    const host=typeof marinara==='object'&&marinara?marinara:globalThis.marinara||{};
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),Math.min(1800000,120000*Math.max(1,batches.length)));
    const stats={format:0,filtered:0,evidence:0,duplicate:0};
    const failures=[];let partialBatches=0,processed=0;const chapterFailed=new Set();
    try{
      const known=gfqKnownKeys(w);
      const eventsToAdd=[];
      let dateMap=gfqDateMap(w),headed=gfqHeadingDates(dateMap),anchored=false;
      {const first=Object.entries(headed).filter(([,v])=>v.basis==='원문').sort((a,b)=>Number(a[0])-Number(b[0]))[0];if(first&&gfqRebase(w,first[1].date)){dateMap=gfqDateMap(w);headed=gfqHeadingDates(dateMap);}}
      w.gfDates={...(w.gfDates||{}),...headed};
      if(!w.gfEra&&gfqMapEra(dateMap))w.gfEra=gfqMapEra(dateMap);
      for(let batchIndex=0;batchIndex<batches.length;batchIndex++){
        if(controller.signal.aborted){batches.slice(batchIndex).forEach(b=>chapterFailed.add(b.chapter));failures.push(batches.slice(batchIndex).map(b=>b.label).join(', ')+': 제한 시간 초과로 실행하지 않았습니다');break;}
        const linkCtx=gfqContextItems(w,[...(w.aiProposals||[]),...eventsToAdd]);
        const segment=batches[batchIndex],promptText=aiAnalysisPrompt(w,segment,linkCtx.text),label=segment.label+' ('+(batchIndex+1)+'/'+batches.length+'회차)';
        // v0.3.5: one failed batch no longer discards the results of the others.
        try{
          const text=await gfqGenerate(host,connectionId,requestRun+'-'+batchIndex,'Extract exhaustive story events and all actual or promised financial transactions. Return only a JSON object with events array.',promptText,4000,controller.signal);
          const parsed=gfqParseEvents(text);
          if(!parsed)throw Error('AI 응답에서 JSON 사건 목록을 찾지 못했습니다');
          if(parsed.partial)partialBatches++;
          const before=eventsToAdd.length;
          const root=parsed.root?.timeline,texts=segment.map(t=>t.text);
          // v0.13.0: no date anywhere yet: take the AI's world-fitting date as the starting point.
          if(!gfqCurrentDate(w)&&!headed[segment.chapter]&&!gfqTimelineFrom(root,texts,null,null)){const g=gfqWorldDateFrom(root,texts);if(g){gfqSetAnchor(w,g,segment.chapter,'ai');anchored=true;stats.anchored=gfqDateText(w,g.date);}}
          const tl=gfqTimelineFrom(root,texts,gfqCurrentDate(w)?.date||null,gfqCurrentClock(w));
          if(tl&&segment.chapter&&segment.chapter!=='?'&&!headed[segment.chapter]){if(tl.basis==='원문')gfqRebase(w,tl.date);w.gfDates||={};w.gfDates[segment.chapter]={...tl,source:segment.label};stats.dated=(stats.dated||0)+1;}
          else if(tl&&headed[segment.chapter]&&!headed[segment.chapter].time&&!headed[segment.chapter].period&&(tl.time||tl.period)&&w.gfDates?.[segment.chapter]?.date===tl.date)Object.assign(w.gfDates[segment.chapter],gfqClockOf(tl));
          gfqCollectEvents(parsed.events.slice(0,75),segment.map(t=>t.text),w,known,eventsToAdd,stats);
          for(const p of eventsToAdd.slice(before))gfqApplyLink(p,linkCtx.map,stats);
          processed++;
        }catch(e){
          chapterFailed.add(segment.chapter);
          if(controller.signal.aborted)failures.push(label+': 제한 시간 초과');
          else failures.push(label+': '+String(e?.message||e));
        }
      }
      if(data.worlds[worldKey]!==w)throw Error('분석 중 월드 데이터가 바뀌어 결과를 적용하지 않았습니다.');
      if(!processed)throw Error('모든 회차의 분석에 실패했습니다.\n'+failures.slice(0,6).join('\n'));
      // v0.13.0: still no date after the whole run: pick one from the story's own year and season.
      if(!gfqCurrentDate(w)){const g=gfqGuessWorldDate(w);if(g.date){const first=batches.find(b=>b.chapter&&b.chapter!=='?');gfqSetAnchor(w,g,first?.chapter||'','guess');anchored=true;stats.anchored=gfqDateText(w,g.date);}}
      if(anchored){dateMap=gfqDateMap(w);headed=gfqHeadingDates(dateMap);w.gfDates={...(w.gfDates||{}),...headed};}
      for(const [ch,c] of Object.entries(gfqHeadingClocks(dateMap))){const e=(w.gfDates||={})[ch];if(!e)w.gfDates[ch]=c;else if(!e.time&&!e.period&&e.date===c.date)Object.assign(e,gfqClockOf(c));}
      const merged=gfqIntegrateQuests(eventsToAdd,gfqRuleCtx(w));
      stats.components=gfqMarkComponents(merged);
      let pool=[...(w.aiProposals||[]),...merged],consolidation=null;
      try{consolidation=await gfqConsolidateQuests(w,pool,host,connectionId,requestRun+'-q',controller.signal);pool=consolidation.list;}
      catch(e){consolidation={error:controller.signal.aborted?'제한 시간 초과':String(e?.message||e)};}
      if(data.worlds[worldKey]!==w)throw Error('분석 중 월드 데이터가 바뀌어 결과를 적용하지 않았습니다.');
      const before=new Set((w.aiProposals||[]).map(p=>p.id));
      for(const p of pool)if(!before.has(p.id))gfqStampDates(dateMap,p);
      w.aiProposals=pool;
      w.gfMissingMoney=gfqMissingMoney(w);
      const done=[...new Set(batches.map(b=>b.chapter))].filter(ch=>!chapterFailed.has(ch));
      w.gfAnalyzed||={};for(const ch of done)if(hashes[ch])w.gfAnalyzed[ch]=hashes[ch];
      // v0.4.0: remember which scenes were analysed so scene-mode only sends new ones.
      const seen=new Set(w.gfSeenScenes||[]);for(const b of batches)if(!chapterFailed.has(b.chapter))for(const t of b)if(t.id)seen.add(t.id);
      w.gfSeenScenes=[...seen].slice(-2000);
      w.gfLastAnalysis={at:now(),auto:!!opts.auto,missing:w.gfMissingMoney.length,chapters:done,batches:batches.length,processed,partial:partialBatches,failures:failures.slice(0,12),added:merged.length,consolidation:gfqConsolidationSummary(consolidation),...stats};
      let applied=0,left=w.aiProposals.length,events=[];
      if(data.autoApply){
        const fresh=pool.filter(p=>!before.has(p.id));
        if(data.sceneTimed!==false&&w===current()){
          // v0.4.2: hold validated results until their line is on screen; chapters already behind the reader apply now.
          const vn=gfqVNState(gameRoot),behind=p=>vn&&vn.chapter&&gfqChapterOfSource(p.source)&&Number(gfqChapterOfSource(p.source))<Number(vn.chapter);
          const now_=fresh.filter(p=>gfqAutoEligible(p)&&behind(p)),later=fresh.filter(p=>gfqAutoEligible(p)&&!behind(p));
          for(const p of later)p.deferred=true;
          const r=gfqAutoApply(w,now_.map(p=>p.id));applied=r.applied;events=r.events;
          w.gfLastAnalysis.deferred=later.length;left=(w.aiProposals||[]).filter(p=>!p.deferred).length;
        }else{const r=gfqAutoApply(w,fresh.map(p=>p.id));applied=r.applied;left=r.left;events=r.events;}
        w.gfLastAnalysis.autoApplied=applied;
      }
      save();if(panel)render();
      gfqNotifyChanges(events,{found:merged.length,applied,left,auto:!!opts.auto,missing:w.gfMissingMoney.length,deferred:w.gfLastAnalysis.deferred||0});
      sceneKey='';gfqSceneTick();
      return {world:w,found:merged.length,applied,left};
    }catch(e){
      return {error:String(e?.message||e)};
    }finally{clearTimeout(timer);gfqBusy=false;}
  }
  // v0.4.0: automatic application. Only candidates that passed every check are applied; anything the
  // checks flagged stays in the review list. The state right before is kept for a one-step undo.
  const GFQ_REVIEW_NOTES=/(원문 근거에 없어|연결 제안을 거부|별도 항목으로 확인|누락 의심 금액에서)/u;
  function gfqAutoEligible(p){
    if(!p||p.status==='uncertain'||p.financialStatus==='uncertain')return false;
    return !GFQ_REVIEW_NOTES.test(String(p.auditNote||''));
  }
  function gfqAutoApply(w,ids){
    const pending=()=>(w.aiProposals||[]).length;
    if(w!==current())return {applied:0,left:pending(),events:[]};
    const want=new Set(ids),list=(w.aiProposals||[]).filter(p=>want.has(p.id)&&gfqAutoEligible(p));
    if(!list.length)return {applied:0,left:pending(),events:[]};
    const snap=JSON.stringify({quests:w.quests,fields:w.fields,items:w.items,gfLedger:w.gfLedger||[],aiProposals:w.aiProposals||[],aiAcceptedKeys:w.aiAcceptedKeys||[],history:w.history});
    const before=new Map((w.quests||[]).map(q=>[q.id,{claimed:!!q.claimed,done:(q.steps||[]).map((_,i)=>q.stepDone?.[i]===true),rep:!!q.reputationAwarded}]));
    // Money, items and benefits first so quest rewards can link to them; quests last.
    const ordered=[...list.filter(p=>p.category!=='quest'),...list.filter(p=>p.category==='quest')];
    const events=[];let applied=0;
    for(const p of ordered){
      const count=(w.quests||[]).length;
      if(!approveAiProposal(p.id,true))continue;
      applied++;events.push(...gfqEventsFor(w,p,before,count));
    }
    if(applied){w.gfUndo={at:now(),count:applied,snap};record(w,'자동 반영: '+applied+'개 항목 (기록 탭에서 되돌릴 수 있습니다)');}
    return {applied,left:pending(),events};
  }
  function gfqEventsFor(w,p,before,questCount){
    const ev=[];
    if(p.category==='quest'){
      const q=p.updateOf?(w.quests||[]).find(v=>v.id===p.updateOf):((w.quests||[]).length>questCount?w.quests[w.quests.length-1]:null);
      if(!q)return ev;
      const b=before.get(q.id);
      if(!b)ev.push({kind:'quest',title:q.claimed?'퀘스트 완료':'새 퀘스트',text:q.title});
      else{
        (q.steps||[]).forEach((t,i)=>{if(q.stepDone?.[i]===true&&!b.done[i])ev.push({kind:'step',title:'목표 달성',text:q.title+' · '+t});});
        if(q.claimed&&!b.claimed)ev.push({kind:'quest',title:'퀘스트 완료',text:q.title});
      }
      if(q.reputationAwarded&&!(b&&b.rep)){const r=(q.rewardDetails||[]).find(v=>v.kind==='reputation');if(r)ev.push({kind:'rep',title:'명성 상승',text:'+'+(r.amount||1)+'점 · '+q.title});}
    }else if(gfqMoney(p)){
      // v0.4.2: game-style money and item notices ("돈 수령 +1,400,000원", "아이템 획득 건틀릿 ×1").
      if(p.role!=='component'){
        const amt=typeof p.amount==='number'?gfqAmount(p.amount,p.unit).replace(' 원','원'):'금액 미확인';
        const t={received:['돈 수령','+'+amt],paid:['지출',(typeof p.amount==='number'?'−':'')+amt],pending:['지급 예정',amt],receivable:['받을 돈 확정',amt],waived:['비용 면제',amt],ownership:['지분 획득',amt]}[p.financialStatus]||[gfqLabel('money',p.financialStatus),amt];
        ev.push({kind:'money',title:t[0],text:t[1]+' · '+p.name});
      }
      for(const it of (p.purchasedItems||[]))ev.push({kind:'item',title:it.received?'아이템 구매':'구매 · 수령 예정',text:it.name+' ×'+it.qty});
      for(const it of (p.soldItems||[]))ev.push({kind:'item',title:'아이템 판매',text:it.name+' ×'+it.qty});
    }else if(p.category==='item'){
      const waiting=p.financialStatus==='pending'||p.status==='active';
      ev.push({kind:'item',title:waiting?'수령 예정':'아이템 획득',text:p.name+(!waiting&&typeof p.amount==='number'&&!gfqIsMoneyUnit(p.unit)?' ×'+p.amount:'')+(waiting&&gfqTiming(p)?' · '+gfqTiming(p).text:'')});
    }
    else if(p.category==='benefit'&&p.benefitMode==='voucher')ev.push({kind:'benefit',title:'혜택 획득',text:(/권$/.test(p.name)?p.name:p.name+'권')+' ×'+(p.benefitUses||1)});
    else if(p.category==='benefit'&&p.benefitMode==='permanent')ev.push({kind:'benefit',title:'상시 혜택',text:p.name});
    else if(p.category==='credential')ev.push({kind:'credential',title:'자격 취득',text:p.name});
    return ev;
  }
  // v0.4.0: quest notifications. A top-layer popover so they also show in fullscreen.
  let toastBox=null,questBox=null; // v0.7.1: quest popups in the middle, everything else top right
  // v0.7.1: popups are small tickets in the middle of the screen; the stub icon says what kind of event it is.
  function gfqToastStub(kind){
    const k={quest:'qm',step:'badge',money:'coin',rep:'star',item:'box',benefit:'ticket',credential:'badge',date:'cal',due:'cal',place:'pin',ach:'star',review:'card',info:'card'}[kind]||'card';
    const extra={qm:'<path d="M12 2.8 20.6 12 12 21.2 3.4 12z"/><path d="M12 7.8v5.4"/><circle cx="12" cy="16.3" r=".6" fill="currentColor"/>',cal:'<rect x="4" y="5.5" width="16" height="14"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>',pin:'<path d="M12 21s-6.5-6.4-6.5-11a6.5 6.5 0 0 1 13 0c0 4.6-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>'};
    return '<span class="gfq-t-stub" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round">'+(extra[k]||GFQ_ICONS[k])+'</svg></span>';
  }
  function gfqToastHide(){for(const b of [toastBox,questBox])if(b&&!b.children.length){try{b.hidePopover?.();}catch{}}}
  // v0.12.0: Chromium makes everything outside the fullscreen element inert, so a popover in <body>
  // is drawn above the game but cannot be clicked. While the game is fullscreen the popups live
  // inside its shadow root (with their own stylesheet) and move back to <body> afterwards.
  function gfqToastHome(){
    const fs=document.fullscreenElement||document.webkitFullscreenElement||null;
    const home=fs?(fs.shadowRoot||(/-/.test(fs.localName)||['iframe','video','canvas','img'].includes(fs.localName)?document.body:fs)):document.body;
    if(home instanceof ShadowRoot&&!home.getElementById(ID+'-tstyle')){const s=document.createElement('style');s.id=ID+'-tstyle';s.textContent=gfqToastCss;home.append(s);}
    return home;
  }
  // Inside the game element, clicks on a popup must not also reach the game (e.g. advance the story).
  function gfqToastShield(b){for(const t of ['pointerdown','pointerup','mousedown','mouseup','click','touchstart','touchend'])b.addEventListener(t,e=>e.stopPropagation());}
  // Moves the popups to where they can be clicked; re-showing puts them above the fullscreen element in the top layer.
  function gfqToastPlace(){
    const home=gfqToastHome();
    for(const b of [toastBox,questBox]){
      if(!b||b.parentNode===home)continue;
      try{if(b.matches(':popover-open'))b.hidePopover();}catch{}
      home.append(b);
      try{if(b.children.length)b.showPopover();}catch{}
    }
  }
  function gfqToastBox(center=false){
    if(!toastBox){toastBox=document.createElement('div');toastBox.id=ID+'-toasts';toastBox.setAttribute('popover','manual');gfqToastShield(toastBox);}
    if(!questBox){questBox=document.createElement('div');questBox.id=ID+'-qtoasts';questBox.className='gfq-center';questBox.setAttribute('popover','manual');gfqToastShield(questBox);}
    gfqToastPlace();
    const box=center?questBox:toastBox;
    for(const b of [toastBox,questBox]){b.dataset.theme=gfqTheme(current());b.dataset.tone=gfqTone(current());}
    try{if(box.showPopover&&!box.matches(':popover-open'))box.showPopover();}catch{}
    return box;
  }
  function gfqToastTrim(box=toastBox){const plain=[...box.children].filter(e=>!e.classList.contains('gfq-toast-offer'));while(plain.length>3)plain.shift().remove();}
  // v0.4.2: a quest offer waits for the player's answer (no auto-hide).
  function gfqToastOffer(title,text,onAccept,onLater){
    if(!document.body)return;
    const box=gfqToastBox(true),el=document.createElement('div');el.className='gfq-toast gfq-toast-quest gfq-toast-offer';
    el.innerHTML=gfqToastStub('quest')+'<span class="gfq-t-body">'+gfqNoMatch('<b>'+esc(title)+'</b><span>'+esc(text)+'</span>')+'<span class="gfq-offer-row"><button type="button" data-o="yes">수락</button><button type="button" data-o="later">나중에</button></span></span>';
    el.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;el.remove();gfqToastHide();(b.dataset.o==='yes'?onAccept:onLater)();});
    box.append(el);
  }
  // v0.12.0: items the automatic pass could not apply are offered in a popup ([반영] [삭제] [나중에]) instead of
  // waiting in the history tab. Each item is offered once; [나중에] leaves it in the review list as before.
  const GFQ_REVIEW_CAT={quest:'퀘스트',item:'소지품',asset:'자산',contract:'계약',credential:'자격',benefit:'혜택',reputation:'명성'};
  function gfqReviewOffers(){
    const w=current();if(!w||!data.autoApply||!document.body)return;
    const list=(w.aiProposals||[]).filter(p=>!p.deferred&&!p.offered&&!p.reviewOffered);if(!list.length)return;
    const shown=list.slice(0,3);for(const p of shown)p.reviewOffered=true;save();
    for(const p of shown)gfqReviewOffer(w,p);
    if(list.length>shown.length)gfqToast('검토 필요','외 '+(list.length-shown.length)+'건 · 기록 탭에서 확인해 주세요','review');
  }
  function gfqReviewOffer(w,p){
    const box=gfqToastBox(true),el=document.createElement('div');el.className='gfq-toast gfq-toast-review gfq-toast-offer';
    const what=(GFQ_REVIEW_CAT[p.category]||p.category||'항목')+' · '+String(p.name||'');
    const ev=String(p.evidence||'').replace(/\s+/g,' ').trim();
    // An owned item with a similar name: ask whether it is the same thing instead of offering a plain [반영].
    const twin=p.category==='item'?gfqSimilarItem(w,p.name):null;
    el.innerHTML=gfqToastStub('review')+'<span class="gfq-t-body">'+gfqNoMatch('<b>'+(twin?'이미 가진 물건일 수 있음':'검토 필요 · 자동 반영 안 됨')+'</b><span>'+esc(what)+'</span>'+
        (twin?'<small class="gfq-offer-ev">이미 가진 \''+esc(twin.name)+' ×'+esc(twin.qty)+'\'과(와) 같은 물건인가요?</small>':'')+(ev?'<small class="gfq-offer-ev">“'+esc(ev.length>90?ev.slice(0,90)+'…':ev)+'”</small>':''))+
      '<span class="gfq-offer-row">'+(twin?'<button type="button" data-o="same">같은 물건</button><button type="button" data-o="new">새로 추가</button>':'<button type="button" data-o="yes">반영</button>')+
      '<button type="button" data-o="del">삭제</button><button type="button" data-o="later">나중에</button></span></span>';
    el.addEventListener('click',async e=>{
      const b=e.target.closest('button');if(!b)return;el.remove();gfqToastHide();
      const cw=current(),x=cw===w?(w.aiProposals||[]).find(v=>v.id===p.id):null;if(!x)return;
      if(b.dataset.o==='del'){w.aiProposals=w.aiProposals.filter(v=>v.id!==x.id);record(w,'AI 검토 삭제: '+x.name);save();render();return;}
      if(b.dataset.o==='same'||b.dataset.o==='new'){
        const t=gfqSimilarItem(w,x.name);
        if(approveAiProposal(x.id,false,b.dataset.o==='same'&&t?{sameItem:t.id}:{assumeOne:true,newItem:true}))gfqToast(b.dataset.o==='same'?'같은 물건으로 확인했습니다':'새 물건으로 추가했습니다',what,'info');
        return;
      }
      if(b.dataset.o!=='yes')return;
      // [반영] is the confirmation; a money item may still need to know which existing entry it is.
      const q=gfqMoney(x)&&x.role!=='component'?gfqLedgerQuestion(w,x):null;
      const answer=q?await gfqPrompt(q.text,q.def):null;if(q&&answer===null)return;
      if(approveAiProposal(x.id,false,{answer,assumeOne:true}))gfqToast('반영했습니다',what,'info');
    });
    box.append(el);
  }
  function gfqToast(title,text,kind='info'){
    if(!document.body)return;
    const center=kind==='quest'||kind==='step',box=gfqToastBox(center);
    const el=document.createElement('button');el.type='button';el.className='gfq-toast gfq-toast-'+kind;
    el.innerHTML=gfqToastStub(kind)+gfqNoMatch('<span class="gfq-t-body"><b>'+esc(title)+'</b><span>'+esc(text)+'</span></span>');
    el.addEventListener('click',()=>{el.remove();gfqToastHide();currentTab=kind==='place'?'places':kind==='due'?'calendar':['date','money','item','benefit','credential','rep'].includes(kind)?'profile':['review','info'].includes(kind)?'history':'quests';if(!panel)openPanel();else render();});
    box.append(el);gfqToastTrim(box);
    setTimeout(()=>{el.remove();gfqToastHide();},kind==='review'?12000:7000);
  }
  function gfqNotifyChanges(events,info){
    const shown=events.slice(0,4);
    for(const e of shown)gfqToast(e.title,e.text,e.kind);
    if(events.length>shown.length)gfqToast('그 밖의 변경','외 '+(events.length-shown.length)+'건이 반영되었습니다','info');
    if(info.deferred)gfqToast('분석 완료',info.deferred+'건은 해당 대사가 나오면 반영합니다','info');
    if(!info.auto)return;
    if(!data.autoApply&&info.found)gfqToast('새 분석 후보',info.found+'건 · 기록 탭에서 검토해 주세요','review');
    else if(data.autoApply&&info.left)gfqReviewOffers();
    if(info.missing)gfqToast('누락 의심 금액',info.missing+'개 · 기록 탭에서 확인해 주세요','review');
  }
  // v0.4.0: automatic triggers driven by observed game traffic. One pending one-shot timer at most.
  let autoTimer=0,autoAgain=false;
  function gfqAutoSchedule(key){
    if(!['chapter','scene'].includes(data.aiMode)||!String(data.aiConnectionId||'').trim()||key!==data.world)return;
    if(autoTimer)clearTimeout(autoTimer);
    autoTimer=setTimeout(()=>{autoTimer=0;gfqAutoRun(key);},6000);
  }
  async function gfqAutoRun(key){
    if(gfqBusy){autoAgain=true;return;}
    const w=data.worlds[key];if(!w||key!==data.world)return;
    const {list,hashes}=gfqAutoBatches(w,data.aiMode);
    if(!list.length)return;
    // v0.4.3: guards against back-to-back runs while the game loads scenes one by one.
    const gate=gfqAutoGate(w,list,Date.now(),data.aiMode);
    if(gate.wait){if(autoTimer)clearTimeout(autoTimer);autoTimer=setTimeout(()=>{autoTimer=0;gfqAutoRun(key);},gate.wait);return;}
    const chapters=[...new Set(list.map(b=>b.chapter))],scenes=list.reduce((n,b)=>n+b.filter(t=>t.id).length,0);
    w.gfAutoLastAt=Date.now();
    gfqToast('자동 분석','챕터 '+chapters.join(', ')+' · 새 장면 '+scenes+'개 분석을 시작합니다','info');
    const r=await gfqRunAnalysis(key,list,hashes,{auto:true});
    w.gfAutoLog=[...(w.gfAutoLog||[]),{at:now(),chapters,scenes,chars:list.reduce((n,b)=>n+b.reduce((m,t)=>m+t.text.length,0),0),result:r.error?'실패: '+r.error.slice(0,60):'완료 · 새 후보 '+r.found+'개'}].slice(-10);
    if(!r.error)w.gfAutoLastChapter=Math.max(Number(w.gfAutoLastChapter||0),...chapters.map(c=>Number(c)||0));
    if(r.error){w.gfAutoFailAt=Date.now();gfqToast('자동 분석 실패',r.error.slice(0,140),'review');}
    save();
    if(autoAgain){autoAgain=false;gfqAutoSchedule(key);}
  }
  // Pure: whether to run now or wait. Scene mode waits for a meaningful amount of new text and
  // never runs more often than every 90 s; after a failure it waits 5 minutes.
  function gfqAutoGate(w,list,nowMs,mode){
    const since=nowMs-(w.gfAutoLastAt||0),failSince=nowMs-(w.gfAutoFailAt||0);
    if(w.gfAutoFailAt&&failSince<300000)return {wait:300000-failSince};
    if(mode==='scene'){
      // A chapter newer than anything analysed so far was just generated: run now.
      if(Math.max(...list.map(b=>Number(b.chapter)||0))>Number(w.gfAutoLastChapter||0))return {wait:0};
      if(since<90000)return {wait:90000-since};
      const chars=list.reduce((n,b)=>n+b.filter(t=>t.id).reduce((m,t)=>m+t.text.length,0),0);
      const chapterAhead=list.some(b=>Number(b.chapter)<Math.max(...list.map(x=>Number(x.chapter)||0)));
      if(chars<600&&!chapterAhead&&since<600000)return {wait:Math.max(30000,90000-since)};
    }
    return {wait:0};
  }
  function gfqAutoBatches(w,mode){
    const all=gfqChapterBatches(gfqStoryRecords(w)),hashes=gfqChapterHashes(all);
    const chapters=[...new Set(all.map(b=>b.chapter))],num=c=>Number(c);
    if(mode==='chapter'){
      // A chapter is finished once a later chapter has started or the game marks it cleared/complete.
      const finished=c=>chapters.some(o=>Number.isFinite(num(o))&&Number.isFinite(num(c))&&num(o)>num(c))||
        (w.gfChapterIndex||[]).some(v=>String(v.chapter)===c&&v.cleared)||(w.gfContinuityIndex||[]).some(v=>String(v.chapter)===c&&v.complete);
      return {list:all.filter(b=>finished(b.chapter)&&(w.gfAnalyzed||{})[b.chapter]!==hashes[b.chapter]),hashes};
    }
    if(mode==='scene'){
      const seen=new Set(w.gfSeenScenes||[]),out=[];
      for(const b of all){
        const fresh=b.filter(t=>t.id?!seen.has(t.id):(w.gfAnalyzed||{})[b.chapter]===undefined);
        if(!fresh.some(t=>t.id))continue;
        Object.assign(fresh,{chapter:b.chapter,part:b.part,label:b.label});out.push(fresh);
      }
      return {list:out,hashes:{}}; // scene runs never mark a whole chapter as analysed
    }
    return {list:[],hashes};
  }
  // v0.4.2: scene-timed delivery. Results are analysed ahead of time but delivered when the matching
  // line of dialogue is on screen. The game shows one line at a time inside .vn; .vn-caption names the
  // chapter ('3챕터 · …') and .vn-count the line ('07 / 58').
  // v0.12.0: Gacha Forge 1.8.12 itself writes 'Chapter Three · …' (words up to ten, digits after); Korean
  // builds write '3챕터 · …'. Pure: the chapter number as a string, or '' when the caption names none.
  const GFQ_CH_WORDS=['zero','one','two','three','four','five','six','seven','eight','nine','ten'];
  function gfqCaptionChapter(text){
    const t=String(text||'');
    const ko=t.match(/(\d+)\s*챕터/u)||t.match(/챕터\s*(\d+)/u);if(ko)return ko[1];
    const en=t.match(/chapter\s+(\d+|[a-z]+)/i);if(!en)return '';
    if(/^\d+$/.test(en[1]))return en[1];
    const i=GFQ_CH_WORDS.indexOf(en[1].toLowerCase());return i>=0?String(i):'';
  }
  function gfqVNState(root){
    const vn=root?.querySelector('.vn');if(!vn)return null;
    // The chapter label is in .mood; the place title (.loc) is read only when there is no .mood.
    const cap=root.querySelector('.vn-caption .mood')?.textContent||root.querySelector('.vn-caption')?.textContent||'';
    const cnt=(root.querySelector('.vn-count')?.textContent||'').match(/(\d+)\s*\/\s*(\d+)/);
    return {text:vn.textContent||'',chapter:gfqCaptionChapter(cap),line:cnt?+cnt[1]:0,total:cnt?+cnt[2]:0};
  }
  function gfqVNStamps(root){
    const vn=root?.querySelector('.vn');if(!vn)return [];const out=[];
    for(const el of vn.querySelectorAll('*')){if(el.children.length)continue;const t=(el.textContent||'').trim();if(t.length&&t.length<=40){const s=gfqParseStamp(t);if(s)out.push(s);}}
    return out;
  }
  function gfqVNDate(root){return gfqVNStamps(root).find(s=>s.date)?.date||null;}
  const gfqChapterOfSource=s=>(String(s||'').match(/챕터\s*(\d+)/u)||[])[1]||'';
  function gfqEvidenceList(p){
    const l=[...new Set((Array.isArray(p.sourceEvidence)&&p.sourceEvidence.length?p.sourceEvidence:[p.evidence]).filter(Boolean))];
    return l.length?l:[String(p.evidence||'')];
  }
  // A line matches when it contains the quoted evidence, or the evidence's opening/closing words.
  function gfqLineHits(evidence,visibleNorm){
    const e=gfqNormMap(evidence).out;if(e.length<6)return false;
    if(visibleNorm.includes(e))return true;
    const k=Math.min(16,e.length);
    return e.length>=12&&(visibleNorm.includes(e.slice(0,k))||visibleNorm.includes(e.slice(-k)));
  }
  // Which deferred proposals the current screen reaches. Pure: returns [{p, at}] with at = evidence index or 'flush'.
  function gfqSceneHits(proposals,vn){
    const vis=gfqNormMap(vn.text).out,out=[];
    for(const p of proposals){
      if(!p.deferred)continue;
      const ch=gfqChapterOfSource(p.source);
      if(vn.chapter&&ch&&Number(ch)<Number(vn.chapter)){out.push({p,at:'flush'});continue;}
      if(vn.total&&vn.line>=vn.total&&ch&&ch===vn.chapter){out.push({p,at:'flush'});continue;}
      const list=gfqEvidenceList(p);
      for(let i=p.stage||0;i<list.length;i++)if(gfqLineHits(list[i],vis)){out.push({p,at:i});break;}
    }
    return out;
  }
  function gfqDeliver(w,p,at,events){
    const list=gfqEvidenceList(p),last=list.length-1;
    if(p.category!=='quest'){
      if(at==='flush'){
        p.deferred=false;
        p.auditNote='챕터 이동·마지막 줄만으로 자산·소지품·보상 수령이 확정되지 않습니다. 원문 근거를 검토해 주세요.';
        events.push({kind:'review',title:'자산·보상 확인 필요',text:String(p.name||'후보')+' · 수령·소유 근거 확인 필요'});
        return;
      }
      p.deferred=false;const count=(w.quests||[]).length;
      if(approveAiProposal(p.id,true))events.push(...gfqEventsFor(w,p,new Map(),count));
      return;
    }
    const target=(w.quests||[]).find(q=>q.id===(p.updateOf||p.acceptedQuestId));
    if(!target){
      if(at==='flush'){p.deferred=false;p.offered=false;p.auditNote='챕터 종료만으로는 퀘스트 수락·완료를 확정하지 않습니다. 검토 후 승인해 주세요.';events.push({kind:'review',title:'퀘스트 확인 필요',text:String(p.questTitle||p.name||'퀘스트')+' · 챕터 종료 시점 미확정'});return;}
      if(p.offered)return;
      p.offered=true;
      const pres=gfqQuestPresentation(gfqSafeProposal(p,gfqRuleCtx(w)));
      gfqToastOffer('새 퀘스트',pres.title+(pres.objective?' — '+pres.objective:''),()=>gfqAcceptQuest(p.id,at),()=>gfqLaterQuest(p.id));
      return;
    }
    const before=new Map([[target.id,{claimed:!!target.claimed,done:(target.steps||[]).map((_,k)=>target.stepDone?.[k]===true),rep:!!target.reputationAwarded}]]);
    if(at==='flush'){
      p.deferred=false;p.updateOf=target.id;p.auditNote='챕터 종료만으로 세부 목표 및 퀘스트 완료를 인정하지 않습니다. 근거를 확인해 주세요.';
      events.push({kind:'review',title:'완료 여부 검토',text:target.title+' · 완료 근거 확인 필요'});
      return;
    }
    if(at>=last){
      p.updateOf=target.id;p.deferred=false;
      if(approveAiProposal(p.id,true))events.push(...gfqEventsFor(w,p,before,(w.quests||[]).length));
      return;
    }
    // An intermediate evidence line completes the next unfinished sub-goal.
    target.stepDone=(target.steps||[]).map((_,k)=>target.stepDone?.[k]===true);
    // v0.6.2: when the analysis says which scene finished which sub-goal, tick exactly that one.
    const key=t=>gfqNormMap(t).out,line=key(list[at]||''),se=Array.isArray(p.questStepEvidence)?p.questStepEvidence:[],ps=Array.isArray(p.questSteps)?p.questSteps:[];
    target.steps=Array.isArray(target.steps)?target.steps:[];
    const ks=[];
    if(se.some(Boolean)){ps.forEach((t,i)=>{if(!se[i]||key(se[i])!==line)return;let k=target.steps.findIndex(v=>key(v)===key(t));if(k<0&&target.steps.length<12){target.steps.push(t);target.stepDone.push(false);k=target.steps.length-1;}if(k>=0&&!target.stepDone[k])ks.push(k);});}
    else{const k=target.stepDone.indexOf(false);if(k>=0)ks.push(k);}
    for(const k of ks){target.stepDone[k]=true;gfqChLog(w,p.source,'step',target.title+' · '+target.steps[k]);record(w,'세부 목표 달성: '+target.title+' · '+target.steps[k]);events.push({kind:'step',title:'목표 달성',text:target.title+' · '+target.steps[k]});}
    p.stage=at+1;
  }
  function gfqAcceptQuest(id,at){
    const w=current(),p=w?.aiProposals?.find(v=>v.id===id);if(!p)return;
    const events=[];
    if(gfqEvidenceList(p).length<=1){
      p.deferred=false;const count=(w.quests||[]).length;
      if(approveAiProposal(p.id,true))events.push(...gfqEventsFor(w,p,new Map(),count));
    }else{
      // Accepted now, completed by later lines: start with every sub-goal open.
      const pres=gfqQuestPresentation(gfqSafeProposal(p,gfqRuleCtx(w)));
      const q={id:uid(),...(p.date?{startDate:p.date}:{}),title:pres.title,type:'의뢰',detail:pres.objective,target:1,progress:0,reward:pres.rewardList.map(r=>r.name).join(' · '),rewardDetails:pres.rewardList,claimed:false,sourceEvidence:p.evidence,source:p.source,steps:pres.steps,stepDone:pres.steps.map(()=>false),rewardTransactionId:''};
      w.quests.push(q);p.acceptedQuestId=q.id;p.stage=(typeof at==='number'?at:0)+1;
      record(w,'퀘스트 수락: '+q.title);gfqRelinkQuestRewards(w);gfqQuestRewardItems(w,q);
      events.push({kind:'quest',title:'퀘스트 수락',text:q.title});
    }
    save();if(panel)render();for(const e of events)gfqToast(e.title,e.text,e.kind);
  }
  function gfqLaterQuest(id){
    const w=current(),p=w?.aiProposals?.find(v=>v.id===id);if(!p)return;
    p.deferred=false;save();if(panel)render();
    gfqToast('검토 목록으로 이동',(p.questTitle||p.name)+' · 기록 탭에서 언제든 반영할 수 있습니다','review');
  }
  let sceneKey='',sceneRecheck=0;
  // v0.13.0: also '4월 9일', '3일차', time lines ('오후 3시', '[밤]'); a clock going back (밤 → 아침) is the next day.
  function gfqDateTick(w,vn){
    const stamps=gfqVNStamps(gameRoot);if(!stamps.length)return;
    const cur=gfqCurrentDate(w),prevClock=gfqCurrentClock(w),prev=cur?.date||null;
    const ds=stamps.find(s=>s.date||s.md||s.day),cs=stamps.find(s=>s.time||s.period),clock=gfqClockOf(cs);
    const key=vn.chapter+'|'+JSON.stringify(ds||null)+'|'+JSON.stringify(clock);
    if(w.gfStampKey===key)return;w.gfStampKey=key;
    let d=ds?gfqResolveStamp(ds,prev,w.gfDayIndex||null,w.gfDateAnchor?.date||null):null,est=false;
    if(!d&&clock&&prev&&gfqClockWraps(prevClock,clock)){d=gfqAddDays(prev,1);est=true;}
    if(ds?.era&&!w.gfEra)w.gfEra=ds.era;
    if(ds?.day&&d)w.gfDayIndex={n:ds.day,date:d};
    const ms=Date.now(),dateChanged=!!d&&d!==prev&&w.gfReadingDate?.date!==d;
    const fixesEstimate=dateChanged&&!est&&!!w.gfDateAnchor&&!w.gfDateAnchor.confirmed;
    if(dateChanged&&!est)gfqRebase(w,d);
    if(dateChanged){
      w.gfReadingDate={date:d,chapter:vn.chapter,ms,at:now(),...(est?{est:true}:{}),...(clock||{})};
      const gap=prev&&!fixesEstimate?gfqDayDiff(prev,d):null;
      record(w,'세계관 날짜 변경: '+(prev?prev+' → ':'')+d+(clock?' '+gfqClockText(clock):'')+' (챕터 '+vn.chapter+(est?' 시각 줄로 추정':' 날짜 줄')+')');
      gfqToast('날짜 변경',gfqDayText(w,d)+(clock?' '+gfqClockText(clock):'')+(fixesEstimate?' · 추정 날짜를 원문에 맞췄습니다':gap===1?' · 하루가 지났습니다':gap>1?' · '+gap+'일이 지났습니다':''),'date');gfqDueToast(w,d);
    }
    if(clock&&(d||prev)){
      w.gfReadingTime={...clock,date:d||prev,chapter:vn.chapter,ms:ms+1,at:now()};
      if(!dateChanged&&clock.period!==prevClock?.period)gfqToast('시간 변경',gfqClockText(clock)+(prevClock?' · '+gfqClockText(prevClock)+'에서':''),'date');
    }
    if(!dateChanged&&!clock)return;
    save();if(panel&&currentTab==='profile')render();
  }
  let lineKey='';
  function gfqSceneTick(settled=false){
    const w=current();if(!w)return;
    const vn=gfqVNState(gameRoot);if(!vn)return;
    // Typewriter text may still be appearing: look once more shortly after a new line starts.
    const lk=vn.chapter+'|'+vn.line;
    if(lk!==lineKey){lineKey=lk;if(sceneRecheck)clearTimeout(sceneRecheck);sceneRecheck=setTimeout(()=>{sceneRecheck=0;sceneKey='';gfqSceneTick(true);},1200);}
    // v0.4.6: the in-world date follows the date lines the reader reaches (read only once the line has settled).
    if(settled){gfqDateTick(w,vn);gfqPlaceTick(w);}
    if(!data.autoApply||data.sceneTimed===false||!(w.aiProposals||[]).some(p=>p.deferred))return;
    const key=vn.chapter+'|'+vn.line+'|'+vn.text.length;if(key===sceneKey)return;
    sceneKey=key;
    const hits=gfqSceneHits(w.aiProposals,vn);if(!hits.length)return;
    const snap=JSON.stringify({quests:w.quests,fields:w.fields,items:w.items,gfLedger:w.gfLedger||[],aiProposals:w.aiProposals||[],aiAcceptedKeys:w.aiAcceptedKeys||[],history:w.history});
    // Money, items and benefits before quests so rewards can link.
    const events=[];hits.sort((a,b)=>(a.p.category==='quest')-(b.p.category==='quest'));
    for(const h of hits)gfqDeliver(w,h.p,h.at,events);
    if(events.length){w.gfUndo={at:now(),count:events.length,snap};}
    save();if(panel)render();
    for(const e of events.slice(0,4))gfqToast(e.title,e.text,e.kind);
    gfqReviewOffers();
  }
  // v0.5.0: story injection through a Marinara lorebook. Gacha Forge re-reads the world lorebooks for every
  // scene it narrates (when 'lorebooks feed story scenes' is on) and always includes constant entries, so
  // keeping one constant entry current puts the quest status into the next scene's prompt.
  function gfqInjectLines(w){
    const lines=[],ledger=w.gfLedger||[],items=w.items||[],fields=w.fields||[];
    const won=(n,u)=>typeof n==='number'?gfqAmount(n,u).replace(' 원','원'):'금액 미확인';
    const date=gfqCurrentDate(w),clock=gfqCurrentClock(w);if(date)lines.push(['날짜',w.gfEra?gfqDayText(w,date.date):date.date+' ('+gfqWeekday(date.date)+')']);if(date&&clock)lines.push(['시각',gfqClockText(clock)]);
    // v0.13.0: optional request to write a date/time line when the scene moves on, so the extension can follow it.
    if(w.gfAskStamp)lines.push(['날짜 표기','장면의 날짜나 시각이 바뀌면 그 장면 첫 줄에 '+(w.gfEra?'['+w.gfEra+' N년 M월 D일 시각]':'[YYYY년 M월 D일 (요일) 오전/오후 H시]')+' 형식으로 한 줄만 적습니다. 위 날짜·시각에서 이어지게 씁니다.']);
    const place=w.gfPlaceNow&&w.gfPlaces?.[w.gfPlaceNow.key];if(place)lines.push(['현재 위치',place.name]);
    const cash=gfqCash(w);if(cash.known)lines.push(['소지금',won(cash.balance,cash.unit)]);
    // v0.12.0: what the protagonist is wearing or wielding, so the next scenes can describe it.
    for(const i of items.filter(i=>i.equipped===true&&i.state!=='pending'&&i.kind!=='voucher'&&gfqIsEquipment(i)).slice(0,6))lines.push(['착용 중',i.name+(i.equipSlot?' ['+i.equipSlot+']':'')+(i.equipOptions?' ('+String(i.equipOptions).replace(/\s+/g,' ').trim().slice(0,80)+')':'')]);
    const open=(w.quests||[]).filter(q=>!q.claimed).slice(-4).reverse();
    for(const q of open){const k=(q.steps||[]).findIndex((_,i)=>q.stepDone?.[i]!==true);lines.push(['진행 중',q.title+(k>=0?' — 다음 목표: '+q.steps[k]:'')]);}
    for(const t of ledger.filter(t=>['pending','receivable'].includes(t.state)).slice(-6))lines.push(['받을 돈',t.name+' '+won(t.amount,t.unit)+(t.state==='pending'?' (지급 예정'+(t.timing?.text?' · '+t.timing.text:'')+')':' (확정·미입금)')]);
    for(const i of items.filter(i=>i.state==='pending').slice(-5)){const d=gfqResolveTiming(w,i.timing);lines.push(['수령 예정',i.name+(d?' ('+d+')':i.timing?.text?' ('+i.timing.text+')':'')]);}
    for(const i of items.filter(i=>i.kind==='voucher'&&i.qty>0).slice(-5))lines.push(['이용권',i.name+' ×'+i.qty]);
    for(const t of ledger.filter(t=>['received','paid'].includes(t.state)).slice(-3).reverse()){const h=(t.history||[]).slice().reverse().find(h=>h.state===t.state);lines.push([t.state==='received'?'최근 입금':'최근 지출',t.name+' '+won(t.amount,t.unit)+(h?.date?' ('+h.date+')':'')]);}
    for(const f of fields.filter(f=>/^보유 (자격|혜택) · /.test(f.name)).slice(0,5))lines.push([f.name.startsWith('보유 자격')?'보유 자격':'보유 혜택',f.name.replace(/^보유 (자격|혜택) · /,'')+(f.value&&!['취득','적용 중'].includes(f.value)?' ('+f.value+')':'')]);
    const rep=fields.find(f=>f.name==='명성');if(rep)lines.push(['명성',rep.value+(rep.unit||'')]);
    for(const q of (w.quests||[]).filter(q=>q.claimed).slice(-3).reverse())lines.push(['완료',q.title+(q.doneDate?' ('+q.doneDate+')':'')]);
    for(const i of items.filter(i=>i.state!=='pending'&&i.kind!=='voucher'&&i.qty>0).slice(-8))lines.push(['소지품',i.name+' ×'+i.qty]);
    for(const q of open){const st=(q.steps||[]).map((t,i)=>(q.stepDone?.[i]===true?'✓':'○')+t);if(st.length)lines.push(['목표 현황',q.title+': '+st.join(' / ')]);const rw=gfqMergeMoneyRewards(q.rewardDetails||[]).filter(r=>r.kind!=='reputation').map(r=>r.name+(typeof r.amount==='number'?' '+won(r.amount,r.unit):'')+' ['+gfqRewardState(w,r).text+']');if(rw.length)lines.push(['걸린 보상',q.title+': '+rw.join(', ')]);}
    return lines;
  }
  const GFQ_INJECT_SECTIONS=[{key:'status',name:'퀘스트 현황 · 요약',labels:['날짜','시각','날짜 표기','현재 위치','소지금','명성','보유 자격','보유 혜택']},{key:'quests',name:'퀘스트 현황 · 퀘스트',labels:['진행 중','목표 현황','걸린 보상','완료']},{key:'money',name:'퀘스트 현황 · 돈',labels:['받을 돈','최근 입금','최근 지출']},{key:'items',name:'퀘스트 현황 · 소지품',labels:['착용 중','수령 예정','이용권','소지품']}];
  function gfqInjectFit(head,lines,limit){
    // Group by label in priority order, then trim whole items from the end to fit the limit.
    let out=head;const max=Math.max(150,Number(limit)||600);
    for(const [label,text] of lines){
      const seg=out.includes('\n'+label+': ')?' · '+text:'\n'+label+': '+text;
      if(out.length+seg.length>max)continue;
      if(seg.startsWith(' · ')){const i=out.lastIndexOf('\n'+label+': ');const end=out.indexOf('\n',i+1);out=end<0?out+seg:out.slice(0,end)+seg+out.slice(end);}
      else out+=seg;
    }
    return out;
  }
  function gfqInjectText(w,limit=600){
    const head='[퀘스트 현황 · 퀘스트 확장 자동 기록] '+(String(w.protagonist||'').trim()||'주인공')+'의 확정된 진행 상태입니다. 이야기와 어긋나지 않게 이어 가되, 여기에 없는 지급·획득·완료를 새로 만들지 마세요.';
    return gfqInjectFit(head,gfqInjectLines(w).filter(([l])=>!['목표 현황','걸린 보상','현재 위치','소지금'].includes(l)),limit);
  }
  // v0.6.2: one constant entry per section, each refreshed on its own when its content changes.
  function gfqInjectSections(w,limit=600){
    const all=gfqInjectLines(w),hero=String(w.protagonist||'').trim()||'주인공';
    return GFQ_INJECT_SECTIONS.map((sec,i)=>{const mine=all.filter(([l])=>sec.labels.includes(l)).sort((a,b)=>sec.labels.indexOf(a[0])-sec.labels.indexOf(b[0]));
      const head='['+sec.name+' · 퀘스트 확장 자동 기록] '+hero+'의 확정된 상태입니다. 여기에 없는 지급·획득·완료를 새로 만들지 마세요.';
      return {...sec,order:i+1,text:mine.length?gfqInjectFit(head,mine,limit):head+'\n(기록 없음)'};});
  }
  async function gfqApi(path,method,body){
    const host=typeof marinara==='object'&&marinara?marinara:globalThis.marinara||{};
    // v0.5.1: when Marinara is opened remotely it requires Admin Access; send the same X-Admin-Secret header Marinara's
    // own client and Gacha Forge send (read from the same storage key), and only to same-origin /api paths.
    let admin='';try{admin=String(localStorage.getItem('marinara_admin_secret')||'').trim();}catch{}
    const opts={method,credentials:'same-origin',cache:'no-store',headers:{'content-type':'application/json','x-marinara-csrf':'1',...(admin?{'X-Admin-Secret':admin}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})};
    const r=typeof host.apiFetch==='function'?await host.apiFetch(path.replace(/^\/api\//,''),opts):await fetch(path,opts);
    const j=await r.json().catch(()=>null);
    if(!r.ok)throw Object.assign(Error(String(j?.error||j?.message||('HTTP '+r.status))),{status:r.status});
    return j;
  }
  async function gfqInjectCreate(w){
    const name=('퀘스트 확장 · '+(w.gfDisplayName||data.world)).slice(0,200);
    const book=await gfqApi('/api/lorebooks','POST',{name,description:'가챠 포지 퀘스트 확장이 자동으로 갱신하는 퀘스트 현황입니다. 내용은 확장이 덮어쓰므로 직접 고치지 마세요.',enabled:true,isGlobal:false,tags:['gacha-forge-quest']});
    w.gfInject={...(w.gfInject||{}),enabled:true,lorebookId:book.id,lorebookName:name,entryId:'',entries:{},lastHash:'',error:''};
    await gfqInjectSync(true,w);
    record(w,'스토리 반영용 로어북 생성: '+name);
    return book;
  }
  async function gfqInjectConnect(w,connect){
    const g=w.gfInject||{};if(!g.lorebookId||!w.gfRunId)throw Error('로어북 또는 게임 월드 연결 정보가 없습니다.');
    let lore=w.gfRunLore;
    if(!lore){const st=await gfqApi('/api/gacha-forge/state','GET');gfqRememberLore(w.gfRunId,st);lore=w.gfRunLore;}
    if(!lore)throw Error('게임에서 이 월드의 로어북 설정을 읽지 못했습니다.');
    // Refresh remote configuration before writing, to avoid replacing another extension's changes.
    try{
      const latest=await gfqApi('/api/gacha-forge/state','GET');
      gfqRememberLore(w.gfRunId,latest);
      if(w.gfRunLore)lore=w.gfRunLore;
    }catch(e){
      throw Error('월드 로어북 최신 설정을 확인하지 못해 변경하지 않았습니다: '+String(e.message||e));
    }
    let next;
    if(connect){
      if(!g.prevLore)g.prevLore=gfqCleanLore(lore);
      next=gfqMergeLore(lore,g.lorebookId,true);
    }else{
      // Only remove the extension's own book. Preserve all other books and current beat setting.
      next=gfqMergeLore(lore,g.lorebookId,false);
    }
    const r=await gfqApi('/api/gacha-forge/run/lorebooks','POST',{runId:w.gfRunId,lore:next});
    if(r&&r.ok===false)throw Error(String(r.error||'게임이 설정 변경을 거부했습니다.'));
    w.gfRunLore=gfqCleanLore(r?.lore||next);g.connected=connect;if(!connect)delete g.prevLore;w.gfInject=g;
    record(w,connect?'가챠 포지 월드 로어북에 연결: '+(g.lorebookName||g.lorebookId)+' (맨 앞, 스토리 장면에도 사용)':'가챠 포지 월드 로어북 연결 해제: '+(g.lorebookName||g.lorebookId));
    save();return w.gfRunLore;
  }
  var injectTimer=0,injectBusy=false,injectNeedsRetry=false;
  function gfqInjectSchedule(){
    const w=typeof current==='function'?current():null;
    if(!w?.gfInject?.enabled||!w.gfInject.lorebookId)return;
    if(injectTimer)clearTimeout(injectTimer);
    injectTimer=setTimeout(()=>{injectTimer=0;gfqInjectSync(false);},3000);
  }
  const gfqHash=t=>{let h=2166136261;for(let i=0;i<t.length;i++)h=Math.imul(h^t.charCodeAt(i),16777619)>>>0;return h.toString(36)+':'+t.length;};
  // v0.6.2: one constant entry per section (요약·퀘스트·돈·소지품). Only sections whose text changed are sent.
  // The entry made by v0.5.x becomes the 요약 entry, so nothing the player already connected is lost.
  async function gfqInjectSync(force,target){
    const w=target||current(),g=w?.gfInject;if(!g?.lorebookId)return false;
    if(injectBusy){injectNeedsRetry=true;return false;}
    g.entries=g.entries&&typeof g.entries==='object'?g.entries:{};
    if(g.entryId&&!g.entries.status)g.entries.status={id:g.entryId,hash:''};
    const book='/api/lorebooks/'+encodeURIComponent(g.lorebookId)+'/entries';
    injectBusy=true;let sent=0;
    try{
      for(const sec of gfqInjectSections(w,g.limit)){
        const e=g.entries[sec.key]||{},hash=gfqHash(sec.name+'\n'+sec.text);
        if(!force&&e.id&&e.hash===hash)continue;
        const body={name:sec.name,content:sec.text,constant:true,enabled:true,order:sec.order};
        try{
          if(e.id)await gfqApi(book+'/'+encodeURIComponent(e.id),'PATCH',body);
          else{const made=await gfqApi(book,'POST',{...body,keys:[],position:0,description:'퀘스트 확장 자동 기록'});e.id=made.id;}
        }catch(err){
          if(err.status!==404||!e.id)throw err;
          const made=await gfqApi(book,'POST',{...body,keys:[],position:0,description:'퀘스트 확장 자동 기록'});e.id=made.id; // entry deleted by hand: make it again
        }
        e.hash=hash;e.at=now();g.entries[sec.key]=e;sent++;
      }
      g.entryId=g.entries.status?.id||g.entryId;if(sent){g.lastAt=now();}g.error='';
    }catch(e){g.error=e.status===404?'로어북을 찾지 못했습니다. 설정 탭에서 다시 만들어 주세요.':String(e.message||e);}
    finally{
      injectBusy=false;
      if(injectNeedsRetry){
        injectNeedsRetry=false;
        if(injectTimer)clearTimeout(injectTimer);
        injectTimer=setTimeout(()=>{injectTimer=0;gfqInjectSync(false);},1500);
      }
    }
    try{localStorage.setItem(STORE,JSON.stringify(data));}catch{}
    if(panel&&currentTab==='settings')render();
    return !g.error;
  }
  function gfqTokens(t){try{const h=typeof marinara==='object'&&marinara?marinara:globalThis.marinara;if(h&&typeof h.estimateTextTokens==='function')return h.estimateTextTokens(t);}catch{}return Math.ceil(String(t).length*0.9);}
  function gfqInjectHtml(w){
    const g=w.gfInject||{},secs=gfqInjectSections(w,g.limit),text=secs.map(x=>x.text).join('\n\n');
    return '<div class="gfq-card"><b>스토리 반영 (로어북)</b><p class="gfq-muted">퀘스트·돈·물품·날짜 현황을 전용 로어북의 상시 항목 네 개(요약·퀘스트·돈·소지품)로 나눠, 목록이 바뀔 때마다 바뀐 항목만 자동으로 갱신합니다. 가챠 포지가 장면을 쓸 때마다 이 로어북을 새로 읽어, 다음 장면부터 이야기에 반영됩니다. 게임 저장 데이터와 직접 쓰신 지침은 바꾸지 않습니다.</p>'+
      (g.lorebookId?'<p class="gfq-muted">연결된 로어북: <b>'+esc(g.lorebookName||g.lorebookId)+'</b>'+(g.lastAt?' · 마지막 갱신 '+esc(g.lastAt):'')+(g.error?' · <span class="gfq-danger">'+esc(g.error)+'</span>':'')+'</p>':'')+
      '<label><input type="checkbox" id="gfq-inject-on" style="width:auto" '+(g.enabled&&g.lorebookId?'checked':'')+'> 현황을 로어북에 자동 반영</label>'+
      '<label><input type="checkbox" id="gfq-ask-stamp" style="width:auto" '+(w.gfAskStamp?'checked':'')+'> 장면이 바뀔 때 날짜·시각 한 줄을 적도록 요청 (확장이 날짜를 더 정확히 따라갑니다)</label>'+
      '<label for="gfq-inject-limit">항목별 최대 글자 수 (중요한 내용부터 채웁니다)</label><input id="gfq-inject-limit" type="number" min="150" max="4000" step="50" value="'+esc(g.limit||600)+'">'+
      '<label>현재 반영 내용 ('+text.length+'자 · 약 '+gfqTokens(text).toLocaleString('ko-KR')+'토큰'+(w.gfRunLore?' / 월드 로어북 예산 '+(w.gfRunLore.worldBudget||6000).toLocaleString('ko-KR')+'토큰':'')+')</label><textarea readonly rows="7">'+esc(text)+'</textarea>'+
      (g.lorebookId?'<p class="gfq-muted">가챠 포지 연결: '+(w.gfRunLore?(w.gfRunLore.worldIds.includes(g.lorebookId)?'<b>연결됨</b>'+(w.gfRunLore.worldIds[0]===g.lorebookId?' (월드 로어북 맨 앞)':'')+(w.gfRunLore.beat?' · 스토리 장면에도 사용':' · <span class="gfq-danger">스토리 장면 사용 꺼짐</span>'):'<span class="gfq-danger">연결 안 됨</span>'):'게임 설정을 아직 읽지 못했습니다 (가챠 포지 화면을 한 번 열어 주세요)')+'</p>':'')+
      '<div class="gfq-row">'+(g.lorebookId?btn('지금 반영','inject-now')+(w.gfRunLore&&w.gfRunLore.worldIds.includes(g.lorebookId)?btn('가챠 포지 연결 해제','inject-disconnect'):btn('가챠 포지에 연결','inject-connect','class="primary"'))+btn('로어북 다시 만들기','inject-create'):btn('스토리 반영용 로어북 만들기','inject-create','class="primary"'))+'</div>'+
      '<p class="gfq-muted">[가챠 포지에 연결]은 이 월드의 로어북 설정에서 기존 로어북과 예산을 그대로 두고, 이 로어북을 월드 로어북 <b>맨 앞</b>에 추가한 뒤 스토리 장면에도 쓰도록 켭니다. 맨 앞에 두면 예산이 모자랄 때도 이 항목은 빠지지 않고, 뒤쪽 기록이 먼저 빠집니다. 연결 전 설정은 저장해 두며 [연결 해제]로 되돌립니다. 자동 연결이 안 되면 가챠 포지 설정에서 직접 추가해 주세요.</p></div>';
  }
  function gfqKnownKeys(w){
    return new Set([...(w.aiProposals||[]).map(x=>x.category+'|'+x.evidence),...(w.aiAcceptedKeys||[])]);
  }
  function gfqCollectEvents(events,texts,w,known,out,stats){
    const ctx=gfqRuleCtx(w);
    for(const x of events){
      const r=gfqScreenEvent(x,texts,ctx);
      if(!r.proposal){stats[r.reason]=(stats[r.reason]||0)+1;continue;}
      const p=r.proposal,identity=p.category+'|'+p.evidence;
      if(known.has(identity)||out.some(y=>gfqDuplicate(y,p,ctx))||(w.aiProposals||[]).some(y=>gfqDuplicate(y,p,ctx))){stats.duplicate++;continue;}
      out.push(p);known.add(identity);
    }
  }
  function gfqAnalysisSummary(a){
    if(!a)return '';
    const lines=[...(a.chapters?.length?['분석한 챕터: '+a.chapters.join(', ')]:[]),'처리한 분석 회차: '+a.processed+'/'+a.batches+(a.partial?' (응답이 잘려 부분 복구한 회차 '+a.partial+'개)':'')];
    const dropped=[];
    if(a.evidence)dropped.push('원문 근거 불일치 '+a.evidence+'개');
    if(a.filtered)dropped.push('주인공 무관·유형 제외 '+a.filtered+'개');
    if(a.duplicate)dropped.push('중복 '+a.duplicate+'개');
    if(a.format)dropped.push('형식 오류 '+a.format+'개');
    if(dropped.length)lines.push('제외된 후보: '+dropped.join(', '));
    if(a.linked||a.linkRejected)lines.push('이전 기록 연결: '+(a.linked||0)+'개'+(a.linkRejected?' (검증 실패로 거부 '+a.linkRejected+'개)':''));
    if(a.components)lines.push('총액의 구성 금액으로 판정: '+a.components+'개');
    if(a.dated)lines.push('세계관 날짜 갱신: 챕터 '+a.dated+'개');
    if(a.anchored)lines.push('세계관 날짜 지정: '+a.anchored+' (원문에 날짜가 없어 세계관에 맞춰 정함 · 프로필에서 바꿀 수 있습니다)');
    if(a.consolidation)lines.push(a.consolidation);
    if(a.deferred)lines.push('장면 도달 대기: '+a.deferred+'개 (해당 대사가 나오면 반영)');
    if(a.missing)lines.push('누락 의심 금액: '+a.missing+'개 (아래 목록에서 확인해 주세요)');
    if(a.failures?.length)lines.push('실패한 회차:\n'+a.failures.join('\n'));
    return lines.join('\n');
  }
  async function importAiResult(){
    const w=current();if(!w)return;const worldKey=data.world;
    const raw=(await gfqPrompt('AI가 반환한 JSON을 붙여넣어 주세요. 배열 또는 {"events":[...]} 형식을 지원합니다. 원문에서 근거가 확인되는 항목만 검토 목록에 추가됩니다.'));
    if(!raw)return;
    try{
      const parsed=gfqParseEvents(raw);
      if(!parsed)throw Error('JSON 사건 목록을 찾지 못했습니다.');
      if(parsed.events.length>150)throw Error('한 번에 150개 이하의 항목만 가져올 수 있습니다.');
      // Numeric strings from external tools are accepted as amounts.
      const events=parsed.events.map(x=>x&&typeof x==='object'&&typeof x.amount==='string'&&x.amount.trim()&&Number.isFinite(Number(x.amount.replace(/,/g,'')))?{...x,amount:Number(x.amount.replace(/,/g,''))}:x);
      const stats={format:0,filtered:0,evidence:0,duplicate:0},added=[];
      gfqCollectEvents(events,gfqStoryRecords(w).map(r=>r.text),w,gfqKnownKeys(w),added,stats);
      for(const x of added)delete x.linkTo;
      const merged=gfqIntegrateQuests(added,gfqRuleCtx(w));
      stats.components=gfqMarkComponents(merged);
      let pool=[...(w.aiProposals||[]),...merged],consolidation=null;
      const connectionId=String(data.aiConnectionId||'').trim();
      if(connectionId&&merged.some(p=>p.category==='quest')){
        const host=typeof marinara==='object'&&marinara?marinara:globalThis.marinara||{};
        try{consolidation=await gfqConsolidateQuests(w,pool,host,connectionId,'gfq-import-'+Date.now().toString(36),undefined);pool=consolidation.list;}
        catch(e){consolidation={error:String(e?.message||e)};}
      }
      if(data.world!==worldKey||current()!==w)throw Error('처리 중 월드가 변경되어 결과를 적용하지 않았습니다.');
      {const dm=gfqDateMap(w),old=new Set((w.aiProposals||[]).map(p=>p.id));for(const p of pool)if(!old.has(p.id))gfqStampDates(dm,p);}
      w.aiProposals=pool;
      w.gfMissingMoney=gfqMissingMoney(w);
      save();render();
      alert(merged.length+'개의 검증된 분석 후보를 추가했습니다.'+(parsed.partial?' 입력이 중간에 잘려 있어 완전한 항목만 복구했습니다.':'')+'\n\n'+gfqAnalysisSummary({processed:1,batches:1,partial:0,failures:[],consolidation:gfqConsolidationSummary(consolidation),...stats}));
    }catch(e){alert('JSON을 가져오지 못했습니다: '+String(e.message||e));}
  }
  const GFQ_MONEY_STATES=['pending','receivable','received','paid','waived','ownership'];
  // v0.7.2: a guarantee that only pays if something happens (e.g. '중도 철수 시 기본급 50% 보장') is a floor, not extra money.
  // It is never added to a total, never recorded as a payment and never counted as money owed.
  const GFQ_CONDITIONAL=/(중도\s*(?:철수|포기|중단|하차|이탈)|철수\s*(?:시|할\s*경우|하더라도|하게\s*되면|하면)|실패\s*(?:시|하더라도|할\s*경우|하면|하게\s*되면)|미완료\s*시|(?:최소|최저)\s*(?:보장|지급))/u;
  const gfqIsCond=x=>!!x&&(x.financialStatus==='conditional'||x.certainty==='conditional'||x.conditional===true||GFQ_CONDITIONAL.test(String(x.name||'')));
  const gfqMoney=x=>(['asset','contract'].includes(x.category)&&GFQ_MONEY_STATES.includes(x.financialStatus));
  // Which existing ledger entries this money event could be. Pure; shared by the question and the write.
  function gfqLedgerMatch(w,x,bulk){
    const ledger=w.gfLedger||[];
    const key=String(x.transactionId||'').trim();
    // v0.3.8: a validated chain (earlier promise -> later payment) matches without asking.
    const chain=String(x.chainKey||x.id||'').trim();
    const chained=chain?ledger.find(t=>t.id===chain||(Array.isArray(t.chainKeys)&&t.chainKeys.includes(chain))):null;
    let matches=key?ledger.filter(t=>t.sourceKey===key&&t.unit===String(x.unit||'')&&
      (t.amount===x.amount||t.amount===null||x.amount===null)&&t.name===String(x.name||'')):[];
    // A ledger entry created from a quest reward is the same payment when amount and unit match exactly once.
    if(!matches.length&&typeof x.amount==='number')matches=ledger.filter(t=>t.origin==='quest-reward'&&t.amount===x.amount&&t.unit===String(x.unit||''));
    // Never auto-merge collisions or independently authored events.
    const prior=chained||(matches.length===1?matches[0]:null);
    // v0.3.14: ask only when an existing entry could be the same payment (same amount, or an amount still unknown).
    const plausible=(!chained&&!bulk)?ledger.filter(t=>(t.unit===String(x.unit||'')||!t.unit||!x.unit)&&(t.amount===x.amount||t.amount===null||x.amount===null||typeof x.amount!=='number')):[];
    return {key,chain,chained,matches,prior,plausible};
  }
  // v0.12.0: the "same payment?" question, asked before approval because in-page dialogs are async. null = nothing to ask.
  function gfqLedgerQuestion(w,x){
    const {chained,prior,plausible}=gfqLedgerMatch(w,x,false);
    if(chained||!plausible.length)return null;
    const options=plausible.map((t,i)=>(i+1)+': '+t.name+' · '+gfqAmount(t.amount,t.unit)+' · '+gfqLabel('money',t.state)+(t.history?.[0]?.source?' · '+t.history[0].source:'')).join('\n').slice(0,3500);
    return {text:'승인하려는 항목: '+String(x.name||'')+' · '+gfqAmount(x.amount,x.unit)+'\n\n이 돈이 아래 기존 거래와 같은 지급이면 그 번호를, 별개의 새 거래면 0을 입력해 주세요.\n(예: 지급 예정이던 보수가 입금된 장면이면 기존 번호)\n\n'+options,def:prior&&plausible.includes(prior)?String(plausible.indexOf(prior)+1):'0'};
  }
  // answer: the reply to gfqLedgerQuestion (needed when not bulk and there was a question).
  function gfqLedgerRecord(w,x,bulk=false,answer=null){
    w.gfLedger||=[];
    const {key,chain,chained,matches,plausible}=gfqLedgerMatch(w,x,bulk);
    let prior=chained||(matches.length===1?matches[0]:null);
    if(!chained&&!bulk&&plausible.length){
      if(answer===null)return false;
      const n=Number(answer);
      if(!Number.isSafeInteger(n)||n<0||n>plausible.length){alert('거래 번호를 확인해 주세요.');return false;}
      prior=n?plausible[n-1]:null;
    }else if(!chained&&!bulk){prior=null;}else if(!chained&&bulk&&matches.length!==1){prior=null;}
    const at=now(),state=x.financialStatus,evidence=String(x.evidence||''),amount=Number.isFinite(x.amount)?x.amount:null,unit=String(x.unit||'');
    if(prior){
      // A total can replace an unknown amount, but component amounts must not silently overwrite it.
      if(prior.history?.some(h=>h.evidence===evidence&&h.state===state))return prior;
      // Never move a payment backwards (e.g. received -> pending) because an earlier scene was approved later.
      const ro=GFQ_RANK[prior.state],rn=GFQ_RANK[state];
      const regress=prior.state!==state&&((ro!==undefined&&rn!==undefined&&rn<ro)||(prior.state==='paid'&&state==='pending'));
      const changedState=prior.state!==state&&!regress;
      prior.history||=[];
      prior.history.push({at,state,amount,evidence,source:x.source||'',...(x.date?{date:x.date}:{}),...(regress?{note:'이전 단계 근거'}:{})});
      if(!regress)prior.state=state;prior.updatedAt=at;
      if(chain){prior.chainKeys=Array.isArray(prior.chainKeys)?prior.chainKeys:[];if(chain!==prior.id&&!prior.chainKeys.includes(chain))prior.chainKeys.push(chain);}
      if(prior.amount===null&&amount!==null)prior.amount=amount;
      if(!prior.sourceKey&&key)prior.sourceKey=key;
      if(!prior.timing)prior.timing=gfqTiming(x);
      record(w,'거래 상태 갱신: '+prior.name+' '+(changedState?'→ '+gfqLabel('money',state):regress?'(이전 단계 근거 추가)':'(추가 근거)')+' · '+evidence);
      return prior;
    }else{
      const tx={id:uid(),sourceKey:key,name:String(x.name||''),state,amount,unit,
        componentOf:'',timing:gfqTiming(x),chainKeys:chain?[chain]:[],origin:String(x.origin||''),createdAt:at,updatedAt:at,history:[{at,state,amount,evidence,source:x.source||'',...(x.date?{date:x.date}:{})}]};
      w.gfLedger.push(tx);record(w,'거래 생성: '+tx.name+' ['+gfqLabel('money',state)+'] · '+evidence);
      return tx;
    }
  }
  // v0.3.8: items promised for later are kept as '수령 예정' and become owned when a linked receipt is approved.
  function gfqGearStage(item,x,stage){
    if(!item||!gfqIsEquipment(item))return;
    item.gearHistory=Array.isArray(item.gearHistory)?item.gearHistory:[];
    const text=String(x.equipEvidence||x.evidence||'').trim().slice(0,500);
    if(!text||item.gearHistory.some(h=>h.stage===stage&&h.evidence===text))return;
    item.gearHistory.push({at:now(),stage,evidence:text,source:String(x.source||'').slice(0,120)});
    item.gearHistory=item.gearHistory.slice(-30);
    item.gearStage=stage;
  }
  function gfqGearFromStory(x){
    const t=String(x.evidence||'');
    if(/제작 완료|완성됐|완성되었|완성했습니다|제작을 마쳤/.test(t))return '제작 완료';
    if(/옵션 확정|성능 확정|옵션을 확정/.test(t))return '옵션 확정';
    return '제작 계약·예정';
  }
  function gfqApplyEquipmentCandidate(w,x,item){
    if(!item)return;
    const kind=['무기','방어구','장신구','도구'].includes(x.equipType)?x.equipType:'';
    if(kind&&!gfqIsEquipment(item))item.equipType=kind;
    if(!gfqIsEquipment(item))return;
    if(!item.equipSlot&&x.equipSlot)item.equipSlot=x.equipSlot;
    if(x.equipOptions&&x.equipEvidence){
      const prior=String(item.equipOptions||'').trim(),incoming=String(x.equipOptions).trim();
      // Accumulate evidence-backed options; never erase manually entered data.
      if(incoming&&!prior.includes(incoming)){
        const change=/(교체|대체|변경|강화 후|개조 후|상향)/.test(x.equipEvidence||'');
        if(change&&prior){item.gearOptionVersions||=[];item.gearOptionVersions.push({at:now(),before:prior,after:incoming,evidence:x.equipEvidence});item.gearOptionVersions=item.gearOptionVersions.slice(-25);item.equipOptions=incoming;}
        else item.equipOptions=(prior?prior+'\n':'')+incoming;
      }
      item.equipOptions=item.equipOptions.slice(0,1600);
      item.equipEvidence=x.equipEvidence;
      gfqGearStage(item,x,'옵션 확정');
    }
  }
  // v0.12.0: owned item that may be the same thing under a slightly different name ('여분의 데뷔 응원 키트' vs
  // '데뷔 응원 키트'). Pure. Spaces and a few leading words are ignored; one name containing the other counts.
  const GFQ_ITEM_PREFIX=/^(?:여분의?|추가(?:로|의)?|새로운|새|수정된|예비|또\s*다른|다른|두\s*번째)\s*/u;
  function gfqItemKey(name){
    let t=String(name||'').replace(/\s+/g,' ').trim();
    for(let k=0;k<3;k++){const u=t.replace(GFQ_ITEM_PREFIX,'');if(u===t)break;t=u;}
    return t.replace(/[\s·()[\]'"“”‘’]/g,'').toLowerCase();
  }
  function gfqSimilarItem(w,name){
    const k=gfqItemKey(name);if(k.length<2)return null;
    const own=(w.items||[]).filter(i=>i.state!=='pending'&&i.kind!=='voucher'&&i.qty>0);
    return own.find(i=>gfqItemKey(i.name)===k)||own.find(i=>{const o=gfqItemKey(i.name);return Math.min(o.length,k.length)>=3&&(o.includes(k)||k.includes(o));})||null;
  }
  // opt.assumeOne (popup [반영] only): an obtained item with no count in the story is taken as one.
  // opt.sameItem: id of the owned item it really is; opt.newItem: add it even though a similar one is owned.
  function gfqApplyItem(w,x,opt){opt=opt||{};
    const chain=String(x.chainKey||'').trim();
    let waiting=chain?(w.items||[]).find(i=>i.state==='pending'&&(i.chainKey===chain||i.id===chain)):null;
    // v0.6.2: a receipt line that names a waiting item (e.g. a quest reward) flips that entry even without a link.
    if(!waiting){const nk=t=>gfqNormMap(String(t||'').replace(/\s+/g,'')).out,mine=nk(x.name);
      const cands=mine.length>=4?(w.items||[]).filter(i=>i.state==='pending'&&(()=>{const o=nk(i.name);return o.length>=4&&(o.includes(mine)||mine.includes(o));})()):[];
      if(cands.length===1)waiting=cands[0];}
    const qtyOk=typeof x.amount==='number'&&Number.isSafeInteger(x.amount)&&x.amount>0&&!gfqIsMoneyUnit(x.unit);
    const receiving=x.financialStatus!=='pending'&&['confirmed','completed'].includes(x.status);
    if(waiting&&receiving){
      delete waiting.state;waiting.receivedAt=now();if(qtyOk)waiting.qty=x.amount;
      gfqApplyEquipmentCandidate(w,x,waiting);
      gfqGearStage(waiting,x,'수령 완료');
      record(w,'물품 수령 확인: '+waiting.name+' · '+x.evidence);return true;
    }
    if(!receiving){
      if(waiting){gfqApplyEquipmentCandidate(w,x,waiting);gfqGearStage(waiting,x,gfqGearFromStory(x));record(w,'수령 예정 물품 추가 근거: '+waiting.name+' · '+x.evidence);return true;}
      const value=typeof x.value==='number'?x.value:(gfqIsMoneyUnit(x.unit)&&typeof x.amount==='number'?x.amount:null);
      w.items.push({id:uid(),name:String(x.name||'').slice(0,100),qty:qtyOk?x.amount:1,state:'pending',chainKey:chain||x.id,timing:gfqTiming(x),
        ...(value!==null?{value,valueUnit:x.valueUnit||(gfqIsMoneyUnit(x.unit)?gfqUnit(x.unit):'')}:{})});
      gfqApplyEquipmentCandidate(w,x,w.items[w.items.length-1]);
      gfqGearStage(w.items[w.items.length-1],x,gfqGearFromStory(x));
      record(w,'수령 예정 물품 등록: '+x.name+(gfqTiming(x)?' · '+gfqTimingText(gfqTiming(x)):''));return true;
    }
    // Never add an owned item from a mention without a confirmed quantity (unless the player confirmed it in the popup).
    // v0.12.0: the player said this is an item already owned: nothing is added, the mention is only recorded.
    if(opt.sameItem){const t=(w.items||[]).find(i=>i.id===opt.sameItem);if(!t)return false;record(w,'이미 가진 물건 재확인: '+t.name+' · '+x.evidence);return true;}
    const n=qtyOk?x.amount:opt.assumeOne&&!gfqIsMoneyUnit(x.unit)?1:0;
    if(!(x.status==='confirmed'||opt.assumeOne)||!n)return false;
    // An owned item with the same or a similar name may be the same thing mentioned again: ask instead of adding.
    if(!opt.newItem&&gfqSimilarItem(w,x.name))return false;
    const item=w.items.find(i=>i.name===x.name&&i.state!=='pending'&&i.kind!=='voucher');if(item)item.qty+=n;else w.items.push({id:uid(),name:x.name,qty:n});
    gfqApplyEquipmentCandidate(w,x,item||w.items[w.items.length-1]);
    gfqGearStage(item||w.items[w.items.length-1],x,'수령 완료');
    return true;
  }
  // v0.3.11: benefits. One-off discounts become vouchers in the inventory; lasting ones are an asset field.
  function gfqApplyBenefit(w,x){
    if(x.benefitMode==='record'||(!x.benefitMode&&x.benefitConsumed)){record(w,'혜택 적용 확인: '+x.name+' · '+x.evidence);return 'consumed';}
    if(x.benefitMode==='permanent'||(!x.benefitMode&&x.benefitPermanent)){
      const name='보유 혜택 · '+x.name,f=w.fields.find(v=>v.name===name);
      if(!f)w.fields.push({id:uid(),name,value:'적용 중',unit:''});
      record(w,'상시 혜택 등록: '+x.name+' · '+x.evidence);return 'permanent';
    }
    const uses=Math.max(1,Math.min(99,Number(x.benefitUses)||1));
    const label=/권$/.test(x.name)?x.name:x.name+'권';
    const chain=x.chainKey||x.id;
    const v=w.items.find(i=>i.kind==='voucher'&&(i.chainKey===chain||i.name===label));
    if(v&&v.chainKey===chain){record(w,'혜택 추가 근거: '+label+' · '+x.evidence);return 'voucher';}
    if(v)v.qty+=uses;else w.items.push({id:uid(),name:label,qty:uses,kind:'voucher',chainKey:chain,detail:typeof x.amount==='number'?gfqAmount(x.amount,x.unit):''});
    record(w,'이용권 획득: '+label+' ×'+uses+' · '+x.evidence);return 'voucher';
  }
  // v0.3.11: a purchase records the expense (ledger) and what was bought (inventory).
  function gfqApplyPurchase(w,x){
    for(const it of x.purchasedItems){
      if(it.received){
        const owned=w.items.find(i=>i.name===it.name&&i.state!=='pending'&&i.kind!=='voucher');
        if(owned)owned.qty+=it.qty;else w.items.push({id:uid(),name:it.name,qty:it.qty});
        record(w,'구매 물품 추가: '+it.name+' ×'+it.qty+' ('+x.name+')');
      }else{
        w.items.push({id:uid(),name:it.name,qty:it.qty,state:'pending',chainKey:(x.chainKey||x.id)+':'+it.name,timing:gfqTiming(x)});
        record(w,'구매 물품 수령 예정: '+it.name+' ×'+it.qty+' ('+x.name+')');
      }
    }
  }
  // v0.3.11: a sale records the proceeds (ledger) and removes what was sold from the inventory.
  function gfqApplySale(w,x){
    for(const it of x.soldItems){
      const owned=w.items.find(i=>i.name===it.name&&i.state!=='pending'&&i.kind!=='voucher')||w.items.find(i=>i.state!=='pending'&&i.kind!=='voucher'&&(i.name.includes(it.name)||it.name.includes(i.name)));
      if(!owned){record(w,'판매 물품을 소지품에서 찾지 못했습니다: '+it.name+' ×'+it.qty+' ('+x.name+') · 필요하면 직접 수정해 주세요.');continue;}
      const before=owned.qty;owned.qty=Math.max(0,owned.qty-it.qty);
      record(w,'판매 물품 차감: '+owned.name+' '+before+' → '+owned.qty+' ('+x.name+')');
    }
  }
  // v0.3.11: ledger totals (원 only). Derived from approved records; never edits fields or game currency.
  function gfqLedgerSummary(w,unit){
    // v0.7.3: totals in one currency (the main one by default); other currencies are summed separately in byUnit.
    const main=unit||gfqMainUnit(w),sum={unit:main,received:0,paid:0,receivable:0,pending:0,unknown:0,other:0,byUnit:{}};
    for(const t of (w.gfLedger||[])){
      const u=gfqUnit(t.unit);
      if(u!==main){sum.other++;if(gfqIsMoneyUnit(u)&&typeof t.amount==='number'&&['received','paid','receivable','pending'].includes(t.state)&&!(['pending','receivable'].includes(t.state)&&gfqIsCond(t))){const b=sum.byUnit[u]||(sum.byUnit[u]={received:0,paid:0,receivable:0,pending:0});b[t.state]+=t.amount;}continue;}
      if(['pending','receivable'].includes(t.state)&&gfqIsCond(t)){sum.other++;continue;} // v0.7.2: a conditional floor is not money owed
      if(typeof t.amount!=='number'){if(['received','paid','receivable','pending'].includes(t.state))sum.unknown++;continue;}
      if(t.state in sum)sum[t.state]+=t.amount;
    }
    return sum;
  }
  // v0.3.8: quest money rewards point at ledger entries so their paid/unpaid state is shown from one place.
  function gfqRelinkQuestRewards(w){
    const ledger=w.gfLedger||[];let linked=0;
    for(const q of (w.quests||[]))for(const r of (Array.isArray(q.rewardDetails)?q.rewardDetails:[])){
      if(r.kind!=='money'||gfqIsCond(r)||(r.txId&&ledger.some(t=>t.id===r.txId)))continue;
      const chained=r.chainKey&&ledger.find(t=>t.id===r.chainKey||(Array.isArray(t.chainKeys)&&t.chainKeys.includes(r.chainKey)));
      if(chained){r.txId=chained.id;linked++;continue;}
      if(typeof r.amount!=='number')continue;
      const hits=ledger.filter(t=>t.amount===r.amount&&t.unit===String(r.unit||''));
      if(hits.length===1){r.txId=hits[0].id;linked++;}
    }
    return linked;
  }
  // v0.6.2: an item promised as a quest reward appears in the inventory as 'to receive' (or owned when the
  // reward line already confirms receipt). Linked by chainKey so a later receipt line flips the same entry.
  function gfqQuestRewardItems(w,q){
    let added=0;
    for(const r of (Array.isArray(q.rewardDetails)?q.rewardDetails:[])){
      if(r.kind!=='item'||!String(r.name||'').trim()||r.certainty==='suggested'||r.certainty==='uncertain')continue;
      const linked=r.chainKey&&w.items.find(i=>i.chainKey===r.chainKey||i.id===r.chainKey);if(linked)continue;
      const same=w.items.find(i=>i.name===r.name&&i.kind!=='voucher');if(same){r.chainKey=same.chainKey||same.id;continue;}
      r.chainKey=r.chainKey||uid();
      if(r.certainty==='received'){w.items.push({id:uid(),name:String(r.name).slice(0,100),qty:1,chainKey:r.chainKey,receivedAt:now()});record(w,'퀘스트 보상 수령: '+r.name+' · '+q.title);}
      else{w.items.push({id:uid(),name:String(r.name).slice(0,100),qty:1,state:'pending',chainKey:r.chainKey});record(w,'퀘스트 보상 수령 예정 등록: '+r.name+' · '+q.title);}
      added++;
    }
    return added;
  }
  function gfqRewardToLedger(w,q,index){
    const r=q.rewardDetails?.[index];
    if(gfqIsCond(r))return null;
    if(!r||r.kind!=='money'||typeof r.amount!=='number'||r.txId)return null;
    const state=r.certainty==='received'?'received':r.certainty==='confirmed'?'receivable':'pending';
    const tx=gfqLedgerRecord(w,{id:r.chainKey||uid(),name:r.name,financialStatus:state,amount:r.amount,unit:String(r.unit||''),evidence:r.evidence||(Array.isArray(q.sourceEvidence)?q.sourceEvidence[0]:q.sourceEvidence)||q.detail||'',source:q.source||'퀘스트 보상',origin:'quest-reward'},true);
    if(tx)r.txId=tx.id;
    return tx;
  }
  function gfqBarcode(seed){
    // decorative only: bar widths come from the world key so each world keeps the same code
    let h=2166136261;for(const ch of String(seed||'gf'))h=Math.imul(h^ch.charCodeAt(0),16777619)>>>0;
    let out='';for(let i=0;i<30;i++){h=Math.imul(h^(h>>>13),1597334677)>>>0;out+='<i style="flex:'+(1+h%4)+'"></i>'+(h&8?'<i class="gap"></i>':'');}
    return '<div class="gfq-barcode" aria-hidden="true">'+out+'</div>';
  }
  function gfqSerial(seed){let h=7;for(const ch of String(seed||''))h=(h*31+ch.charCodeAt(0))%100000;return String(h).padStart(5,'0');}
  const gfqIcon=k=>'<svg viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="square">'+({
    quests:'<path d="M4 4h12v13H4z"/><path d="M7 8h6M7 11h6M7 14h3"/>',
    profile:'<circle cx="10" cy="7" r="3.2"/><path d="M3.5 17c.8-3.4 3.3-5 6.5-5s5.7 1.6 6.5 5"/>',
    cast:'<circle cx="7.5" cy="7.5" r="2.6"/><circle cx="13.8" cy="6.6" r="2.3"/><path d="M2.8 16.5c.6-3 2.4-4.6 4.7-4.6s4.1 1.6 4.7 4.6M11.6 11.2c.7-.5 1.4-.7 2.2-.7 2 0 3.5 1.4 4 4.3"/>',
    calendar:'<rect x="3.5" y="4.5" width="13" height="12"/><path d="M3.5 8.5h13M7 3v3M13 3v3M6.5 11.5h2M11 11.5h2M6.5 14h2"/>',
    places:'<path d="M10 18s-5.5-5.6-5.5-9.5a5.5 5.5 0 0 1 11 0C15.5 12.4 10 18 10 18z"/><circle cx="10" cy="8.5" r="1.8"/>',
    history:'<circle cx="10" cy="10" r="7"/><path d="M10 6v4.5l3 1.8"/>',
    settings:'<path d="M3 6h9M15 6h2M3 14h2M8 14h9"/><path d="M12 4v4M5 12v4"/>'
  }[k]||'')+'</svg>';
  function gfqDateBlock(w){
    const c=gfqCurrentDate(w);
    const k=gfqCurrentClock(w),wd=c&&!w.gfEra?gfqWeekday(c.date):'',est=!c||/추정/.test(c.basis);
    return '<div class="gfq-tk-date"><span class="gfq-k">세계관 날짜</span><b class="gfq-num">'+esc(c?gfqDateText(w,c.date):'—')+'</b>'+
      (c?'<span class="gfq-tk-clock gfq-num">'+esc(k?gfqClockText(k):'시각 미정')+'</span>':'')+
      '<small class="gfq-sub">'+(c?(wd?esc(wd)+'요일 · ':'')+esc(c.basis)+(c.source?' · '+esc(c.source):'')+(c.reason?' · '+esc(c.reason):''):'원문에 날짜가 아직 없습니다. 세계관에 맞게 정하거나 직접 입력할 수 있습니다')+'</small>'+
      '<div class="gfq-row">'+btn('날짜·시각 입력','date-set')+btn('시간 경과','time-next',c?'':'disabled')+btn('하루 경과','date-next',c?'':'disabled')+(est?btn(c?'날짜 다시 정하기':'세계관에 맞게 날짜 정하기','date-auto'):'')+'</div></div>';
  }
  // Protagonist as an admission ticket: photo stub, details, perforated barcode stub.
  // v0.6.2: cash on hand = the starting amount the player entered + confirmed deposits − payments (원 only).
  // Promised or pending money is never counted.
  function gfqCash(w){
    const sm=gfqLedgerSummary(w),base=typeof w.gfCashBase?.amount==='number'&&(!w.gfCashBase.unit||w.gfCashBase.unit===sm.unit)?w.gfCashBase.amount:null;
    return {unit:sm.unit,known:base!==null,base,net:sm.received-sm.paid,balance:base===null?null:base+sm.received-sm.paid,owed:sm.receivable+sm.pending};
  }
  function gfqTicket(w){
    const name=String(w.protagonist||w.gfHero?.name||'').trim(),world=w.gfDisplayName||data.world||'';
    const img=gfqImgSrc(gfqHeroAvatar(w));
    const rep=w.fields.find(f=>f.name==='명성'),repN=rep&&/^\d+$/.test(String(rep.value).trim())?Number(rep.value):null;
    const dots=repN===null?'':'<span class="gfq-rings" role="img" aria-label="명성 '+repN+'점">'+Array.from({length:Math.max(5,Math.min(20,Math.ceil(repN/5)*5))},(_,i)=>'<i'+(i<repN?' class="on"':'')+'></i>').join('')+'</span>';
    const creds=w.fields.filter(f=>/^보유 자격 · /.test(f.name));
    const open=w.quests.filter(q=>!q.claimed).length;
    const place=w.gfPlaceNow&&w.gfPlaces?.[w.gfPlaceNow.key];
    return '<section class="gfq-ticket" aria-label="주인공">'+
      '<div class="gfq-tk-photo"><div class="gfq-photo">'+(img?'<img src="'+esc(img)+'" alt="'+esc(name||'주인공')+' 아바타" loading="lazy">':'<span aria-hidden="true">'+esc(name?[...name][0]:'?')+'</span>')+'</div>'+
        '</div>'+
      '<div class="gfq-tk-main">'+
        '<div class="gfq-tk-top"><span>'+esc(world)+'</span><span class="gfq-num">No. '+gfqSerial(data.world)+'</span></div>'+
        '<h3 class="gfq-tk-name">'+(name?esc(name):'<span class="gfq-sub">이름 미설정</span>')+'</h3>'+
        (name?'':'<p class="gfq-sub">게임 상태를 받으면 주인공 이름을 채웁니다. 설정 탭에서 직접 입력할 수도 있습니다.</p>')+
        '<dl class="gfq-tk-rows">'+
          '<dt>소지금</dt><dd class="gfq-cash">'+(()=>{const c=gfqCash(w);return c.known?'<b class="gfq-num">'+esc(gfqAmount(c.balance,c.unit))+'</b><small>시작 '+esc(gfqAmount(c.base,c.unit))+' + 입금 확인 − 지출'+(c.owed?' · 받을 돈 '+esc(gfqAmount(c.owed,c.unit))+' 별도':'')+'</small><button class="gfq-link" data-action="cash-base">시작 금액 고치기</button>':'<span class="gfq-sub">확인된 순변동 '+esc((c.net>=0?'+':'')+gfqAmount(c.net,c.unit))+'</span><button class="gfq-link" data-action="cash-base">시작 소지금 입력</button>';})()+'</dd>'+
          '<dt>명성</dt><dd>'+(repN===null?'<span class="gfq-sub">'+(rep?esc(rep.value+(rep.unit||'')):'아직 없음')+'</span>':dots+'<b class="gfq-num">'+repN+'</b><small>점</small>')+'</dd>'+
          '<dt>자격</dt><dd>'+(creds.map(f=>'<span class="gfq-stamp">'+esc(f.name.replace(/^보유 자격 · /,''))+(f.value?'<small>'+esc(String(f.value).replace(/^취득 · /,''))+'</small>':'')+'</span>').join('')||'<span class="gfq-sub">아직 없음</span>')+'</dd>'+
          '<dt>의뢰</dt><dd><b class="gfq-num">'+open+'</b><small> 진행 중 · 전체 '+w.quests.length+'</small></dd>'+
          '<dt>위치</dt><dd>'+(place?'<button class="gfq-link" data-action="select-place" data-id="'+esc(w.gfPlaceNow.key)+'">'+esc(place.name)+'</button>':'<span class="gfq-sub">확인 전</span>')+'</dd>'+
        '</dl>'+gfqDateBlock(w)+
      '</div>'+
      '<div class="gfq-tk-stub">'+gfqBarcode(data.world)+'<span class="gfq-num">'+esc(String(w.gfRunId||data.world||'').slice(-8).toUpperCase())+'</span></div>'+
    '</section>';
  }
  let itemFilter='전체',selectedItem='',selectedPlace='',placePage='';
  function gfqItemGlyph(i){
    const ic=gfqThing(i.name,i.kind==='voucher'?'voucher':'item');
    if(i.state==='pending')return '<span class="gfq-glyph">'+ic+'<em class="gfq-badge q" aria-label="수령 예정">?</em></span>';
    if(i.kind==='voucher')return '<span class="gfq-glyph">'+ic+'<em class="gfq-badge num">'+(i.qty>0?i.qty+'회':'끝')+'</em></span>';
    return '<span class="gfq-glyph">'+ic+'</span>';
  }

  function gfqLinkAudit(w){
    const issues=[];
    for(const q of w.quests||[])for(const r of q.rewardDetails||[]){
      if(r.txId&&!(w.gfLedger||[]).some(t=>t.id===r.txId))issues.push(q.title+' / '+r.name+': 연결된 거래를 찾지 못했습니다.');
      if(r.kind==='item'&&r.chainKey){
        const hits=(w.items||[]).filter(i=>i.chainKey===r.chainKey||i.id===r.chainKey);
        if(hits.length>1)issues.push(q.title+' / '+r.name+': 같은 연결 키에 물품이 여러 개 있습니다.');
      }
    }
    for(const t of w.gfLedger||[])if(t.sourceKey&&w.gfLedger.filter(x=>x.sourceKey===t.sourceKey&&x.id!==t.id&&x.unit===t.unit&&x.amount===t.amount).length)
      issues.push('거래 '+t.name+': 동일 계약 키·금액 기록이 여러 개입니다.');
    return [...new Set(issues)].slice(0,35);
  }
  function gfqLinkAuditHtml(w){
    const issues=gfqLinkAudit(w);
    return '<details class="gfq-card"><summary><b>퀘스트·장비·거래 연결 검증 ('+issues.length+'건)</b></summary>'+
      (issues.length?issues.map(t=>'<p class="gfq-muted">'+esc(t)+'</p>').join(''):'<p class="gfq-muted">검사 가능한 연결 기록에서 문제가 발견되지 않았습니다. 동일 사건임을 완전히 보증하는 것은 아닙니다.</p>')+
      '</details>';
  }
  function gfqChangeCompareHtml(w){
    const history=(w.history||[]).filter(h=>/장비|소지품|물품|거래|자산|명성|보상/.test(h.text||'')).slice(0,30);
    return '<details class="gfq-card"><summary><b>자산·소지품 변경 기록 ('+history.length+'개 표시)</b></summary>'+
      (history.map(h=>'<p class="gfq-muted">'+esc(h.at)+' · '+esc(h.text)+'</p>').join('')||'<p class="gfq-muted">기록된 변경이 없습니다.</p>')+
      '<p class="gfq-muted">이 목록은 저장된 변경 이력이며, 모든 필드의 이전값 비교나 개별 복구를 대신하지 않습니다.</p></details>';
  }
  function gfqDueAuditHtml(w){
    const today=gfqCurrentDate(w)?.date||'';
    const list=today?gfqSchedule(w).filter(e=>e.open&&e.date<=today).slice(0,30):[];
    return '<details class="gfq-card"><summary><b>세계관 날짜 기준 확인 필요 ('+list.length+'건)</b></summary>'+
      (today?'<p class="gfq-muted">현재 세계관 날짜: '+esc(today)+' · 날짜 도달은 지급·수령 완료의 근거가 아닙니다.</p>':'<p class="gfq-muted">세계관 날짜가 확인되지 않았습니다.</p>')+
      (list.map(e=>'<p>'+esc(e.date)+' · '+esc(e.text)+' — 미이행 여부 확인이 필요합니다.</p>').join('')||'<p class="gfq-muted">현재 확인할 기한이 없습니다.</p>')+'</details>';
  }
  function gfqRewardInbox(w){
    const rows=[];
    for(const q of w.quests||[])for(const r of gfqMergeMoneyRewards((q.rewardDetails||[]).map((r,i)=>r&&({...r,_i:i})).filter(Boolean))){
      if(r.certainty==='suggested'||gfqIsCond(r))continue;const i=r._i;
      const state=r.kind==='reputation'&&q.reputationAwarded?{text:'반영됨',tone:'ok'}:gfqRewardState(w,r);
      rows.push({q,r,i,state});
    }
    const pending=rows.filter(x=>x.state.tone!=='ok');
    const renderRow=x=>'<div class="gfq-card"><b>'+esc(x.q.title)+'</b><p>'+esc(x.r.name)+(typeof x.r.amount==='number'?' · '+esc(gfqAmount(x.r.amount,x.r.unit)):'')+'</p><span class="gfq-muted">'+esc(x.state.text)+'</span> '+btn('퀘스트 보기','open-quest','data-id="'+esc(x.q.id)+'"')+'</div>';
    return '<details class="gfq-card"><summary><b>보상 수령함 · 확인 필요 '+pending.length+'건</b></summary><p class="gfq-muted">퀘스트 완료와 보상 수령은 별개입니다. 실제 지급·소유가 확인된 경우에만 수령 완료로 표시합니다.</p>'+
      '<details open><summary>수령 대기·확인 필요 ('+pending.length+')</summary>'+pending.map(renderRow).join('')+'</details>'+
      '<details><summary>수령·적용 기록 ('+(rows.length-pending.length)+')</summary>'+rows.filter(x=>x.state.tone==='ok').map(renderRow).join('')+'</details></details>';
  }
  const GFQ_EQUIP_TYPES=['일반 물품','소재','소모품','무기','방어구','장신구','도구'];
  const gfqEquipType=i=>GFQ_EQUIP_TYPES.includes(i?.equipType)?i.equipType:((i?.equipSlot||i?.equipped||i?.equipOptions)?'방어구':'일반 물품');
  const gfqIsEquipment=i=>['무기','방어구','장신구','도구'].includes(gfqEquipType(i));
  function gfqEquipPanel(w,i){
    if(i.kind==='voucher'||!gfqIsEquipment(i))return '';
    const equipped=i.equipped===true&&i.state!=='pending';
    return '<section class="gfq-card"><h5>장비 옵션·착용 정보</h5>'+
      '<p class="gfq-muted">장착 부위: '+esc(i.equipSlot||'미지정')+'</p>'+
      '<p>옵션: '+esc(i.equipOptions||'미기록')+'</p>'+
      '<p><b>'+(equipped?'현재 착용 중':'미착용')+'</b> · 제작·수령 상태: '+esc(i.gearStage||(i.state==='pending'?'수령 예정':'보유'))+'</p>'+ 
      ((i.gearOptionVersions||[]).length?'<details><summary>강화·옵션 변경 비교 ('+i.gearOptionVersions.length+')</summary>'+i.gearOptionVersions.slice(-10).map(v=>'<p class="gfq-muted">이전: '+esc(v.before)+' → 변경: '+esc(v.after)+'<br>근거: '+esc(v.evidence)+'</p>').join('')+'</details>':'')+
      ((i.gearHistory||[]).length?'<details><summary>제작·옵션·수령 이력 ('+i.gearHistory.length+')</summary>'+i.gearHistory.slice(-15).map(h=>'<p class="gfq-muted">'+esc(h.stage)+' · '+esc(h.evidence)+'</p>').join('')+'</details>':'')+
      btn('장비 정보 수정','equip-edit','data-id="'+esc(i.id)+'"')+
      (i.state!=='pending'?btn(equipped?'착용 해제':'착용하기','equip-toggle','data-id="'+esc(i.id)+'"'):'<p class="gfq-muted">수령 예정 물품은 착용할 수 없습니다.</p>')+'</section>';
  }
  function gfqItemsHtml(w){
    const groups={'전체':()=>true,'보유':i=>i.state!=='pending'&&i.kind!=='voucher','장비':i=>gfqIsEquipment(i),'옵션 등록':i=>gfqIsEquipment(i)&&!!i.equipOptions,'착용 중':i=>i.equipped===true&&i.state!=='pending','수령 예정':i=>i.state==='pending','이용권':i=>i.kind==='voucher'};
    if(!groups[itemFilter])itemFilter='전체';
    const list=w.items.filter(groups[itemFilter]);
    const sel=list.find(i=>i.id===selectedItem)||list[0]||null;
    const tabs='<div class="gfq-seg" role="group" aria-label="소지품 분류">'+Object.keys(groups).map(k=>'<button data-action="item-filter" data-id="'+k+'" aria-pressed="'+(k===itemFilter)+'">'+k+' <small class="gfq-num">'+w.items.filter(groups[k]).length+'</small></button>').join('')+'</div>';
    const grid=list.map(i=>'<button class="gfq-slot'+(i.state==='pending'?' pending':'')+(i.kind==='voucher'?' ticket':'')+(i.kind==='voucher'&&!(i.qty>0)?' used':'')+(sel&&sel.id===i.id?' on':'')+'" data-action="select-item" data-id="'+esc(i.id)+'" aria-pressed="'+(!!(sel&&sel.id===i.id))+'">'+gfqItemGlyph(i)+'<span class="gfq-slot-name">'+esc(i.name)+'</span>'+(i.kind!=='voucher'&&i.state!=='pending'?'<span class="gfq-slot-qty gfq-num">×'+esc(i.qty)+'</span>':'')+'</button>').join('');
    let detail='<div class="gfq-dossier empty"><p class="gfq-sub">물품을 고르면 여기에 자세한 내용이 나옵니다.</p></div>';
    if(sel){
      const facts=[];
      facts.push(sel.state==='pending'?'아직 받지 않은 물품입니다. 스토리 반영에서 보유품으로 치지 않습니다.':sel.kind==='voucher'?(sel.qty>0?'남은 횟수 '+sel.qty+'회':'모두 사용했습니다.'):'보유 수량 '+sel.qty+'개');
      if(sel.timing)facts.push('수령 시점: '+gfqTimingText(sel.timing)+(gfqResolveTiming(w,sel.timing)?' → '+gfqResolveTiming(w,sel.timing):''));
      if(sel.value)facts.push('가치: '+gfqAmount(sel.value,sel.valueUnit||gfqMainUnit(w)));
      if(sel.detail)facts.push(sel.detail);
      const acts=sel.state==='pending'?btn('수령 확인','receive-item',`data-id="${esc(sel.id)}" class="primary"`):sel.kind==='voucher'?btn('사용','use-voucher',`data-id="${esc(sel.id)}" class="primary" ${sel.qty>0?'':'disabled'}`):btn('사용','item-use',`data-id="${esc(sel.id)}" class="primary"`)+btn('수정','edit-item',`data-id="${esc(sel.id)}"`);
      detail='<article class="gfq-dossier"><div class="gfq-hd"><span class="gfq-pin" aria-hidden="true"></span><h4>'+esc(sel.name)+'</h4><span class="gfq-no gfq-num">No.<br>'+gfqSerial(sel.id)+'</span></div>'+
        '<div class="gfq-plate">'+gfqItemGlyph(sel)+'<span class="gfq-plate-tag">'+(sel.state==='pending'?'수령 예정':sel.kind==='voucher'?'이용권':'보유')+'</span></div>'+
        '<h5>요약</h5><ul class="gfq-facts">'+facts.map(f=>'<li>'+esc(f)+'</li>').join('')+'</ul>'+
        (sel.evidence||sel.source?'<p class="gfq-quote"><mark>'+esc(String(sel.evidence||'').slice(0,40))+'</mark>'+esc(String(sel.evidence||'').slice(40,200))+(sel.source?' <small>'+esc(sel.source)+'</small>':'')+'</p>':'')+
        '<div class="gfq-row">'+acts+btn('삭제','delete-item',`data-id="${esc(sel.id)}"`)+'</div>'+gfqEquipPanel(w,sel)+(sel.kind!=='voucher'?btn('물품 종류 지정','equip-type','data-id="'+esc(sel.id)+'"'):'')+'</article>';
    }
    const worn=w.items.filter(i=>i.equipped===true&&i.state!=='pending'&&gfqIsEquipment(i));
    const gearCatalog='<details class="gfq-card"><summary><b>장비 도감 ('+w.items.filter(gfqIsEquipment).length+'개)</b></summary>'+w.items.filter(gfqIsEquipment).map(i=>'<p><button class="gfq-link" data-action="select-item" data-id="'+esc(i.id)+'">'+esc(i.name)+'</button> · '+esc(gfqEquipType(i))+' · '+esc(i.equipOptions||'옵션 미기록')+'</p>').join('')+'</details>';
    const wornInfo='<details class="gfq-card" open><summary><b>현재 착용 장비 ('+worn.length+'개)</b></summary>'+(worn.map(i=>'<p><b>'+esc(i.name)+'</b> · '+esc(i.equipSlot||'부위 미지정')+'<br><span class="gfq-muted">'+esc(i.equipOptions||'옵션 미기록')+'</span></p>').join('')||'<p class="gfq-muted">착용 중인 장비가 없습니다.</p>')+'</details>';
    return '<section class="gfq-items">'+wornInfo+gearCatalog+'<div class="gfq-items-head"><h3>소지품</h3>'+tabs+btn('＋ 소지품','add-item')+'</div>'+
      (w.items.length?'<div class="gfq-items-body"><div class="gfq-slots">'+(grid||'<p class="gfq-sub">이 분류에는 물품이 없습니다.</p>')+'</div>'+detail+'</div>':'<div class="gfq-empty"><strong>소지품이 비어 있습니다</strong><span class="gfq-sub">스토리에서 얻은 물품을 직접 추가하거나 AI 분석으로 채울 수 있습니다.</span></div>')+'</section>';
  }
  // Money as a receipt: one line per transaction, totals in the black band.
  function gfqReceiptBody(w,t){
    return '<div class="gfq-rc-meta">'+esc(gfqLabel('money',t.state))+(t.timing?' · 지급 시점 '+esc(gfqTimingText(t.timing))+(gfqResolveTiming(w,t.timing)?' → '+esc(gfqResolveTiming(w,t.timing)):''):'')+'</div>'+
      (t.history||[]).map(h=>'<p class="gfq-sub">'+(h.date?'['+esc(h.date)+'] ':'')+esc(gfqLabel('money',h.state))+' · '+esc(h.evidence)+'</p>').join('')+
      '<div class="gfq-row"><button data-action="ledger-update" data-id="'+esc(t.id)+'">상태 수동 갱신</button><button data-action="ledger-edit" data-id="'+esc(t.id)+'">이름·금액 고치기</button><small class="gfq-sub">거래 ID '+esc(t.id)+'</small></div>';
  }
  // v0.12.0: Marinara converted its gallery from png/jpg to webp (same file name), so stored portrait and place
  // addresses can point at files that no longer exist. A gallery image that fails to load is tried once as .webp;
  // when that works the stored address is updated. 'error' does not bubble, so listen in the capture phase.
  function gfqFixArt(from,to){
    const w=current();if(!w)return;let n=0;const fix=(o,k)=>{if(o&&o[k]===from){o[k]=to;n++;}};
    for(const c of Object.values(w.gfCast||{})){fix(c,'art');fix(c,'base');for(const o of c.outfits||[])fix(o,'url');}
    for(const p of Object.values(w.gfPlaces||{}))fix(p,'url');
    if(w.gfHero){fix(w.gfHero,'avatar');fix(w.gfHero,'avatarPath');}
    if(n)save();
  }
  document.addEventListener('error',e=>{
    const img=e.target;if(!img||img.localName!=='img'||img.dataset.gfqRetried||!img.closest?.('#'+ID+'-panel'))return;
    const src=img.getAttribute('src')||'',m=src.match(/^(\/api\/global-gallery\/file\/[^?#]+)\.(?:png|jpe?g)$/i);if(!m)return;
    img.dataset.gfqRetried='1';const next=m[1]+'.webp';
    img.addEventListener('load',()=>gfqFixArt(src,next),{once:true});img.setAttribute('src',next);
  },true);
  // 'toggle' does not bubble, so listen in the capture phase.
  document.addEventListener('toggle',e=>{
    const d=e.target;if(!d||d.localName!=='details'||!d.open||!d.dataset?.tx||d.dataset.filled||!d.closest('#'+ID+'-panel'))return;
    const w=current(),t=(w?.gfLedger||[]).find(x=>x.id===d.dataset.tx);if(!t)return;
    d.dataset.filled='1';d.insertAdjacentHTML('beforeend',gfqReceiptBody(w,t));
  },true);
  function gfqReceipt(w){
    const tx=w.gfLedger||[],sm=gfqLedgerSummary(w),c=gfqCurrentDate(w);
    const sign=t=>t.state==='paid'?'−':['received'].includes(t.state)?'+':'';
    // v0.12.0: only the summary line is built; the body (history, buttons) is filled when a row is opened.
    const rows=tx.map((t,i)=>'<details class="gfq-rc-row s-'+esc(t.state)+'" data-tx="'+esc(t.id)+'"><summary><span class="gfq-rc-n gfq-num">#'+String(i+1).padStart(2,'0')+'</span><span class="gfq-rc-name">'+esc(t.name)+'</span><span class="gfq-rc-dots"></span><b class="gfq-num">'+sign(t)+esc(gfqAmount(t.amount,t.unit))+'</b></summary></details>').join('');
    return '<section class="gfq-receipt"><h3>거래 내역</h3><div class="gfq-rc-sub gfq-num">'+esc(c?'기준일 '+c.date.replace(/-/g,'/'):'기준일 미확인')+' · '+tx.length+'건</div>'+
      (rows||'<p class="gfq-sub">아직 기록된 거래가 없습니다. 돈을 받거나 쓰기로 한 장면이 분석되면 여기에 한 줄씩 쌓입니다.</p>')+
      '<div class="gfq-rc-total"><div><span>입금 확인</span><b class="gfq-num">'+esc(gfqAmount(sm.received,sm.unit))+'</b></div><div><span>지출</span><b class="gfq-num">'+esc(gfqAmount(sm.paid,sm.unit))+'</b></div><div><span>받을 돈</span><b class="gfq-num">'+esc(gfqAmount(sm.receivable+sm.pending,sm.unit))+'</b></div></div>'+
      (Object.keys(sm.byUnit).length?'<div class="gfq-rc-other"><b>다른 화폐</b>'+Object.entries(sm.byUnit).map(([u,b])=>'<span>'+esc(u)+' · 입금 '+esc(gfqAmount(b.received,u))+' · 지출 '+esc(gfqAmount(b.paid,u))+(b.pending+b.receivable?' · 받을 돈 '+esc(gfqAmount(b.pending+b.receivable,u)):'')+'</span>').join('')+'</div>':'')+
      '<p class="gfq-sub">승인한 거래만 더합니다'+(sm.unknown?' · 금액 미확인 '+sm.unknown+'건 제외':'')+'. 받을 돈은 미수금과 지급 예정의 합입니다. 게임 재화는 바꾸지 않습니다.</p></section>';
  }
  function gfqFieldsHtml(w){
    const row=f=>'<div class="gfq-field"><span>'+esc(f.name.replace(/^보유 자격 · /,'자격 · '))+'</span><b>'+esc(f.value)+' '+esc(f.unit)+'</b>'+btn('수정','edit-field',`data-id="${esc(f.id)}"`)+btn('삭제','delete-field',`data-id="${esc(f.id)}"`)+'</div>';
    return '<section class="gfq-notes"><div class="gfq-items-head"><h3>메모 항목</h3>'+btn('＋ 항목','add-field')+'</div><p class="gfq-sub">소지금, 직업처럼 직접 관리하는 값입니다. 명성과 자격도 여기서 고칠 수 있습니다.</p>'+(w.fields.map(row).join('')||'<p class="gfq-sub">항목이 없습니다.</p>')+'</section>';
  }
  function gfqProfileHtml(w){return gfqTicket(w)+gfqItemsHtml(w)+'<div class="gfq-split">'+gfqReceipt(w)+gfqFieldsHtml(w)+'</div>';}
  // Places as an evidence board: pins in order of first appearance, joined by a route line.
  function gfqPlacesHtml(w){
    const all=gfqPlaceList(w),nowKey=w.gfPlaceNow?.key||'';
    if(!all.length)return '<div class="gfq-empty"><strong>아직 기록된 장소가 없습니다</strong><span class="gfq-sub">게임이 챕터 계획을 받을 때 장면마다 정해진 장소를 모읍니다. 이미 만든 장면의 배경 장소는 아래 버튼으로 가져올 수 있습니다.</span>'+btn('장소 불러오기','load-places','class="primary"')+'</div>';
    // v0.6.2: pages of three chapters each (a place shows on every page whose chapters it appears in), then background-only places.
    const chs=[...new Set(all.flatMap(p=>p.chapters||[]))].filter(n=>n>0).sort((x,y)=>x-y),pages=[];
    for(let from=1;chs.length&&from<=chs[chs.length-1];from+=3){const to=from+2,firstIn=p=>{const sc=(p.scenes||[]).find(v=>v.chapter>=from&&v.chapter<=to);return sc?sc.chapter*1000+sc.index:(p.chapters||[]).find(c=>c>=from&&c<=to)*1000;};
      const items=all.filter(p=>(p.chapters||[]).some(c=>c>=from&&c<=to)).sort((x,y)=>firstIn(x)-firstIn(y));if(items.length)pages.push({id:'c'+from,label:from===to?'챕터 '+from:'챕터 '+from+'–'+to,items});}
    const bgOnly=all.filter(p=>!(p.chapters||[]).length);if(bgOnly.length)pages.push({id:'bg',label:'배경만 확인',items:bgOnly});
    const has=(x,k)=>k&&x.items.some(p=>p.key===k);const page=pages.find(x=>x.id===placePage&&(!selectedPlace||has(x,selectedPlace)))||pages.find(x=>has(x,selectedPlace))||pages.find(x=>has(x,nowKey))||pages.filter(x=>x.id!=='bg').pop()||pages[0];
    const list=page.items,pi=pages.indexOf(page);
    const pager='<div class="gfq-pager" role="group" aria-label="장소 페이지">'+btn('<span aria-hidden="true">‹</span>','place-page',`data-id="${pages[pi-1]?.id||''}" aria-label="이전 페이지" ${pi>0?'':'disabled'}`)+
      '<div class="gfq-pager-tabs">'+pages.map(x=>'<button data-action="place-page" data-id="'+x.id+'" aria-pressed="'+(x===page)+'">'+esc(x.label)+' <small class="gfq-num">'+x.items.length+'</small></button>').join('')+'</div>'+
      '<span class="gfq-num gfq-pager-n">'+String(pi+1).padStart(2,'0')+'<small>/'+String(pages.length).padStart(2,'0')+'</small></span>'+
      btn('<span aria-hidden="true">›</span>','place-page',`data-id="${pages[pi+1]?.id||''}" aria-label="다음 페이지" ${pi<pages.length-1?'':'disabled'}`)+'</div>';
    // Pins sit in fixed-width columns (zigzag rows) so a long name can never squeeze into a sliver.
    const cols=(panel?.clientWidth||1200)>=1000?4:3,cw=100/cols,rowH=132,rows=Math.ceil(list.length/cols),H=rows*rowH+30;
    const pos=list.map((p,i)=>{const r=Math.floor(i/cols),c=r%2?cols-1-i%cols:i%cols;let h=0;for(const ch of p.key)h=(h*33+ch.charCodeAt(0))>>>0;return {x:c*cw+1.2,y:22+r*rowH+(h%28)};});
    const sel=list.find(p=>p.key===selectedPlace)||list.find(p=>p.key===nowKey)||list[0];
    const route='<svg class="gfq-route" viewBox="0 0 100 '+H+'" preserveAspectRatio="none" aria-hidden="true"><polyline points="'+pos.map(q=>(q.x+1.9)+','+(q.y+24)).join(' ')+'"/></svg>';
    const pins=list.map((p,i)=>'<button class="gfq-pinbox'+(p.key===sel.key?' on':'')+(p.key===nowKey?' here':'')+'" style="left:'+pos[i].x.toFixed(2)+'%;top:'+pos[i].y+'px;width:calc('+cw.toFixed(2)+'% - 14px)" data-action="select-place" data-id="'+esc(p.key)+'">'+
      (p.key===nowKey?'<span class="gfq-halo" aria-hidden="true"></span>':'')+(gfqImgSrc(p.url)?'<img src="'+esc(p.url)+'" alt="" loading="lazy">':'<span class="gfq-pin-dot" aria-hidden="true"></span>')+
      '<div class="gfq-pin-text"><b>'+esc(p.name)+'</b><small>'+(p.chapters?.length?'챕터 '+esc(p.chapters.join(', ')):'배경만 확인')+' <em class="gfq-num">#'+(i+1)+'</em></small></div></button>').join('');
    const related=w.quests.filter(q=>(q.title+' '+(q.detail||'')+' '+[].concat(q.sourceEvidence||[]).join(' ')).includes(sel.name));
    const detail='<article class="gfq-placecard">'+(gfqImgSrc(sel.url)?'<div class="gfq-placephoto"><img src="'+esc(sel.url)+'" alt="'+esc(sel.name)+' 배경" loading="lazy"></div>':'<div class="gfq-placephoto none"><span class="gfq-sub">배경 이미지가 아직 없습니다</span></div>')+
      '<div class="gfq-placeinfo"><div class="gfq-hd"><span class="gfq-pin" aria-hidden="true"></span><h4>'+esc(sel.name)+'</h4><span class="gfq-no gfq-num">No.<br>'+String(list.indexOf(sel)+1).padStart(3,'0')+'</span></div>'+
      (sel.key===nowKey?'<p class="gfq-here">지금 읽고 있는 장면의 장소입니다.</p>':'')+
      '<h5>등장한 장면</h5>'+((sel.scenes||[]).length?'<ul class="gfq-facts">'+sel.scenes.map(s=>'<li><b>챕터 '+esc(s.chapter)+' · '+esc(s.index)+'번째 장면</b> '+esc(s.title)+(s.goal?'<br><span class="gfq-sub">'+esc(s.goal)+'</span>':'')+'</li>').join('')+'</ul>':'<p class="gfq-sub gfq-pad">배경 이미지로만 확인한 장소입니다. 이 장소가 나오는 챕터 계획을 게임이 받으면 장면이 채워집니다.</p>')+
      (related.length?'<h5>관련 퀘스트</h5><ul class="gfq-facts">'+related.map(q=>'<li><button class="gfq-link" data-action="open-quest" data-id="'+esc(q.id)+'">'+esc(q.title)+'</button>'+(q.claimed?' · 완료':'')+'</li>').join('')+'</ul>':'')+
      '<div class="gfq-row gfq-editrow">'+btn('이름 고치기·합치기','place-rename',`data-id="${esc(sel.key)}"`)+btn('장소 삭제','place-delete',`data-id="${esc(sel.key)}" class="gfq-ghost"`)+'</div></div></article>';
    return pager+'<div class="gfq-board" style="height:'+H+'px">'+route+pins+'</div>'+
      '<div class="gfq-row gfq-board-foot">'+btn('장소 불러오기','load-places')+'<span class="gfq-sub">번호는 이 페이지에서 처음 등장한 순서입니다. 장소를 누르면 아래에 크게 보입니다.</span></div>'+detail;
  }  // ===== v0.7.0 =====
  // --- Characters: read from replies the game already receives (/beat cast + speaker lines, /roster cards). ---
  const GFQ_NOT_A_NAME=/^(?:|\?+|narrator|narration|system|나레이션|내레이션|시스템|모두|일동|전원|목소리|방송|안내 ?방송)$/iu;
  const gfqCastKey=n=>String(n||'').replace(/\s+/g,' ').trim().toLowerCase().slice(0,60);
  function gfqRememberCast(runId,v,path,req){
    const w=gfqWorldOfRun(runId);if(!w||!v||typeof v!=='object')return;
    const C=w.gfCast&&typeof w.gfCast==='object'?w.gfCast:(w.gfCast={});let changed=false;
    const hero=gfqCastKey(w.protagonist||w.gfHero?.name);
    const put=name=>{const n=String(name||'').replace(/\s+/g,' ').trim().slice(0,60),k=gfqAliasOf(w.gfCastAlias,gfqCastKey(n));if(!k||k===hero||GFQ_NOT_A_NAME.test(n))return null;if(!C[k]){if(Object.keys(C).length>=150)return null;C[k]={name:n,sc:{},scp:{}};changed=true;}return C[k];};
    const set=(c,f,val)=>{if(val===undefined||val===null||val==='')return;if(c[f]!==val){c[f]=val;changed=true;}};
    if(/\/roster$/.test(path)&&Array.isArray(v.cards)){
      for(const u of v.cards){if(!u||u.isProtagonist||u.kind==='weapon')continue;const c=put(u.name);if(!c)continue;
        set(c,'roster',true);set(c,'unitId',String(u.id||'').slice(0,160)||undefined);set(c,'art',u.portrait?String(u.portrait).slice(0,400):undefined);set(c,'rarity',Number(u.rarity)||undefined);set(c,'role',String(u.role||'').slice(0,40)||undefined);set(c,'affinity',String(u.affinity||'').slice(0,30)||undefined);set(c,'level',Number(u.level)||undefined);
        const b=typeof u.bond==='number'?u.bond:Number(u.bond?.level??u.bond?.rank);set(c,'bond',Number.isFinite(b)?b:undefined);}
    }
    // v0.7.1: a character's outfits (the game asks for /unit when a hero is opened; so does this tab, once).
    if(/\/unit$/.test(path)&&v.unit&&typeof v.unit==='object'&&!v.unit.isProtagonist&&v.unit.kind!=='weapon'){
      const c=put(v.unit.name);
      if(c){set(c,'unitId',String(req.unitId||c.unitId||'').slice(0,160)||undefined);set(c,'base',v.unit.portrait?String(v.unit.portrait).slice(0,400):undefined);
        const fits=(Array.isArray(v.unit.outfits)?v.unit.outfits:[]).filter(o=>o&&o.id&&o.url).slice(0,24).map(o=>({id:String(o.id).slice(0,80),name:String(o.name||'').slice(0,40),url:String(o.url).slice(0,400)}));
        if(JSON.stringify(c.outfits||[])!==JSON.stringify(fits)){c.outfits=fits;changed=true;}
        if(c.pick&&c.pick!=='base'&&!fits.some(o=>o.id===c.pick)){delete c.pick;changed=true;}}
    }
    if(/\/beat$/.test(path)){
      if(Array.isArray(v.cast))for(const u of v.cast){if(!u||u.prota)continue;const c=put(u.name);if(c&&u.art)set(c,'art',String(u.art).slice(0,400));}
      const ch=Number(req.chapter),idx=Number(req.storyIndex);
      if(Array.isArray(v.segments)&&ch>0&&Number.isInteger(idx)){
        const key=ch+':'+(idx+1),lines=new Map(),where=new Map();
        for(const s of v.segments){if(!s||typeof s!=='object')continue;const n=String(s.speaker||'').trim();if(!n)continue;lines.set(n,(lines.get(n)||0)+1);if(s.place){const m=where.get(n)||new Map();m.set(String(s.place).slice(0,60),(m.get(String(s.place).slice(0,60))||0)+1);where.set(n,m);}}
        // Names merged by the player (v0.7.7) resolve to one person, so their lines are added together.
        const agg=new Map();for(const [n,count] of lines){const c=put(n);if(!c)continue;const g=agg.get(c)||{count:0,where:new Map()};g.count+=count;for(const [pl,k] of where.get(n)||[])g.where.set(pl,(g.where.get(pl)||0)+k);agg.set(c,g);}
        for(const [c,g] of agg){const count=g.count;
          if(c.sc[key]!==count){c.sc[key]=count;changed=true;}
          const top=[...g.where].sort((a,b)=>b[1]-a[1])[0];if(top&&c.scp[key]!==top[0]){c.scp[key]=top[0];changed=true;}
          const ks=Object.keys(c.sc);if(ks.length>60)for(const k of ks.slice(0,ks.length-60)){delete c.sc[k];delete c.scp[k];}}
      }
    }
    if(changed){save();if(panel&&currentTab==='cast')render();}
  }
  // The portrait shown here: the outfit picked in this tab, else the one the game shows.
  function gfqCastArt(c){if(c.pick==='base'&&c.base)return c.base;const o=c.pick&&(c.outfits||[]).find(x=>x.id===c.pick);return o?o.url:c.art;}
  const gfqUnitTried=new Set();
  function gfqCastOutfits(w,c){
    if(!c.unitId||!w.gfRunId||c.outfits||gfqUnitTried.has(c.unitId))return;
    gfqUnitTried.add(c.unitId);
    gfqApi('/api/gacha-forge/unit','POST',{runId:w.gfRunId,unitId:c.unitId}).then(r=>{if(r&&r.ok)gfqRememberCast(w.gfRunId,r,'/api/gacha-forge/unit',{unitId:c.unitId});else throw 0;}).catch(()=>{const x=Object.values(w.gfCast||{}).find(v=>v.unitId===c.unitId);if(x&&!x.outfits){x.outfits=[];if(panel&&currentTab==='cast')render();}});
  }
  const gfqScKey=k=>{const [a,b]=String(k).split(':').map(Number);return (a||0)*1000+(b||0);};
  function gfqCastList(w){
    return Object.entries(w.gfCast||{}).map(([key,c])=>{const ks=Object.keys(c.sc||{}).sort((a,b)=>gfqScKey(a)-gfqScKey(b));
      const pl={};for(const k of ks){const p=c.scp?.[k];if(p)pl[p]=(pl[p]||0)+1;}
      return {key,...c,scenes:ks.length,lines:ks.reduce((n,k)=>n+(c.sc[k]||0),0),first:ks[0]||'',last:ks[ks.length-1]||'',places:Object.entries(pl).sort((a,b)=>b[1]-a[1]).map(x=>x[0])};})
      .sort((a,b)=>gfqScKey(b.last)-gfqScKey(a.last)||b.lines-a.lines||a.name.localeCompare(b.name));
  }
  const gfqScText=k=>{if(!k)return '';const [a,b]=String(k).split(':');return '챕터 '+a+' · '+b+'번째 장면';};
  let castFilter='전체',selectedCast='';
  function gfqCastHtml(w){
    const all=gfqCastList(w);
    if(!all.length)return '<div class="gfq-empty"><strong>아직 기록된 인물이 없습니다</strong><span class="gfq-sub">스토리 장면을 열면 대사를 한 인물과 초상화를 모읍니다. 동료 목록을 한 번 열면 등급과 레벨도 함께 기록합니다.</span></div>';
    const groups={'전체':()=>true,'동료':c=>c.roster,'등장인물':c=>!c.roster};
    if(!groups[castFilter])castFilter='전체';
    const list=all.filter(groups[castFilter]),sel=list.find(c=>c.key===selectedCast)||list[0];
    const seg='<div class="gfq-seg" role="group" aria-label="인물 분류">'+Object.keys(groups).map(k=>'<button data-action="cast-filter" data-id="'+k+'" aria-pressed="'+(k===castFilter)+'">'+k+' <small class="gfq-num">'+all.filter(groups[k]).length+'</small></button>').join('')+'</div>';
    const cards=list.map(c=>'<button class="gfq-face'+(sel&&c.key===sel.key?' on':'')+'" data-action="select-cast" data-id="'+esc(c.key)+'" aria-pressed="'+(!!(sel&&c.key===sel.key))+'">'+
      '<span class="gfq-face-img">'+(gfqImgSrc(gfqCastArt(c))?'<img src="'+esc(gfqCastArt(c))+'" alt="" loading="lazy">':'<i aria-hidden="true">'+esc([...c.name][0]||'?')+'</i>')+(c.rarity?'<em class="gfq-num">'+'★'.repeat(Math.min(6,c.rarity))+'</em>':'')+'</span>'+
      '<span class="gfq-face-name">'+esc(c.name)+'</span><small>'+(c.last?esc(gfqScText(c.last).replace('번째 장면','')):'대사 없음')+'</small></button>').join('');
    let detail='<div class="gfq-dossier empty"><p class="gfq-sub">이 분류에는 인물이 없습니다.</p></div>';
    if(sel){
      const quests=w.quests.filter(q=>(q.title+' '+(q.detail||'')+' '+[].concat(q.sourceEvidence||[]).join(' ')).includes(sel.name));
      const txs=(w.gfLedger||[]).filter(t=>(t.name+' '+(t.history||[]).map(h=>h.evidence).join(' ')).includes(sel.name));
      const facts=[];
      if(sel.role||sel.affinity)facts.push([sel.role,sel.affinity].filter(Boolean).join(' · '));
      if(sel.level||sel.bond!==undefined)facts.push([sel.level?'레벨 '+sel.level:'',sel.bond!==undefined?'유대 '+sel.bond:''].filter(Boolean).join(' · '));
      if(sel.first)facts.push('처음 대사: '+gfqScText(sel.first));
      if(sel.last&&sel.last!==sel.first)facts.push('마지막 대사: '+gfqScText(sel.last));
      facts.push('대사 '+sel.lines+'줄 · 장면 '+sel.scenes+'곳');
      detail='<article class="gfq-dossier gfq-castcard"><div class="gfq-hd"><span class="gfq-pin" aria-hidden="true"></span><h4>'+esc(sel.name)+'</h4><span class="gfq-no gfq-num">'+(sel.roster?'동료':'인물')+'</span></div>'+
        '<div class="gfq-plate photo tall">'+(gfqImgSrc(gfqCastArt(sel))?'<img src="'+esc(gfqCastArt(sel))+'" alt="'+esc(sel.name)+' 초상화" loading="lazy">':'<span class="gfq-glyph-big">'+esc([...sel.name][0]||'?')+'</span>')+(sel.rarity?'<span class="gfq-plate-tag">'+'★'.repeat(Math.min(6,sel.rarity))+'</span>':'')+'</div>'+
        (()=>{gfqCastOutfits(w,sel);const fits=sel.outfits||[];if(!fits.length)return sel.unitId&&!sel.outfits?'<p class="gfq-sub gfq-pad">의상 목록을 불러오는 중입니다.</p>':'';
          const opts=[...(sel.base&&sel.base!==sel.art?[{id:'base',name:'기본',url:sel.base}]:[]),...fits.filter(o=>o.url!==sel.art)];
          return '<h5>초상화 의상</h5><div class="gfq-outfits">'+'<button data-action="cast-outfit" data-id="'+esc(sel.key)+'" data-o="" aria-pressed="'+(!sel.pick)+'" title="게임에서 입은 의상"><span class="gfq-of-img">'+(gfqImgSrc(sel.art)?'<img src="'+esc(sel.art)+'" alt="" loading="lazy">':'')+'</span><small>게임 그대로</small></button>'+
            opts.map(o=>'<button data-action="cast-outfit" data-id="'+esc(sel.key)+'" data-o="'+esc(o.id)+'" aria-pressed="'+(sel.pick===o.id)+'"><span class="gfq-of-img"><img src="'+esc(o.url)+'" alt="" loading="lazy"></span><small>'+esc(o.name||'의상')+'</small></button>').join('')+'</div><p class="gfq-sub gfq-pad">이 확장 화면에만 적용됩니다. 게임 속 의상은 바뀌지 않습니다.</p>';})()+
        '<h5>요약</h5><ul class="gfq-facts">'+facts.map(f=>'<li>'+esc(f)+'</li>').join('')+'</ul>'+
        (sel.places.length?'<h5>자주 나온 장소</h5><ul class="gfq-facts">'+sel.places.slice(0,4).map(p=>{const k=gfqPlaceKey(p);return '<li>'+(w.gfPlaces?.[k]?'<button class="gfq-link" data-action="select-place" data-id="'+esc(k)+'">'+esc(p)+'</button>':esc(p))+'</li>';}).join('')+'</ul>':'')+
        (quests.length?'<h5>관련 퀘스트</h5><ul class="gfq-facts">'+quests.map(q=>'<li><button class="gfq-link" data-action="open-quest" data-id="'+esc(q.id)+'">'+esc(q.title)+'</button>'+(q.claimed?' · 완료':'')+'</li>').join('')+'</ul>':'')+
        (txs.length?'<h5>관련 거래</h5><ul class="gfq-facts">'+txs.slice(-5).map(t=>'<li>'+esc(t.name)+' · '+esc(gfqAmount(t.amount,t.unit))+' · '+esc(gfqLabel('money',t.state))+'</li>').join('')+'</ul>':'')+
        '<h5>메모</h5><p class="gfq-note">'+(sel.note?esc(sel.note):'<span class="gfq-sub">관계나 기억해 둘 점을 적어 둘 수 있습니다.</span>')+'</p>'+
        '<div class="gfq-row gfq-editrow">'+btn(sel.note?'메모 고치기':'메모 쓰기','cast-note',`data-id="${esc(sel.key)}"`)+btn('이름 고치기·합치기','cast-rename',`data-id="${esc(sel.key)}"`)+btn('인물 삭제','cast-delete',`data-id="${esc(sel.key)}" class="gfq-ghost"`)+'</div></article>';
    }
    return '<section class="gfq-items gfq-castsec"><div class="gfq-items-head">'+seg+'</div><div class="gfq-items-body"><div class="gfq-faces">'+(cards||'<p class="gfq-sub">이 분류에는 인물이 없습니다.</p>')+'</div>'+detail+'</div></section>'+
      '<p class="gfq-sub">대사가 나온 장면을 기준으로 정리합니다. 장면을 다시 열어도 같은 장면은 한 번만 셉니다.</p>';
  }
  // --- Schedule: dated promises and what already happened on each day. ---
  function gfqYmdOf(s){return (String(s||'').match(/\d{4}-\d{2}-\d{2}/)||[])[0]||'';}
  // '금일 오후 6시', '내일 이 시간' → the clock time a promise falls due, when one is known.
  function gfqEventClock(w,t){
    const text=String(t?.text||'');const c=gfqTimeIn(text,'');if(c)return {time:c.time,period:c.period};
    if(/이\s*시간/.test(text)){const k=gfqCurrentClock(w);if(k?.time)return {time:k.time,period:k.period};}
    return {};
  }
  function gfqSchedule(w){
    const ev=[],today=gfqCurrentDate(w)?.date||'';
    for(const t of w.gfLedger||[]){
      const due=t.timing?gfqYmdOf(gfqResolveTiming(w,t.timing)):'';
      if(due&&['pending','receivable'].includes(t.state))ev.push({date:due,kind:'pay',text:t.name+' '+gfqAmount(t.amount,t.unit)+' 지급',open:true,ref:'tx:'+t.id,...gfqEventClock(w,t.timing)});
      for(const h of t.history||[])if(h.date&&h.state==='received')ev.push({date:h.date,kind:'in',text:t.name+' 입금 확인',open:false});
      for(const h of t.history||[])if(h.date&&h.state==='paid')ev.push({date:h.date,kind:'out',text:t.name+' 지출',open:false});
    }
    for(const i of w.items||[]){const due=i.state==='pending'&&i.timing?gfqYmdOf(gfqResolveTiming(w,i.timing)):'';if(due)ev.push({date:due,kind:'item',text:i.name+' 수령',open:true,ref:'item:'+i.id,...gfqEventClock(w,i.timing)});}
    for(const q of w.quests||[]){if(q.startDate)ev.push({date:q.startDate,kind:'quest',text:q.title+' 시작',open:false});if(q.doneDate)ev.push({date:q.doneDate,kind:'done',text:q.title+' 완료',open:false});}
    for(const [ch,d] of Object.entries(w.gfDates||{}))if(d?.date)ev.push({date:d.date,kind:'chapter',text:'챕터 '+ch,open:false});
    // v0.13.0: a promise for a set time today is late once the world clock has passed it.
    const nowRank=gfqClockRank(gfqCurrentClock(w));
    for(const e of ev)e.late=e.open&&today&&(e.date<today||e.date===today&&e.time&&nowRank!==null&&gfqClockRank({time:e.time})<nowRank);
    for(const e of ev)if(e.time)e.text=gfqClockText({time:e.time,period:e.period})+' · '+e.text;
    return ev.sort((a,b)=>a.date.localeCompare(b.date));
  }
  let calMonth='',calDay='';
  function gfqCalendarHtml(w){
    const ev=gfqSchedule(w),today=gfqCurrentDate(w)?.date||'',late=ev.filter(e=>e.late);
    const base=calMonth||(today||ev.find(e=>e.open)?.date||ev[ev.length-1]?.date||'').slice(0,7);
    if(!base)return '<div class="gfq-empty"><strong>아직 날짜가 정해진 일이 없습니다</strong><span class="gfq-sub">세계관 날짜를 만나거나 \'내일 이 시간 지급\' 같은 약속이 분석되면 달력에 표시됩니다. 프로필에서 날짜를 직접 입력할 수도 있습니다.</span></div>';
    const [y,m]=base.split('-').map(Number),first=new Date(Date.UTC(y,m-1,1)),days=new Date(Date.UTC(y,m,0)).getUTCDate(),lead=first.getUTCDay();
    const ym=n=>{const d=new Date(Date.UTC(y,m-1+n,1));return d.getUTCFullYear()+'-'+String(d.getUTCMonth()+1).padStart(2,'0');};
    const day=calDay||today||(base+'-01');
    const cells=[];for(let i=0;i<lead;i++)cells.push('<span class="gfq-cal-pad"></span>');
    for(let d=1;d<=days;d++){const ds=base+'-'+String(d).padStart(2,'0'),mine=ev.filter(e=>e.date===ds);
      cells.push('<button class="gfq-cal-day'+(ds===today?' today':'')+(ds===day?' on':'')+(mine.some(e=>e.late)?' late':'')+'" data-action="cal-day" data-id="'+ds+'" aria-pressed="'+(ds===day)+'" aria-label="'+ds+(mine.length?' · 일정 '+mine.length+'개':'')+'"><b class="gfq-num">'+d+'</b>'+
        mine.slice(0,2).map(e=>'<i class="k-'+e.kind+'">'+esc(e.text)+'</i>').join('')+(mine.length>2?'<small>+'+(mine.length-2)+'</small>':'')+'</button>');}
    const list=ev.filter(e=>e.date===day);
    return (late.length?'<div class="gfq-late"><b>기한이 지난 약속 '+late.length+'개</b><ul>'+late.map(e=>'<li><span class="gfq-num">'+esc(e.date)+'</span> '+esc(e.text)+'</li>').join('')+'</ul><p class="gfq-sub">세계관 날짜가 지났는데 아직 지급·수령이 확인되지 않았습니다. 스토리에서 받았다면 거래 내역이나 소지품에서 상태를 갱신해 주세요.</p></div>':'')+
      '<div class="gfq-cal"><div class="gfq-cal-head">'+btn('<span aria-hidden="true">‹</span>','cal-month',`data-id="${ym(-1)}" aria-label="이전 달"`)+'<h3 class="gfq-num">'+y+'. '+String(m).padStart(2,'0')+'</h3>'+btn('<span aria-hidden="true">›</span>','cal-month',`data-id="${ym(1)}" aria-label="다음 달"`)+(today?btn('오늘','cal-month',`data-id="${today.slice(0,7)}" data-day="${today}"`):'')+'</div>'+
      '<div class="gfq-cal-week">'+'일월화수목금토'.split('').map(x=>'<span>'+x+'</span>').join('')+'</div><div class="gfq-cal-grid">'+cells.join('')+'</div></div>'+
      '<section class="gfq-cal-list"><h3 class="gfq-num">'+esc(gfqDayText(w,day))+(day===today?' · 오늘'+(gfqCurrentClock(w)?' '+esc(gfqClockText(gfqCurrentClock(w))):''):'')+'</h3>'+(list.length?'<ul>'+list.map(e=>'<li class="k-'+e.kind+(e.late?' late':'')+'"><span>'+({pay:'지급 약속',item:'수령 예정',in:'입금',out:'지출',quest:'퀘스트',done:'완료',chapter:'챕터'}[e.kind])+'</span>'+esc(e.text)+(e.late?' <em>기한 지남</em>':'')+'</li>').join('')+'</ul>':'<p class="gfq-sub">이 날짜에 기록된 일이 없습니다.</p>')+'</section>';
  }
  // A date change (read, typed or +1 day) announces what falls due that day.
  function gfqDueToast(w,date){
    const due=gfqSchedule(w).filter(e=>e.open&&e.date===date);
    if(due.length)gfqToast('오늘 예정',due.slice(0,3).map(e=>e.text).join(' · ')+(due.length>3?' 외 '+(due.length-3)+'개':''),'due');
  }
  // --- Chapter log: what each chapter changed, written when an event is applied. ---
  function gfqChLog(w,source,kind,text,amount,unit){
    const ch=Number(gfqChapterOfSource(source))||0;if(!ch||!text)return;
    const L=w.gfChLog&&typeof w.gfChLog==='object'?w.gfChLog:(w.gfChLog={});const list=L[ch]||(L[ch]=[]);
    if(list.some(e=>e.kind===kind&&e.text===text))return;
    list.push({kind,text:String(text).slice(0,120),...(typeof amount==='number'?{amount,...(unit?{unit:gfqUnit(unit)}:{})}:{})});if(list.length>80)list.splice(0,list.length-80);
  }
  function gfqChLogProposal(w,x){
    const src=x.source,name=x.name;
    if(x.category==='quest'){const t=gfqQuestPresentation(gfqSafeProposal(x,gfqRuleCtx(w))).title;gfqChLog(w,src,x.status==='completed'?'done':'quest',t);return;}
    if(gfqMoney(x)&&x.role!=='component'){const k={received:'in',paid:'out',pending:'promise',receivable:'promise'}[x.financialStatus];if(k)gfqChLog(w,src,k,name,typeof x.amount==='number'?x.amount:undefined,x.unit);}
    if(x.category==='item')gfqChLog(w,src,x.financialStatus==='pending'?'promise-item':'item',name);
    if(x.category==='benefit')gfqChLog(w,src,'benefit',name);
    if(x.category==='credential')gfqChLog(w,src,'cred',name);
  }
  function gfqChapterCards(w){
    const chs=new Set(Object.keys(w.gfChLog||{}).map(Number));
    for(const p of Object.values(w.gfPlaces||{}))for(const c of p.chapters||[])chs.add(c);
    for(const c of Object.values(w.gfCast||{}))for(const k of Object.keys(c.sc||{}))chs.add(Number(k.split(':')[0]));
    for(const k of Object.keys(w.gfDates||{}))chs.add(Number(k));
    for(const q of w.quests||[]){const c=Number(gfqChapterOfSource(q.source));if(c)chs.add(c);}
    const list=[...chs].filter(n=>n>0).sort((a,b)=>b-a);
    if(!list.length)return '';
    const card=(ch,i)=>{
      const log=(w.gfChLog||{})[ch]||[],mainU=gfqMainUnit(w),sum=k=>log.filter(e=>e.kind===k&&typeof e.amount==='number'&&(e.unit||mainU)===mainU).reduce((n,e)=>n+e.amount,0);
      const places=Object.values(w.gfPlaces||{}).filter(p=>(p.chapters||[]).includes(ch)).map(p=>p.name);
      const people=gfqCastList(w).filter(c=>Object.keys(c.sc||{}).some(k=>k.startsWith(ch+':'))).map(c=>c.name);
      const started=[...new Set([...log.filter(e=>e.kind==='quest').map(e=>e.text),...(w.quests||[]).filter(q=>Number(gfqChapterOfSource(q.source))===ch).map(q=>q.title)])];
      const done=log.filter(e=>e.kind==='done').map(e=>e.text),steps=log.filter(e=>e.kind==='step').map(e=>e.text);
      const got=log.filter(e=>['item','benefit','cred'].includes(e.kind)).map(e=>e.text),wait=log.filter(e=>['promise','promise-item'].includes(e.kind)).map(e=>e.text+(typeof e.amount==='number'?' '+gfqAmount(e.amount,e.unit||gfqMainUnit(w)):''));
      const d=w.gfDates?.[ch]?.date;
      const row=(k,v)=>v.length?'<div class="gfq-chrow"><dt>'+k+'</dt><dd>'+v.map(x=>'<span>'+esc(x)+'</span>').join('')+'</dd></div>':'';
      const inN=sum('in'),outN=sum('out');
      return '<details class="gfq-chcard"'+(i===0?' open':'')+'><summary><span class="gfq-chno gfq-num">'+String(ch).padStart(2,'0')+'</span><span class="gfq-chtitle">챕터 '+ch+(d?'<small class="gfq-num">'+esc(d)+'</small>':'')+'</span>'+
        '<span class="gfq-chstat">'+[done.length?'완료 '+done.length:'',started.length?'의뢰 '+started.length:'',places.length?'장소 '+places.length:'',people.length?'인물 '+people.length:''].filter(Boolean).join(' · ')+'</span></summary>'+
        '<div class="gfq-chbody">'+(inN||outN?'<div class="gfq-chmoney"><div><span>입금 확인</span><b class="gfq-num">+'+esc(gfqAmount(inN,gfqMainUnit(w)))+'</b></div><div><span>지출</span><b class="gfq-num">−'+esc(gfqAmount(outN,gfqMainUnit(w)))+'</b></div></div>':'')+
        '<dl>'+row('완료한 퀘스트',done)+row('시작한 퀘스트',started)+row('달성한 목표',steps)+row('얻은 것',got)+row('약속된 것',wait)+row('간 장소',places)+row('만난 인물',people.slice(0,12))+'</dl>'+
        (log.length?'':'<p class="gfq-sub">이 챕터는 v0.7.0 전에 반영되어 장소·인물·시작한 퀘스트만 보입니다.</p>')+'</div></details>';
    };
    return '<section class="gfq-chapters"><h3>챕터 기록</h3>'+list.map(card).join('')+'</section>';
  }


  // v0.12.0: a manual approval asks first (async in-page dialogs), then runs again with the answers in `asked`.
  function approveAiProposal(id,bulk=false,asked=null){
    const w=current(),x=w?.aiProposals?.find(v=>v.id===id);if(!x)return false;
    const ctx=gfqRuleCtx(w);
    if(['asset','contract'].includes(x.category)&&gfqIsCond(x)&&x.financialStatus!=='conditional')x.financialStatus='conditional';
    if(!gfqEventEligible(x,ctx))return bulk?false:alert('이 사건은 주인공 자산·의뢰와 무관해 반영할 수 없습니다.');
    if(['asset','contract'].includes(x.category)&&x.financialStatus==='received'&&!/(입금(?:됐|되었|받았|완료| 확인)|계좌.{0,24}(입금|들어왔)|송금(?:받|완료)|잔액.{0,20}(증가|늘어)|실제.{0,12}(수령|지급받)|(?:판매 ?대금|대금|현금|값).{0,16}(?:받았|건네받|수령했))/u.test(String(x.evidence||''))){if(!bulk)alert('정산 완료만으로 실제 입금은 확정할 수 없습니다. 기존 후보를 삭제하고 재분석하거나 수동 확인해 주세요.');return false;}
    if(!x.updateOf&&(w.quests||[]).some(q=>x.category==='quest'&&gfqDuplicate({category:'quest',name:q.title,evidence:q.detail||''},x,ctx)))return bulk?false:alert('이미 등록된 유사 퀘스트입니다.');
    if(x.status==='uncertain'||x.financialStatus==='uncertain'&&x.category==='asset'){if(!bulk)alert('불확실한 사건은 자동으로 반영할 수 없습니다. 원문을 확인한 후 수동으로 등록해 주세요.');return false;}
    if(!bulk&&!asked){
      const ledgerQ=gfqMoney(x)&&x.role!=='component'?gfqLedgerQuestion(w,x):null;
      (async()=>{
        if(!await gfqConfirm('원문과 상태를 확인하셨습니까? '+x.category+' · '+x.name+'을(를) 기록에 반영하시겠습니까?'))return;
        const answer=ledgerQ?await gfqPrompt(ledgerQ.text,ledgerQ.def):null;
        if(ledgerQ&&answer===null)return;
        // v0.12.0: an owned item with a similar name: same thing (nothing added) or a new one.
        const twin=x.category==='item'?gfqSimilarItem(w,x.name):null;
        if(twin){const same=await gfqConfirm('이미 가진 \''+twin.name+' ×'+twin.qty+'\'과(와) 같은 물건인가요?\n확인: 같은 물건 (개수 그대로) · 취소: 새 물건으로 추가');return approveAiProposal(id,false,same?{answer,sameItem:twin.id}:{answer,newItem:true});}
        approveAiProposal(id,false,{answer});
      })();
      return false;
    }
    if(gfqMoney(x)&&x.role==='component')record(w,'구성 금액 확인: '+x.name+' '+gfqAmount(x.amount,x.unit)+' (총액에 포함, 별도 수입 아님)');
    else if(gfqMoney(x)&&!gfqLedgerRecord(w,x,bulk,asked?asked.answer:null))return false;
    if(x.category==='quest'){
      const quest=gfqQuestPresentation(gfqSafeProposal(x,gfqRuleCtx(w)));
      const target=x.updateOf?(w.quests||[]).find(v=>v.id===x.updateOf):null;
      if(target)gfqUpdateQuest(w,target,x,quest);
      else{
      const q={id:uid(),stepDone:quest.stepDone,...(x.date?{startDate:x.date}:{}),...(x.status==='completed'&&(x.endDate||x.date)?{doneDate:x.endDate||x.date}:{}),title:quest.title,type:'의뢰',detail:quest.objective,target:1,progress:x.status==='completed'?1:0,reward:quest.rewardList.map(r=>r.name).join(' · '),rewardDetails:quest.rewardList,claimed:x.status==='completed',sourceEvidence:x.evidence,source:x.source,steps:quest.steps,rewardTransactionId:x.rewardTransactionId||''};
      w.quests.push(q);if(q.claimed)gfqAwardQuestReputation(w,q);
      }
    }
    else if(x.category==='credential'){
      // v0.3.15: store the licence, not the act of receiving it ('… 면허 교부' → '… 면허').
      const name='보유 자격 · '+(String(x.name).replace(/\s*(교부|발급|취득|획득|승인|수여)$/u,'').trim()||x.name);
      // v0.3.10: '물리계 정식 면허 교부' and '물리계 C급 정식 면허' are the same licence.
      const words=t=>String(t).replace(/^보유 자격 · /,'').replace(/(교부|발급|취득|획득|승인|수여)$/u,'').trim().split(/\s+/).filter(Boolean);
      const mine=words(x.name);
      const same=w.fields.find(v=>v.name!==name&&/^보유 자격 · /.test(v.name)&&(()=>{const o=words(v.name);return mine.length&&mine.every(t=>o.includes(t))||o.length&&o.every(t=>mine.includes(t));})());
      if(same){record(w,'자격 중복 확인: '+x.name+' → 기존 \''+same.name.replace(/^보유 자격 · /,'')+'\' 유지 · '+x.evidence);w.aiAcceptedKeys||=[];w.aiAcceptedKeys.push(x.category+'|'+x.evidence);w.aiProposals=w.aiProposals.filter(v=>v.id!==id);if(!bulk){save();render();}return true;}
      const field=w.fields.find(v=>v.name===name);
      const dated=gfqDatesIn(x.evidence)[0],value=dated?'취득 · '+dated:'취득';
      if(field)field.value=value;else w.fields.push({id:uid(),name,value,unit:''});
      record(w,'자격 취득 확인: '+x.name+' · '+x.evidence);
    }else if(x.category==='benefit'){
      gfqApplyBenefit(w,x);
    }else if(x.category==='contract'){
      record(w,'계약 확인: '+x.name+' · '+x.evidence);
    }else if(x.category==='item'){
      if(!gfqApplyItem(w,x,{assumeOne:!!asked?.assumeOne,sameItem:asked?.sameItem||'',newItem:!!asked?.newItem})){if(!bulk)alert('아이템은 획득 확정 및 개수 확인 시, 또는 수령 예정 물품으로만 반영할 수 있습니다.');return false;}
    }else if(['asset','contract'].includes(x.category)&&x.financialStatus==='conditional'){
      record(w,'조건부 보장 확인(총액에 더하지 않음): '+x.name+(typeof x.amount==='number'?' '+gfqAmount(x.amount,x.unit):'')+' · '+x.evidence);
    }else if(x.category==='asset'&&!gfqMoney(x)){
      record(w,'자산 검토: '+x.name+' · '+x.evidence);
    }
    if(gfqMoney(x)&&x.financialStatus==='paid'&&Array.isArray(x.purchasedItems))gfqApplyPurchase(w,x);
    if(gfqMoney(x)&&Array.isArray(x.soldItems))gfqApplySale(w,x);
    gfqRelinkQuestRewards(w);
    if(x.category==='quest')for(const q of w.quests.filter(q=>q.id===x.updateOf||q.title===gfqQuestPresentation(gfqSafeProposal(x,gfqRuleCtx(w))).title))gfqQuestRewardItems(w,q);
    try{gfqChLogProposal(w,x);}catch{}
    record(w,'AI 검토 승인: '+x.name+' · '+x.source);
    w.aiAcceptedKeys||=[];w.aiAcceptedKeys.push(x.category+'|'+x.evidence);
    w.aiProposals=w.aiProposals.filter(v=>v.id!==id);if(!bulk){save();render();}return true;
  }
  const btn=(label,action,extra='')=>`<button data-action="${action}" ${extra}>${label}</button>`;
  // v0.6.1: line icons for items and rewards, picked from the name (no images are fetched).
  const GFQ_ICONS={
    coin:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="5"/><path d="M12 9.5v5"/>',
    star:'<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z"/>',
    badge:'<circle cx="12" cy="9" r="5"/><path d="M8.5 13l-2 7 5.5-2.5 5.5 2.5-2-7"/><path d="M10 9l1.4 1.4L14 7.8"/>',
    shield:'<path d="M12 3l7 3v5.5c0 4.5-3 7.6-7 9.5-4-1.9-7-5-7-9.5V6z"/><path d="M12 8.5v6M9 11.5h6"/>',
    ticket:'<path d="M3.5 7.5h17v3a1.8 1.8 0 0 0 0 3v3h-17v-3a1.8 1.8 0 0 0 0-3z"/><path d="M14.5 7.5v9" stroke-dasharray="1.6 1.6"/>',
    glove:'<path d="M7 20v-6.5L5 10.5V7.8a1.3 1.3 0 0 1 2.6 0V10"/><path d="M7.6 10V5.3a1.3 1.3 0 0 1 2.6 0V10"/><path d="M10.2 9.5V4.6a1.3 1.3 0 0 1 2.6 0v5"/><path d="M12.8 9.6V5.6a1.3 1.3 0 0 1 2.6 0V13l1.6-2a1.4 1.4 0 0 1 2.2 1.7L16 17.5V20z"/><path d="M7 17h9"/>',
    sword:'<path d="M14.5 4.5H19.5V9.5L10 19l-5-5z"/><path d="M7 12l5 5M4 20l2.5-2.5"/>',
    shirt:'<path d="M8.5 4L4 6.5 5.8 10.5 7.5 9.8V20h9V9.8l1.7.7L20 6.5 15.5 4a3.5 3.5 0 0 1-7 0z"/>',
    flask:'<path d="M9.5 3.5h5M10.5 3.5v5.2L5.6 17.3A2 2 0 0 0 7.4 20.5h9.2a2 2 0 0 0 1.8-3.2l-4.9-8.6V3.5"/><path d="M7.8 14h8.4"/>',
    gem:'<path d="M7 4.5h10l3.5 5L12 20 3.5 9.5z"/><path d="M3.5 9.5h17M9.5 4.5 8 9.5l4 10.5 4-10.5-1.5-5"/>',
    card:'<rect x="3.5" y="5.5" width="17" height="13"/><circle cx="8.5" cy="11" r="2"/><path d="M5.8 15.5c.5-1.4 1.5-2 2.7-2s2.2.6 2.7 2M13.5 9.5h4.5M13.5 12.5h4.5"/>',
    key:'<circle cx="8" cy="12" r="3.8"/><path d="M11.8 12H20.5M17.5 12v3M15 12v2"/>',
    phone:'<rect x="7" y="3" width="10" height="18" rx="1.5"/><path d="M10.5 18h3"/>',
    cup:'<path d="M5 8.5h11v5.5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z"/><path d="M16 10h1.5a2.5 2.5 0 0 1 0 5H16M9 3.5v2.5M12 3.5v2.5"/>',
    tool:'<path d="M14.5 4a4.5 4.5 0 0 0-4 6.3L4 16.8 7.2 20l6.5-6.5A4.5 4.5 0 0 0 20 9.5l-3 1-2.5-2.5 1-3z"/>',
    box:'<path d="M3.5 7.5 12 3.5l8.5 4v9L12 20.5l-8.5-4z"/><path d="M3.5 7.5 12 11.5l8.5-4M12 11.5v9"/>'
  };
  function gfqIconKey(name,kind){
    const n=String(name||'');
    if(kind==='money')return 'coin';if(kind==='reputation')return 'star';if(kind==='credential')return 'badge';
    if(/보험|치료|무상 ?보장|회복 지원|의료/u.test(n))return 'shield';
    if(kind==='voucher'||kind==='benefit'||/이용권|쿠폰|감면|할인|면제|권$/u.test(n))return 'ticket';
    if(/건틀릿|장갑|글러브|너클/u.test(n))return 'glove';
    if(/검|칼|단검|창|활|총|무기|도끼|해머/u.test(n))return 'sword';
    if(/갑옷|방어구|의류|옷|코트|슈트|수트|조끼|망토|세트|수선/u.test(n))return 'shirt';
    if(/포션|물약|앰플|약|해독|회복제/u.test(n))return 'flask';
    if(/소재|조각|파편|코어|마석|광석|결정|비늘|가죽|뼈|정수|수정/u.test(n))return 'gem';
    if(/면허|자격|증$|증명|서류|문서|계약서|신분|카드|명함/u.test(n))return 'card';
    if(/열쇠|키$|카드키|출입/u.test(n))return 'key';
    if(/휴대폰|폰|단말|장치|기기|드론|통신|태블릿|노트북|무전/u.test(n))return 'phone';
    if(/음식|도시락|빵|커피|식량|음료|식사|간식/u.test(n))return 'cup';
    if(/공구|키트|도구|렌치|망치|부품/u.test(n))return 'tool';
    return 'box';
  }
  const gfqThing=(name,kind,cls='')=>'<svg class="gfq-ico '+cls+'" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round">'+GFQ_ICONS[gfqIconKey(name,kind)]+'</svg>';
  function gfqRewardState(w,r){
    const labels={received:'수령 확인',confirmed:'확정',pending:'지급 예정',suggested:'제안',uncertain:'미확인'};
    if(r.kind==='money'&&gfqIsCond(r))return {text:'조건부 보장 · 총액 아님',tone:'soft'};
    const tx=r.txId&&(w.gfLedger||[]).find(t=>t.id===r.txId);
    const item=r.kind==='item'&&r.chainKey&&w.items.find(i=>i.chainKey===r.chainKey||i.id===r.chainKey);
    const voucher=r.kind==='benefit'&&r.chainKey&&w.items.find(i=>i.kind==='voucher'&&i.chainKey===r.chainKey);
    if(tx)return {text:gfqLabel('money',tx.state),tone:tx.state==='received'?'ok':'wait'};
    if(voucher)return {text:voucher.qty>0?'이용권 '+voucher.qty+'회':'사용 완료',tone:'ok'};
    if(item)return {text:item.state==='pending'?'수령 예정':'보유',tone:item.state==='pending'?'wait':'ok'};
    if(r.kind==='benefit'&&r.certainty==='received')return {text:'적용됨',tone:'ok'};
    return {text:labels[r.certainty]||'미확인',tone:r.certainty==='received'?'ok':r.certainty==='suggested'||r.certainty==='uncertain'?'soft':'wait'};
  }
  let questFilter='진행 중',selectedQuest='',questEdit='';
  const gfqQuestDone=q=>!!q.claimed;
  function gfqQuestSteps(q){const n=Array.isArray(q.steps)?q.steps.length:0;return n?{done:q.steps.filter((_,i)=>q.stepDone?.[i]===true).length,total:n}:{done:Math.min(q.progress||0,q.target||1),total:q.target||1};}
  function gfqQuestPlace(w,q){const text=q.title+' '+(q.detail||'')+' '+[].concat(q.sourceEvidence||[]).join(' ');return gfqPlaceList(w).filter(p=>text.includes(p.name)).sort((a,b)=>b.name.length-a.name.length)[0]||null;}
  function gfqQuestParentOptions(w,q){
    const blocked=new Set([q.id]),stack=[q.id];
    while(stack.length){const id=stack.pop();for(const child of (w.quests||[]).filter(x=>x.parentQuestId===id)){if(!blocked.has(child.id)){blocked.add(child.id);stack.push(child.id);}}}
    return (w.quests||[]).filter(x=>!blocked.has(x.id));
  }
  // A quest relationship must be reviewed against the actual quest records, not shared location words.
  function gfqQuestLinkEvidence(q){
    return [q.title,q.detail,...[].concat(q.sourceEvidence||[])].filter(v=>typeof v==='string').join('\n').slice(0,2400);
  }
  function gfqQuestSuggestions(w,q){
    const allowed=new Set(gfqQuestParentOptions(w,q).map(x=>x.id));
    return (w.gfQuestLinkReviews?.[q.id]||[]).filter(x=>allowed.has(x.parentId)&&x.quote&&x.reason)
      .map(x=>({p:w.quests.find(v=>v.id===x.parentId),type:x.type,reason:x.reason,quote:x.quote})).filter(x=>x.p);
  }
  async function gfqReviewQuestLinks(w,q){
    const connectionId=String(data.aiConnectionId||'').trim();
    if(!connectionId)return alert('설정에서 AI 연결을 먼저 선택해 주세요.');
    if(gfqBusy)return alert('AI 분석이 진행 중입니다. 완료 후 다시 시도해 주세요.');
    const options=gfqQuestParentOptions(w,q).slice(-35);
    if(!options.length)return alert('현재 월드에 연결할 다른 퀘스트가 없습니다.');
    const source=gfqQuestLinkEvidence(q),rows=options.map((p,i)=>({id:'p'+(i+1),title:p.title,record:gfqQuestLinkEvidence(p)}));
    const instruction='두 퀘스트가 실제 같은 의뢰의 상위·하위 임무인지 판정합니다. 지역, 장소, 등장인물, 장르, 게이트 같은 단어가 같다는 이유로 연결하지 마세요. 의뢰·목적·지시 관계가 명시된 경우에만 제안하세요. 다른 의뢰면 빈 배열을 반환하세요. 모든 연결은 사용자가 승인합니다. JSON만 출력: {"links":[{"parentId":"p1","type":"하위 목표|동일 의뢰|후속 임무","reason":"두 임무의 실제 인과관계","quote":"입력 기록에 그대로 등장하는 짧은 근거 문자열"}]}. quote는 입력 record의 연속 문자열을 그대로 복사하세요.';
    try{
      const host=typeof marinara==='object'&&marinara?marinara:globalThis.marinara||{};
      const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),90000);let raw;
      gfqBusy=true;try{raw=await gfqGenerate(host,connectionId,'gfq-link-'+Date.now(),'You verify quest links conservatively. Return JSON only.',instruction+'\n[선택 퀘스트]\n'+JSON.stringify({title:q.title,record:source})+'\n[상위 퀘스트 후보]\n'+JSON.stringify(rows),1100,ctrl.signal);}finally{clearTimeout(timer);gfqBusy=false;}
      const parsed=gfqParseEvents(raw,'links');
      if(!parsed||parsed.partial)throw Error('AI 응답을 정상적인 JSON으로 해석하지 못했습니다.');
      const accepted=[];
      for(const item of parsed.events.slice(0,8)){
        const idx=rows.findIndex(v=>v.id===item.parentId);
        if(idx<0||!['하위 목표','동일 의뢰','후속 임무'].includes(item.type))continue;
        const quote=String(item.quote||'').trim(),reason=String(item.reason||'').trim();
        if(quote.length<8||reason.length<8||!rows[idx].record.includes(quote)&&!source.includes(quote))continue;
        accepted.push({parentId:options[idx].id,type:item.type,reason:reason.slice(0,180),quote:quote.slice(0,220)});
      }
      if(current()!==w||!w.quests.includes(q))return;
      w.gfQuestLinkReviews||={};w.gfQuestLinkReviews[q.id]=accepted;w.gfQuestLinkChecked||={};w.gfQuestLinkChecked[q.id]={at:now(),count:accepted.length};save();render();
    }catch(err){alert('퀘스트 연결 검토에 실패했습니다: '+String(err?.message||err));}
  }
  async function gfqBranchReview(w,q){
    const connectionId=String(data.aiConnectionId||'').trim();
    if(!connectionId)return alert('설정에서 AI 연결을 먼저 선택해 주세요.');
    if(gfqBusy)return alert('다른 AI 분석이 진행 중입니다. 완료 후 다시 시도해 주세요.');
    const records=gfqStoryRecords(w).filter(t=>t.text&&t.text.length>=15).slice(-30);
    const source=records.map(t=>'['+t.source+'] '+t.text.slice(0,1300)).join('\n').slice(-14000);
    if(!source)return alert('분석할 스토리 원문이 없습니다.');
    const system='RPG 플레이어의 실제 선택을 보수적으로 판정합니다. 선택하지 않은 행동, NPC의 발언, 가상의 분기는 제외하세요. JSON만 반환하세요.';
    const prompt='현재 퀘스트 '+q.title+'\n'+(q.detail||'')+'\n아래 실제 기록에서 플레이어가 직접 선택한 행동과 퀘스트에 생긴 결과를 찾으세요. 원문 그대로의 연속 인용이 없으면 빈 배열을 반환하세요. 추정해서 새 퀘스트나 완료 보상을 생성하지 마세요.\nJSON 형식 {"branches":[{"choice":"선택한 행동","note":"확인된 결과(없으면 빈 문자열)","quote":"원문 그대로 연속 인용"}]}\n'+source;
    try{
      const host=typeof marinara==='object'&&marinara?marinara:globalThis.marinara||{};
      const ctrl=new AbortController(),timeout=setTimeout(()=>ctrl.abort(),90000);let raw;
      gfqBusy=true;try{raw=await gfqGenerate(host,connectionId,'gfq-branch-'+Date.now(),system,prompt,1300,ctrl.signal);}finally{clearTimeout(timeout);gfqBusy=false;}
      const parsed=gfqParseEvents(raw,'branches');
      if(!parsed||parsed.partial)throw Error('분기 분석 응답 형식을 확인하지 못했습니다.');
      const candidates=[];
      for(const x of parsed.events.slice(0,8)){
        const quote=String(x.quote||'').trim(),choice=String(x.choice||'').trim(),note=String(x.note||'').trim();
        if(quote.length<8||choice.length<3||!records.some(r=>r.text.includes(quote)))continue;
        if((q.branchHistory||[]).some(h=>h.quote===quote))continue;
        candidates.push({choice:choice.slice(0,180),note:note.slice(0,400),quote:quote.slice(0,250)});
      }
      if(current()!==w||!w.quests.includes(q))return;
      w.gfBranchCandidates||={};w.gfBranchCandidates[q.id]=candidates;save();render();
    }catch(e){alert('AI 분기 검토에 실패했습니다: '+String(e.message||e));}
  }
  function gfqQuestsHtml(w){
    const groups={'진행 중':q=>!gfqQuestDone(q),'완료':gfqQuestDone,'전체':()=>true};
    if(!groups[questFilter])questFilter='진행 중';
    const list=w.quests.filter(groups[questFilter]).slice().reverse();
    const sel=list.find(q=>q.id===selectedQuest)||list[0]||null;
    const pips=q=>{const s=gfqQuestSteps(q);return '<span class="gfq-pips" aria-label="세부 목표 '+s.done+'/'+s.total+'">'+Array.from({length:Math.min(s.total,12)},(_,i)=>'<i'+(i<s.done?' class="on"':'')+'></i>').join('')+'</span>';};
    const side='<div class="gfq-qside"><div class="gfq-seg" role="group" aria-label="퀘스트 분류">'+Object.keys(groups).map(k=>'<button data-action="quest-filter" data-id="'+k+'" aria-pressed="'+(k===questFilter)+'">'+k+' <small class="gfq-num">'+w.quests.filter(groups[k]).length+'</small></button>').join('')+'</div>'+
      '<div class="gfq-qlist">'+(list.map(q=>'<button class="gfq-qitem'+(sel&&sel.id===q.id?' on':'')+(gfqQuestDone(q)?' done':'')+'" data-action="select-quest" data-id="'+esc(q.id)+'" aria-pressed="'+(!!(sel&&sel.id===q.id))+'"><span class="gfq-qemb" aria-hidden="true">'+esc(String(q.type||'의뢰').slice(0,2))+'</span><span class="gfq-qtxt"><b>'+esc(q.title)+'</b>'+pips(q)+'</span></button>').join('')||'<p class="gfq-sub">'+(questFilter==='완료'?'완료한 퀘스트가 없습니다.':'진행 중인 퀘스트가 없습니다.')+'</p>')+'</div>'+
      btn('＋ 퀘스트 직접 추가','add-quest','class="gfq-qadd"')+'</div>';
    if(!sel)return '<div class="gfq-quests">'+side+'<div class="gfq-qdetail empty"><strong>표시할 퀘스트가 없습니다</strong><span class="gfq-sub">AI 분석이 스토리에서 의뢰를 찾으면 여기에 나타납니다.</span></div></div>';
    const s=gfqQuestSteps(sel),place=gfqQuestPlace(w,sel),done=gfqQuestDone(sel);
    const parent=(w.quests||[]).find(q=>q.id===sel.parentQuestId);
    const children=(w.quests||[]).filter(q=>q.parentQuestId===sel.id);
    const suggestions=parent?[]:gfqQuestSuggestions(w,sel);
    const check=w.gfQuestLinkChecked?.[sel.id];
    const family='<section class="gfq-card"><b>퀘스트 연결</b>'+
      (parent?'<p>상위: <button class="gfq-link" data-action="open-quest" data-id="'+esc(parent.id)+'">'+esc(parent.title)+'</button></p>':'<p class="gfq-muted">독립 퀘스트입니다.</p>')+
      (children.length?'<p>하위 퀘스트: '+children.map(q=>'<button class="gfq-link" data-action="open-quest" data-id="'+esc(q.id)+'">'+esc(q.title)+'</button>').join(' · ')+'</p>':'')+
      (check&&!suggestions.length?'<p class="gfq-muted">AI 검토 결과: 확실한 상위 퀘스트 관계가 확인되지 않았습니다. 현재 독립 퀘스트로 유지합니다.</p>':'')+
      (suggestions.length?'<div class="gfq-muted">연결 후보(검토 후 선택): '+suggestions.map(x=>'<div><button class="gfq-link" data-action="quest-parent" data-id="'+esc(sel.id)+'" data-parent="'+esc(x.p.id)+'">'+esc(x.p.title)+'</button> · '+esc(x.type)+'<p class="gfq-muted">근거: '+esc(x.quote)+' · 판단: '+esc(x.reason)+'</p></div>').join('')+'</div>':'')+
      btn('AI로 연결 검토','quest-review-links','data-id="'+esc(sel.id)+'"')+btn('상위 퀘스트 직접 지정','quest-parent','data-id="'+esc(sel.id)+'"')+
      (parent?btn('연결 해제','quest-unlink','data-id="'+esc(sel.id)+'"'):'')+
      '<p class="gfq-muted">동일 월드 안에서만 연결합니다. 완료·보상은 각각 독립적으로 유지됩니다.</p></section>';

    const steps=Array.isArray(sel.steps)&&sel.steps.length?sel.steps.map((t,i)=>{const on=sel.stepDone?.[i]===true;return '<button class="gfq-obj'+(on?' on':'')+'" data-action="toggle-step" data-id="'+esc(sel.id)+'" data-step="'+i+'" aria-pressed="'+on+'"><span class="gfq-obj-mark" aria-hidden="true"></span><span class="gfq-obj-t">'+esc(t)+'</span><span class="gfq-num">'+(on?1:0)+' / 1</span></button>';}).join(''):
      '<div class="gfq-obj"><span class="gfq-obj-mark" aria-hidden="true"></span><span class="gfq-obj-t">목표 진행</span><span class="gfq-num">'+esc(sel.progress)+' / '+esc(sel.target)+'</span></div>';
    const rewards=gfqMergeMoneyRewards((sel.rewardDetails||[]).map((r,i)=>({...r,_i:i}))).map(r=>({r,i:r._i}));
    const big=rewards.filter(x=>['money','reputation'].includes(x.r.kind)),tiles=rewards.filter(x=>!['money','reputation'].includes(x.r.kind));
    const amount=r=>r.amount!==null&&r.amount!==undefined&&r.amount!==''?(r.kind==='reputation'?'+':gfqIsCond(r)?'최소 ':'')+Number(r.amount).toLocaleString('ko-KR')+(r.kind==='money'?'':String(r.unit||'')):'금액 미정';
    const toLedger=({r,i})=>r.kind==='money'&&!gfqIsCond(r)&&typeof r.amount==='number'&&!(r.txId&&(w.gfLedger||[]).some(t=>t.id===r.txId))?'<button class="gfq-link" data-action="reward-to-ledger" data-id="'+esc(sel.id)+'" data-idx="'+i+'">거래 내역에 기록</button>':'';
    const rw=(sel.rewardDetails||[]).length?
      '<div class="gfq-rw">'+(tiles.length?'<div class="gfq-rw-tiles">'+tiles.map(({r})=>{const st=gfqRewardState(w,r);return '<div class="gfq-rw-tile t-'+st.tone+'" title="'+esc(r.name)+'">'+gfqThing(r.name,r.kind)+'<span class="gfq-rw-name">'+esc(r.name)+'</span><span class="gfq-chip t-'+st.tone+'">'+esc(st.text)+'</span></div>';}).join('')+'</div>':'')+
        (big.length?'<div class="gfq-rw-rows">'+big.map(x=>{const st=gfqRewardState(w,x.r);return '<div class="gfq-rw-row'+(gfqIsCond(x.r)?' cond':'')+'" '+(gfqIsCond(x.r)?'title="철수·실패 같은 조건이 생길 때만 받는 최소 금액입니다. 다른 보수에 더해지지 않습니다."':'')+'><span class="gfq-rw-ic">'+gfqThing(x.r.name,x.r.kind)+'</span><span class="gfq-rw-rname">'+esc(x.r.name)+(x.r.aka?.length?'<small class="gfq-aka" title="'+esc(x.r.aka.join(' · '))+'">같은 보상 '+(x.r.aka.length+1)+'건 묶음</small>':'')+'<span class="gfq-chip t-'+st.tone+'">'+esc(st.text)+'</span>'+toLedger(x)+'</span><b class="gfq-num">'+esc(amount(x.r))+(x.r.kind==='money'?'<small>'+esc(x.r.unit||gfqMainUnit(w))+'</small>':'')+'</b></div>';}).join('')+'</div>':'')+'</div>':
      '<p class="gfq-sub">기록된 보상이 없습니다. '+esc(sel.reward||'')+'</p>';
    const why=(sel.rewardDetails||[]).find(r=>r.kind==='reputation'&&r.assessed&&r.evidence);
    if(questEdit===sel.id)return '<div class="gfq-quests">'+side+gfqQuestForm(w,sel)+'</div>';
    const detail='<article class="gfq-qdetail"><div class="gfq-qhead"><div class="gfq-qcrest" aria-hidden="true"><span>'+esc(String(sel.type||'의뢰').slice(0,2))+'</span></div><div class="gfq-qhead-t"><h3>'+esc(sel.title)+'</h3>'+
        (place?'<button class="gfq-qplace" data-action="select-place" data-id="'+esc(place.key)+'">'+gfqIcon('places')+esc(place.name)+'</button>':'')+
        '<div class="gfq-qmeta">'+[done?'완료':'진행 중',sel.startDate?'시작 '+esc(sel.startDate):'',sel.doneDate?'완료 '+esc(sel.doneDate):'',sel.source?esc(sel.source):''].filter(Boolean).join('<i></i>')+'</div></div></div>'+
      '<div class="gfq-qbody"><div class="gfq-objs"><div class="gfq-objs-h"><span>세부 목표</span><span class="gfq-num">'+s.done+' / '+s.total+'</span></div>'+steps+'</div>'+
        (sel.detail?'<p class="gfq-qdesc">'+esc(sel.detail)+'</p>':'')+
        '<section class="gfq-card"><h4>스토리 선택·분기 이력</h4>'+
        '<p class="gfq-muted">플레이어가 실제로 선택한 행동만 기록합니다. 선택하지 않은 분기는 완료 처리하지 않습니다.</p>'+
        (Array.isArray(sel.branchHistory)?sel.branchHistory.slice(-12).map(h=>'<p>'+esc(h.at)+' · '+esc(h.choice)+(h.note?' — '+esc(h.note):'')+'</p>').join(''):'')+
        btn('선택 기록 추가','quest-branch-add','data-id="'+esc(sel.id)+'"')+btn('AI 선택 검토','quest-branch-review','data-id="'+esc(sel.id)+'"')+
        (w.gfBranchCandidates?.[sel.id]?.length?'<div>'+w.gfBranchCandidates[sel.id].map((v,i)=>'<p class="gfq-muted">선택: '+esc(v.choice)+' · 근거: '+esc(v.quote)+' '+btn('선택 확인·반영','quest-branch-accept','data-id="'+esc(sel.id)+'" data-idx="'+i+'"')+'</p>').join('')+'</div>':'')+'</section>'+
        family+'<section class="gfq-qrw"><h4>보상</h4>'+rw+(why?'<p class="gfq-sub">명성 평가: '+esc(String(why.evidence).replace(/^확장 명성 규칙 제안:?\s*/,''))+'</p>':'')+'</section>'+
      '</div><footer class="gfq-qfoot">'+btn('삭제','delete-quest',`data-id="${esc(sel.id)}" class="gfq-ghost"`)+btn('고치기','quest-edit',`data-id="${esc(sel.id)}"`)+(Array.isArray(sel.steps)&&sel.steps.length?'':btn('＋1 진행','increment',`data-id="${esc(sel.id)}" ${done?'disabled':''}`))+btn(done?'완료됨':'완료 처리','complete',`data-id="${esc(sel.id)}" class="primary" ${done?'disabled':''}`)+'</footer></article>';
    return '<div class="gfq-quests">'+side+detail+'</div>';
  }
  const GFQ_RW_KINDS=[['money','돈'],['item','물품'],['reputation','명성'],['benefit','혜택·이용권'],['credential','자격']];
  const GFQ_RW_CERTS=[['received','수령 확인'],['confirmed','확정'],['pending','지급 예정'],['conditional','조건부 보장'],['suggested','제안'],['uncertain','미확인']];
  function gfqQuestForm(w,q){
    const opt=(list,v)=>list.map(([k,l])=>'<option value="'+k+'"'+(k===v?' selected':'')+'>'+esc(l)+'</option>').join('');
    const row=(r,i)=>'<div class="gfq-qf-rw" data-i="'+i+'"><select data-f="kind" aria-label="보상 종류">'+opt(GFQ_RW_KINDS,r.kind||'money')+'</select><input data-f="name" value="'+esc(r.name||'')+'" placeholder="보상 이름" aria-label="보상 이름"><input data-f="amount" inputmode="decimal" value="'+esc(typeof r.amount==='number'?String(r.amount):'')+'" placeholder="수량·금액" aria-label="수량·금액"><input data-f="unit" value="'+esc(r.unit||'')+'" placeholder="단위" aria-label="단위"><select data-f="certainty" aria-label="상태">'+opt(GFQ_RW_CERTS,gfqIsCond(r)?'conditional':(r.certainty||'pending'))+'</select>'+(i<0?'<span class="gfq-sub">새 보상</span>':'<label class="gfq-qf-del"><input type="checkbox" data-f="del"> 빼기</label>')+'</div>';
    const types=[...new Set(['의뢰','일일','주간','업적',q.type||'의뢰'])];
    return '<article class="gfq-qdetail gfq-qform" data-id="'+esc(q.id)+'"><h3>퀘스트 고치기</h3>'+
      '<label>이름<input data-f="title" value="'+esc(q.title||'')+'"></label>'+
      '<label>종류<select data-f="type">'+types.map(t=>'<option'+(t===(q.type||'의뢰')?' selected':'')+'>'+esc(t)+'</option>').join('')+'</select></label>'+
      '<label>설명<textarea data-f="detail" rows="3">'+esc(q.detail||'')+'</textarea></label>'+
      '<label>세부 목표 <small class="gfq-sub">한 줄에 하나씩 적어 주세요. 이름이 같은 목표는 완료 표시가 유지됩니다.</small><textarea data-f="steps" rows="4">'+esc((q.steps||[]).join('\n'))+'</textarea></label>'+
      '<div class="gfq-qf-h">보상 <small class="gfq-sub">여기서 고친 상태는 퀘스트 표시용입니다. 거래 내역의 입금 기록은 바뀌지 않습니다.</small></div>'+
      (q.rewardDetails||[]).map(row).join('')+row({},-1)+
      '<footer class="gfq-qfoot">'+btn('취소','quest-edit-cancel','class="gfq-ghost"')+btn('저장','quest-edit-save',`data-id="${esc(q.id)}" class="primary"`)+'</footer></article>';
  }
  function gfqQuestFormRead(form,q){
    const v=f=>form.querySelector('[data-f="'+f+'"]')?.value??'';
    const title=String(v('title')).trim().slice(0,120);if(!title)return {error:'퀘스트 이름을 입력해 주세요.'};
    const steps=String(v('steps')).split('\n').map(x=>x.trim()).filter(Boolean).slice(0,30);
    const old=(q.steps||[]).map((t,i)=>({t,on:q.stepDone?.[i]===true,used:false}));
    const done=steps.map(t=>{const m=old.find(o=>!o.used&&o.t===t);if(m){m.used=true;return m.on;}return false;});
    const rewards=[];
    for(const el of form.querySelectorAll('.gfq-qf-rw')){
      const i=Number(el.dataset.i),f=k=>el.querySelector('[data-f="'+k+'"]'),base=i>=0?(q.rewardDetails||[])[i]:null;
      if(base&&f('del')?.checked)continue;
      const name=String(f('name').value||'').trim().slice(0,80);if(!name){if(base)return {error:'보상 이름을 비울 수 없습니다. 빼려면 \'빼기\'를 선택해 주세요.'};continue;}
      const raw=String(f('amount').value||'').replace(/[,\s]/g,'');const amount=raw===''?null:Number(raw);
      if(raw!==''&&!Number.isFinite(amount))return {error:'\''+name+'\'의 수량·금액은 숫자로 입력해 주세요.'};
      const r={...(base||{}),kind:f('kind').value,name,amount,unit:String(f('unit').value||'').trim().slice(0,12),certainty:f('certainty').value};
      if(r.certainty==='conditional')r.conditional=true;else delete r.conditional;
      if(!r.unit)delete r.unit;if(!base)r.manual=true;rewards.push(r);
    }
    return {title,type:String(v('type')||'의뢰'),detail:String(v('detail')).trim().slice(0,1000),steps,done,rewards};
  }
  function gfqMergeInto(a,b){for(const [k,v] of Object.entries(b))if(a[k]===undefined||a[k]===null||a[k]==='')a[k]=v;}
  // Custom world picker: the native drop-down list cannot be styled.
  function worldSelect(){
    const keys=Object.keys(data.worlds),name=k=>data.worlds[k]?.gfDisplayName||k;
    return '<details class="gfq-drop"><summary><span class="gfq-drop-k">월드</span><span class="gfq-drop-v">'+esc(data.world?name(data.world):'월드를 골라 주세요')+'</span><svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.6"/></svg></summary>'+
      '<div class="gfq-drop-menu" role="menu">'+keys.map(k=>'<button role="menuitemradio" aria-checked="'+(k===data.world)+'" data-action="pick-world" data-id="'+esc(k)+'"><span>'+esc(name(k))+'</span>'+(data.worlds[k]?.gfRunId?'<small>게임 월드 연결됨</small>':'<small>직접 만든 월드</small>')+'</button>').join('')+
      '<button class="gfq-drop-new" data-action="new-world">＋ 새 월드 만들기</button></div></details>';
  }
  // v0.7.2: looks per world. Only colours, fonts and paper texture change; the layout stays the same.
  const GFQ_THEMES=[
    ['modern','현대','사건 파일 · 남색과 회색 종이',['#d7d4cd','#3b3f7a','#f0c02f']],
    ['east','동양','두루마리 · 걸개 · 금장식',['#efe8e1','#3a3d44','#c4a26a']],
    ['fantasy','판타지','가죽 책상 · 낡은 수첩 · 세피아 · 황동',['#efe5cd','#6b4f2e','#c9a24a']],
    ['sf','SF','관제 화면 · 외곽선 프레임 · 어두운 바탕',['#16191d','#39434c','#3fd3e6']],
    ['school','학원·일상','줄 노트 · 테이프 · 스티커',['#ecedf3','#3d63b0','#ff8fab']]
  ];
  const GFQ_TONES=[['ink','수묵','먹회색 · 살구빛 종이 · 금',['#efe8e1','#3a3d44','#c4a26a']],['porcelain','청화백자','쪽빛 · 백자',['#eef0ef','#1f3f6e','#a7adb8']],['celadon','청자','비색 · 청동',['#e9ede7','#4e7466','#a88a55']]];
  const gfqTone=w=>GFQ_TONES.some(t=>t[0]===w?.gfEastTone)?w.gfEastTone:'ink';
  const gfqTheme=w=>GFQ_THEMES.some(t=>t[0]===w?.gfTheme)?w.gfTheme:'modern';
  function gfqThemeHtml(w){
    const cur=gfqTheme(w);
    return '<div class="gfq-card"><b>화면 테마</b><p class="gfq-muted">이 월드의 장르에 맞는 모양을 고를 수 있습니다. 월드마다 따로 저장되며, 알림 팝업에도 같은 색이 쓰입니다.</p><div class="gfq-themes">'+
      GFQ_THEMES.map(([k,n,d,c])=>'<button class="gfq-theme" data-action="pick-theme" data-id="'+k+'" aria-pressed="'+(k===cur)+'"><span class="gfq-theme-sw" aria-hidden="true">'+c.map(x=>'<i style="background:'+x+'"></i>').join('')+'</span><b>'+n+'</b><small>'+d+'</small></button>').join('')+'</div>'+
      (cur==='east'?'<p class="gfq-muted">동양 테마 색조</p><div class="gfq-themes">'+GFQ_TONES.map(([k,n,d,c])=>'<button class="gfq-theme" data-action="pick-tone" data-id="'+k+'" aria-pressed="'+(k===gfqTone(w))+'"><span class="gfq-theme-sw" aria-hidden="true">'+c.map(x=>'<i style="background:'+x+'"></i>').join('')+'</span><b>'+n+'</b><small>'+d+'</small></button>').join('')+'</div>':'')+'</div>';
  }
  function render(){if(!panel)return;if(gfqHold){gfqHeldRender=true;return;}let w=current();if(currentTab==='assets'||currentTab==='items')currentTab='profile';const tabs=[['quests','퀘스트'],['profile','프로필'],['cast','인물'],['places','장소'],['calendar','일정'],['history','기록'],['settings','설정']];if(!tabs.some(t=>t[0]===currentTab))currentTab='quests';const label=tabs.find(t=>t[0]===currentTab)[1];const today=w?gfqCurrentDate(w):null;const empty='<div class="gfq-empty"><strong>월드를 먼저 골라 주세요</strong><span class="gfq-sub">게임에서 월드를 열면 자동으로 연결됩니다.</span></div>';
    const keep=panel.dataset.tab===currentTab?panel.querySelector('.gfq-main')?.scrollTop||0:0;
    // v0.7.7: a background re-render (new story data) must not wipe what the player is typing in the quest form.
    const f0=questEdit&&panel.querySelector('.gfq-qform'),draft=f0?{id:f0.dataset.id,v:[...f0.querySelectorAll('[data-f]')].map(e=>e.type==='checkbox'?e.checked:e.value)}:null;
    panel.innerHTML=gfqNoMatch(`<div class="gfq-frame"><aside class="gfq-side"><div class="gfq-brand"><span class="gfq-brand-mark" aria-hidden="true"></span><h2>퀘스트</h2><small>Gacha Forge</small></div><nav class="gfq-tabs">${tabs.map(([key,l])=>`<button class="${currentTab===key?'primary':''}" data-tab="${key}" ${currentTab===key?'aria-current="page"':''}><span class="gfq-tab-ic">${gfqIcon(key)}</span><span class="gfq-tab-l">${l}</span></button>`).join('')}</nav><div class="gfq-side-foot">${today?`<span>세계관 날짜</span><b class="gfq-num">${esc(today.date.replace(/-/g,'.'))}</b><span>${esc(gfqWeekday(today.date))}요일</span>`:'<span>세계관 날짜</span><b>미확인</b>'}<small>${gfqSyncHost()&&!gfqSyncMeta().off?'다른 기기와 동기화':'이 브라우저에만 저장'} · v0.12.0</small></div></aside><main class="gfq-main"><header class="gfq-top"><h2>${label}</h2><div class="gfq-worldbar">${worldSelect()}</div>${btn('✕','close','class="gfq-close" aria-label="닫기"')}</header><div id="gfq-content">${w?content(w):currentTab==='history'?`${btn('월드 연결 다시 시도','resync-world','class="primary"')}<p class="gfq-muted">현재 월드가 연결되지 않았습니다. 버튼을 눌러 연결 상태를 확인해 주세요.</p>${lastSyncError?'<div class="gfq-card">연결 진단: '+esc(lastSyncError)+'</div>':''}`:empty}</div></main></div>`);panel.dataset.tab=currentTab;panel.dataset.theme=gfqTheme(w);panel.dataset.tone=gfqTone(w);for(const b of [toastBox,questBox])if(b){b.dataset.theme=gfqTheme(w);b.dataset.tone=gfqTone(w);}if(keep){const m=panel.querySelector('.gfq-main');if(m)m.scrollTop=keep;}if(draft){const f1=panel.querySelector('.gfq-qform');const els=f1&&f1.dataset.id===draft.id?[...f1.querySelectorAll('[data-f]')]:[];if(els.length===draft.v.length)els.forEach((e,i)=>{if(e.type==='checkbox')e.checked=draft.v[i];else e.value=draft.v[i];});}}
  function content(w){switch(currentTab){case 'quests':return gfqLinkAuditHtml(w)+gfqRewardInbox(w)+gfqQuestsHtml(w);
  case 'profile':return gfqChangeCompareHtml(w)+gfqProfileHtml(w);
  case 'places':return gfqPlacesHtml(w);
  case 'cast':return gfqCastHtml(w);
  case 'calendar':return gfqDueAuditHtml(w)+gfqCalendarHtml(w);
  case 'history':return `${gfqChapterCards(w)}${btn('월드 표시 이름 수정','rename-display')} ${btn('월드 연결 다시 시도','resync-world','class="primary"')} ${w.gfRunId?btn('기존 스토리 목록 조회','scan-chapters','class="primary"')+'<p class="gfq-muted">연결된 게임 월드 ID: '+esc(w.gfRunId)+'</p>':'<p class="gfq-muted">아직 게임 월드와 연결되지 않았습니다.</p>'}${lastSyncError?'<div class="gfq-card">연결 진단: '+esc(lastSyncError)+'</div>':''}${chapterIndexHTML(w)}${aiReviewHtml(w)}<h3>변경 기록</h3>${w.history.slice(0,100).map(h=>`<div class="gfq-card"><span class="gfq-muted">${esc(h.at)}</span><div>${esc(h.text)}</div></div>`).join('')||'<div class="gfq-empty"><div class="gfq-empty-symbol">≡</div><strong>아직 기록이 없습니다</strong><span class="gfq-muted">항목을 수정하면 변경 이력이 남습니다.</span></div>'}`;
  case 'settings':return `${gfqThemeHtml(w)}${gfqCurrencyHtml(w)}${gfqStorageHtml(w)}${gfqSyncHtml()}${aiSettingsHTML()}${gfqWorldRulesHtml(w)}${gfqInjectHtml(w)}<p>현재 월드: <b>${esc(w.gfDisplayName||data.world)}</b></p>${btn('주입문 확인·복사','context-preview','class="primary"')}${btn('백업 내보내기','export')}${btn('백업 가져오기','import')+btn('자동 복원 지점','restore-auto')}${btn('월드 삭제','delete-world','class="gfq-danger"')}<p class="gfq-muted">데이터는 현재 브라우저의 로컬 저장소에 보관됩니다. 기기 간 자동 동기화는 지원하지 않으므로 백업 내보내기를 이용해 주세요.</p>`;}}
  const ask=(message,def='')=>gfqPrompt(message,def);
  const update=fn=>{const w=current();if(!w)return;fn(w);save();render();};
  const record=(w,text)=>{w.history.unshift({at:now(),text});w.history=w.history.slice(0,500);};
  function exportData(){const file=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const a=document.createElement('a');const url=URL.createObjectURL(file);a.href=url;a.download='quest-backup-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  function importData(){const inp=document.createElement('input');inp.type='file';inp.accept='.json,application/json';inp.onchange=async()=>{const f=inp.files?.[0];if(!f||f.size>2e6)return alert('2MB 이하의 JSON 파일만 지원합니다.');try{const d=JSON.parse(await f.text());if(d.v!==1||typeof d.worlds!=='object'||!d.worlds||Array.isArray(d.worlds))throw Error('백업 형식이 올바르지 않습니다.');for(const w of Object.values(d.worlds)){if(!Array.isArray(w.quests)||!Array.isArray(w.fields)||!Array.isArray(w.items)||!Array.isArray(w.history))throw Error('월드 데이터가 올바르지 않습니다.');}if(!(await gfqConfirm('현재 퀘스트 데이터를 백업 파일로 교체하시겠습니까?')))return;const previous=data;data=d;if(!save()){data=previous;return;}render();}catch(e){alert('가져오지 못했습니다: '+e.message);}};inp.click();}
  document.addEventListener('change',e=>{if(!panel||!panel.contains(e.target))return;if(e.target.id==='gfq-world'){data.world=e.target.value;save();render();}if(e.target.id==='gfq-filter'){activeFilter=e.target.value;render();}if(e.target.id==='gfq-ai-connection'){data.aiConnectionId=e.target.value;save();render();}if(e.target.id==='gfq-ai-mode'){data.aiMode=e.target.value;save();render();}if(e.target.id==='gfq-auto-apply'){data.autoApply=e.target.checked;save();render();}if(e.target.id==='gfq-scene-timed'){data.sceneTimed=e.target.checked;save();render();}if(e.target.id==='gfq-inject-on'){const w=current();if(w){if(!w.gfInject?.lorebookId){e.target.checked=false;alert('먼저 [스토리 반영용 로어북 만들기]를 눌러 주세요.');return;}w.gfInject.enabled=e.target.checked;record(w,'로어북 자동 반영 '+(e.target.checked?'켜기':'끄기'));save();render();if(e.target.checked)gfqInjectSync(true);}}if(e.target.id==='gfq-inject-limit'){const w=current();if(w){w.gfInject={...(w.gfInject||{}),limit:Math.max(150,Math.min(4000,Number(e.target.value)||600))};save();render();}}if(e.target.id==='gfq-ai-range'){data.aiRange=e.target.value;save();}if(e.target.id==='gfq-ask-stamp'){const w=current();if(w){w.gfAskStamp=e.target.checked;record(w,'날짜·시각 표기 요청 '+(e.target.checked?'켜기':'끄기'));save();render();}}if(e.target.id==='gfq-hero'){const w=current();if(w){gfqRuleCtx(w);w.protagonist=String(e.target.value||'').trim().slice(0,40);record(w,'주인공 이름 설정: '+(w.protagonist||'(비움)'));save();render();}}if(e.target.id==='gfq-legacy'){const w=current();if(w){gfqRuleCtx(w);w.gfRulePack=e.target.checked?GFQ_LEGACY_PACK:'';record(w,'기존 월드 전용 보정 규칙 '+(e.target.checked?'사용':'해제'));save();render();}}});
  document.addEventListener('click',e=>{if(panel&&!e.target.closest?.('.gfq-drop'))panel.querySelectorAll('.gfq-drop[open]').forEach(d=>d.open=false);});
  document.addEventListener('click',async e=>{const el=e.target.closest?.('#'+ID+'-panel [data-action],#'+ID+'-panel [data-tab]');if(!el)return;if(el.dataset.tab){currentTab=el.dataset.tab;render();return;}const act=el.dataset.action,id=el.dataset.id,w=current();
  if(act==='quest-filter'){questFilter=id;selectedQuest='';return render();}
  if(act==='quest-review-links'){const q=w.quests.find(x=>x.id===id);if(q)return gfqReviewQuestLinks(w,q);return;}
  if(act==='quest-branch-review'){const q=w.quests.find(v=>v.id===id);if(q)return gfqBranchReview(w,q);return;}
  if(act==='quest-branch-accept'){
    const q=w.quests.find(v=>v.id===id),i=Number(el.dataset.idx),x=w.gfBranchCandidates?.[id]?.[i];
    if(!q||!x)return;
    if(!(await gfqConfirm('스토리 원문과 실제 플레이어 선택을 확인하셨습니까?\n'+x.choice+'\n근거: '+x.quote)))return;
    return update(w=>{
      q.branchHistory||=[];if(!q.branchHistory.some(h=>h.quote===x.quote))q.branchHistory.push({at:now(),...x,status:'사용자 확인'});
      q.branchHistory=q.branchHistory.slice(-40);
      w.gfBranchCandidates[id].splice(i,1);record(w,'스토리 선택 승인: '+q.title+' · '+x.choice);
    });
  }
  if(act==='quest-branch-add'){
    const q=w.quests.find(x=>x.id===id);if(!q)return;
    const choice=(await ask('스토리에서 실제로 선택한 행동을 적어 주세요.',''));
    if(!choice?.trim())return;
    const note=(await ask('이 선택에 따른 목표 변경·새 의뢰 내용을 적어 주세요. (없으면 비워 주세요)',''));
    if(note===null)return;
    return update(w=>{
      q.branchHistory||=[];
      q.branchHistory.push({at:now(),choice:choice.trim().slice(0,200),note:note.trim().slice(0,400),status:'확인된 선택'});
      q.branchHistory=q.branchHistory.slice(-40);
      record(w,'스토리 선택 기록: '+q.title+' · '+choice.trim().slice(0,100));
    });
  }
  if(act==='quest-parent'){
    const q=w.quests.find(x=>x.id===id);if(!q)return;
    const options=gfqQuestParentOptions(w,q);
    if(!options.length)return alert('연결할 수 있는 퀘스트가 없습니다.');
    let parent=options.find(x=>x.id===String(e.target.closest('[data-parent]')?.dataset.parent||''));
    if(!parent){
      const input=(await ask('상위 퀘스트 번호를 선택해 주세요.\n'+options.map((x,i)=>(i+1)+'. '+x.title).join('\n'),''));
      if(input===null)return;
      const n=Number(input);if(!Number.isSafeInteger(n)||n<1||n>options.length)return alert('번호를 확인해 주세요.');
      parent=options[n-1];
    }
    const reviewed=(w.gfQuestLinkReviews?.[q.id]||[]).find(x=>x.parentId===parent.id);
    if(!(await gfqConfirm(q.title+'을(를) '+parent.title+'의 하위 퀘스트로 연결하시겠습니까?\n'+(reviewed?'관계: '+reviewed.type+'\n근거: '+reviewed.quote:'AI 근거가 확인되지 않은 수동 연결입니다. 서로 다른 의뢰가 아닌지 확인해 주세요.'))))return;
    return update(w=>{q.parentQuestId=parent.id;record(w,'퀘스트 연결: '+q.title+' → '+parent.title);});
  }
  if(act==='quest-unlink'){
    const q=w.quests.find(x=>x.id===id);if(!q?.parentQuestId)return;
    if(!(await gfqConfirm('상위 퀘스트 연결을 해제하시겠습니까?')))return;
    return update(w=>{delete q.parentQuestId;record(w,'퀘스트 연결 해제: '+q.title);});
  }
  if(act==='select-quest'){selectedQuest=id;questEdit='';return render();}
  if(act==='quest-edit'){questEdit=id;return render();}
  if(act==='quest-edit-cancel'){questEdit='';return render();}
  if(act==='quest-edit-save'){const q=w.quests.find(x=>x.id===id);const form=panel.querySelector('.gfq-qform');if(!q||!form)return;const r=gfqQuestFormRead(form,q);if(r.error)return alert(r.error);
    questEdit='';return update(w=>{const q=w.quests.find(x=>x.id===id);if(!q)return;const before=q.title;q.title=r.title;q.type=r.type;q.detail=r.detail;
      if(r.steps.length){q.steps=r.steps;q.stepDone=r.done;}else if(Array.isArray(q.steps)){delete q.steps;delete q.stepDone;}
      q.rewardDetails=r.rewards;q.editedAt=now();record(w,'퀘스트 직접 수정: '+before+(before!==r.title?' → '+r.title:''));});}
  if(act==='place-rename'||act==='cast-rename'){
    const isP=act==='place-rename',M=isP?(w.gfPlaces||{}):(w.gfCast||{}),x=M[id];if(!x)return;const keyOf=isP?gfqPlaceKey:gfqCastKey;
    const v=(await ask((isP?'장소':'인물')+' 이름을 입력해 주세요. 이미 있는 이름을 적으면 두 기록을 하나로 합칩니다.',x.name));if(v===null)return;const n=String(v).replace(/\s+/g,' ').trim().slice(0,60);if(!n||n===x.name)return;
    const nk=keyOf(n),tk=Object.keys(M).find(k=>k!==id&&(k===nk||keyOf(M[k].name)===nk));
    if(!tk)return update(w=>{const before=x.name;x.name=n;record(w,(isP?'장소':'인물')+' 이름 수정: '+before+' → '+n);});
    if(!(await gfqConfirm('\''+x.name+'\'의 기록을 \''+M[tk].name+'\'에 합치시겠습니까? 되돌릴 수 없으니 필요하면 먼저 백업해 주세요.')))return;
    return update(w=>{const t=M[tk],aliasKey=isP?'gfPlaceAlias':'gfCastAlias';
      if(isP){t.chapters=[...new Set([...(t.chapters||[]),...(x.chapters||[])])].sort((a,b)=>a-b);const sc=[...(t.scenes||[])];for(const s of x.scenes||[])if(!sc.some(o=>o.chapter===s.chapter&&o.index===s.index))sc.push(s);t.scenes=sc.sort((a,b)=>a.chapter-b.chapter||a.index-b.index).slice(-16);if(!t.url&&x.url)t.url=x.url;if(w.gfPlaceNow?.key===id)w.gfPlaceNow.key=tk;selectedPlace=tk;}
      else{t.sc={...(t.sc||{})};t.scp={...(t.scp||{})};for(const [k,c] of Object.entries(x.sc||{}))t.sc[k]=(t.sc[k]||0)+c;for(const [k,p] of Object.entries(x.scp||{}))if(!t.scp[k])t.scp[k]=p;if(x.note&&x.note!==t.note)t.note=[t.note,x.note].filter(Boolean).join('\n');const {name,sc,scp,note,...rest}=x;gfqMergeInto(t,rest);selectedCast=tk;}
      const A=w[aliasKey]||(w[aliasKey]={});A[id]=tk;for(const k of Object.keys(A))if(A[k]===id)A[k]=tk;delete M[id];record(w,(isP?'장소':'인물')+' 합치기: '+x.name+' → '+t.name);});}
  if(act==='place-delete'||act==='cast-delete'){
    const isP=act==='place-delete',M=isP?(w.gfPlaces||{}):(w.gfCast||{}),x=M[id];if(!x)return;
    if(!(await gfqConfirm('\''+x.name+'\' '+(isP?'장소':'인물')+' 기록을 삭제하시겠습니까?\n게임이 같은 이름을 다시 보내도 다시 추가하지 않습니다.')))return;
    return update(w=>{const aliasKey=isP?'gfPlaceAlias':'gfCastAlias',A=w[aliasKey]||(w[aliasKey]={});A[id]='';for(const k of Object.keys(A))if(A[k]===id)A[k]='';delete M[id];if(isP){if(w.gfPlaceNow?.key===id)delete w.gfPlaceNow;selectedPlace='';}else selectedCast='';record(w,(isP?'장소':'인물')+' 삭제: '+x.name);});}
  if(act==='ledger-edit'){const t=(w.gfLedger||[]).find(x=>x.id===id);if(!t)return;
    const name=(await ask('거래 이름을 입력해 주세요.',t.name));if(name===null)return;if(!String(name).trim())return alert('거래 이름을 비울 수 없습니다.');
    const amt=(await ask('금액('+(t.unit||gfqMainUnit(w))+')을 숫자로 입력해 주세요.',String(t.amount??'')));if(amt===null)return;const n=Number(String(amt).replace(/[,\s]/g,''));if(!Number.isFinite(n)||n<0)return alert('0 이상의 숫자로 입력해 주세요.');
    const nm=String(name).trim().slice(0,80);if(nm===t.name&&n===t.amount)return;
    const dup=(w.gfLedger||[]).find(x=>x.id!==t.id&&x.amount===n&&gfqUnit(x.unit)===gfqUnit(t.unit)&&x.name===nm);
    if(!(await gfqConfirm((dup?'같은 이름·금액의 거래가 이미 있습니다. 중복 기록이 아닌지 확인해 주세요.\n':'')+'거래를 \''+nm+' '+gfqAmount(n,t.unit)+'\'(으)로 고치시겠습니까?')))return;
    return update(w=>{const before=t.name+' '+gfqAmount(t.amount,t.unit),at=now();t.name=nm;t.amount=n;t.updatedAt=at;t.history||=[];t.history.push({at,state:t.state,amount:n,evidence:'직접 수정: '+before+' → '+nm+' '+gfqAmount(n,t.unit),source:'수동 확인'});record(w,'거래 수정: '+before+' → '+nm+' '+gfqAmount(n,t.unit));});}
  if(act==='pick-unit'){return update(w=>{if(id)w.gfCurrency=id;else delete w.gfCurrency;record(w,'주 화폐: '+(id||'자동 ('+gfqMainUnit(w)+')'));});}
  if(act==='pick-unit-custom'){const v=(await ask('주 화폐 단위를 적어 주세요. (예: 마석, 루피, 포인트)',w.gfCurrency||''));if(v===null)return;const u=String(v).trim().slice(0,12);return update(w=>{if(u)w.gfCurrency=u;else delete w.gfCurrency;record(w,'주 화폐: '+(u||'자동'));});}
  if(act==='pick-tone'){return update(w=>{w.gfEastTone=id;record(w,'동양 테마 색조: '+(GFQ_TONES.find(t=>t[0]===id)?.[1]||id));});}
  if(act==='pick-theme'){return update(w=>{w.gfTheme=id;record(w,'화면 테마: '+(GFQ_THEMES.find(t=>t[0]===id)?.[1]||id));});}
  if(act==='pick-world'){data.world=id;save();return render();}
  if(act==='sync-now'){gfqSyncNote='';(async()=>{await gfqSyncPull('manual');await gfqSyncPush(true);render();})();return;}
  if(act==='sync-toggle'){const off=!gfqSyncMeta().off;gfqSyncSetMeta({off});if(!off)gfqSyncPull('manual');return render();}
  if(act==='sync-undo'){let b;try{b=JSON.parse(localStorage.getItem(GFQ_SYNC_BACKUP)||'null');}catch{}if(!b?.json)return alert('되돌릴 기록이 없습니다.');if(!(await gfqConfirm(new Date(b.at).toLocaleString('ko-KR')+'에 합치기 직전 이 기기 기록으로 되돌리시겠습니까? 되돌린 기록이 서버에도 올라갑니다.')))return;let d;try{d=JSON.parse(b.json);}catch{return alert('보관된 기록을 읽지 못했습니다.');}const prev=data;data=d;if(!save()){data=prev;return;}localStorage.removeItem(GFQ_SYNC_BACKUP);gfqSyncPush(true);return render();}
  if(act==='storage-clean'){const pl=gfqStoragePlan(w);if(!pl.samples&&!pl.history)return alert('정리할 항목이 없습니다.');if(!(await gfqConfirm('스토리 장면 '+pl.samples+'개와 오래된 변경 기록 '+pl.history+'개를 지우시겠습니까?\n퀘스트·거래·인물·장소는 지우지 않습니다. 먼저 백업 내보내기를 권해 드립니다.')))return;return update(w=>{if(pl.samples){const keep=new Set(pl.keep);w.gfStorySamples=(w.gfStorySamples||[]).filter(x=>keep.has(Number(x.chapter)));}record(w,'저장 공간 정리: 장면 '+pl.samples+'개, 기록 '+pl.history+'개');w.history=w.history.slice(0,200);});}
  if(act==='cash-base'){const cur=w.gfCashBase?.amount;const v=(await ask('이야기를 시작할 때 주인공이 가진 돈('+gfqMainUnit(w)+')을 숫자로 입력해 주세요. 거래 내역의 입금 확인과 지출을 더하고 빼서 현재 소지금을 계산합니다.',cur!=null?String(cur):''));if(v===null)return;const n=Number(String(v).replace(/[,\s원]/g,''));if(!Number.isFinite(n)||n<0)return alert('0 이상의 숫자로 입력해 주세요.');return update(w=>{w.gfCashBase={amount:Math.round(n),unit:gfqMainUnit(w),at:now()};record(w,'시작 소지금 설정: '+gfqAmount(Math.round(n),gfqMainUnit(w)));});}
  if(act==='place-page'){placePage=id;selectedPlace='';return render();}
  if(act==='cast-filter'){castFilter=id;selectedCast='';return render();}
  if(act==='select-cast'){selectedCast=id;return render();}
  if(act==='cast-outfit'){const c=w.gfCast?.[id];if(!c)return;const o=el.dataset.o||'';return update(w=>{if(o)w.gfCast[id].pick=o;else delete w.gfCast[id].pick;});}
  if(act==='cast-note'){const c=w.gfCast?.[id];if(!c)return;const v=(await ask(c.name+'에 대한 메모를 적어 주세요. (비우면 지워집니다)',c.note||''));if(v===null)return;return update(w=>{const t=String(v).trim().slice(0,300);if(t)w.gfCast[id].note=t;else delete w.gfCast[id].note;});}
  if(act==='cal-day'){calDay=id;return render();}
  if(act==='cal-month'){calMonth=id;calDay=el.dataset.day||'';return render();}
  if(act==='equip-type'){
    const it=w.items.find(x=>x.id===id);if(!it||it.kind==='voucher')return;
    const input=(await ask('물품 종류 번호를 선택해 주세요.\n'+GFQ_EQUIP_TYPES.map((v,i)=>(i+1)+'. '+v).join('\n'),String(Math.max(0,GFQ_EQUIP_TYPES.indexOf(gfqEquipType(it)))+1)));
    if(input===null)return;
    const n=Number(input);if(!Number.isSafeInteger(n)||n<1||n>GFQ_EQUIP_TYPES.length)return alert('물품 종류 번호를 확인해 주세요.');
    return update(w=>{it.equipType=GFQ_EQUIP_TYPES[n-1];if(!gfqIsEquipment(it))it.equipped=false;record(w,'물품 종류 변경: '+it.name+' · '+it.equipType);});
  }
  if(act==='equip-edit'){
    const it=w.items.find(x=>x.id===id);if(!it||it.kind==='voucher'||!gfqIsEquipment(it))return;
    const slot=(await ask('장비 착용 부위 (예: 무기, 머리, 몸, 손, 발, 장신구)',it.equipSlot||''));
    if(slot===null)return;
    const options=(await ask('장비 옵션 및 효과를 입력해 주세요. (예: 방어력 +5, 냉기 저항)',it.equipOptions||''));
    if(options===null)return;
    return update(w=>{it.equipSlot=slot.trim().slice(0,60);const old=it.equipOptions||'',next=options.trim().slice(0,1200);if(old!==next){it.gearOptionVersions||=[];it.gearOptionVersions.push({at:now(),before:old,after:next,evidence:'사용자 직접 변경'});it.gearOptionVersions=it.gearOptionVersions.slice(-25);}it.equipOptions=next;record(w,'장비 옵션 수정: '+it.name);});
  }
  if(act==='equip-toggle'){
    const it=w.items.find(x=>x.id===id);if(!it||it.kind==='voucher'||it.state==='pending'||!gfqIsEquipment(it))return;
    return update(w=>{
      if(!it.equipped&&it.equipSlot)for(const other of w.items)if(other.id!==it.id&&other.equipSlot===it.equipSlot&&other.equipped){other.equipped=false;record(w,'장비 교체·착용 해제: '+other.name);}
      it.equipped=!it.equipped;
      it.gearHistory||=[];it.gearHistory.push({at:now(),stage:it.equipped?'착용':'착용 해제',evidence:'사용자 직접 확인',source:'수동'});it.gearHistory=it.gearHistory.slice(-30);record(w,'장비 '+(it.equipped?'착용':'해제')+': '+it.name);
    });
  }
  if(act==='restore-auto')return gfqRestoreSnapshots();
  if(act==='item-filter'){itemFilter=id;selectedItem='';return render();}
  if(act==='select-item'){selectedItem=id;return render();}
  if(act==='select-place'){const same=currentTab==='places';selectedPlace=id;currentTab='places';render();if(same){const c=panel.querySelector('.gfq-placecard');if(c&&c.scrollIntoView)c.scrollIntoView({block:'nearest'});}return;}
  if(act==='open-quest'){selectedQuest=id;questFilter='전체';currentTab='quests';return render();}
  if(act==='load-places'){if(!w.gfRunId)return alert('게임 월드와 아직 연결되지 않았습니다. 게임에서 월드를 연 뒤 다시 눌러 주세요.');el.disabled=true;gfqApi('/api/gacha-forge/locations','POST',{runId:w.gfRunId}).then(r=>{gfqRememberPlaces(w.gfRunId,r,'/api/gacha-forge/locations',{});if(!Object.keys(r?.places||{}).length)alert('게임에 저장된 배경 장소가 없습니다. 챕터를 열면 장면별 장소가 자동으로 기록됩니다.');render();}).catch(e=>{el.disabled=false;alert('장소를 불러오지 못했습니다: '+e.message);});return;}
  if(act==='close')return openPanel();if(act==='resync-world')return syncWorld();if(act==='new-world'){const name=(await ask('새 월드 이름'));if(name===null)return;const key=name.trim();if(!key||key.length>100)return alert('1~100자로 입력해 주세요.');if(data.worlds[key])return alert('이미 존재하는 월드입니다.');data.worlds[key]=blank();data.world=key;save();return render();}if(!w)return;
  if(act==='rename-display'){const label=(await ask('표시할 월드 이름을 입력해 주세요.',w.gfDisplayName||data.world));if(!label?.trim())return;w.gfDisplayName=label.trim().slice(0,100);save();render();return;}
  if(act==='add-quest'){const title=(await ask('퀘스트 이름'));if(!title?.trim())return;const type=(await ask('종류: 일일 / 주간 / 의뢰 / 업적','의뢰'));if(!['일일','주간','의뢰','업적'].includes(type))return alert('올바른 퀘스트 종류가 아닙니다.');const detail=(await ask('조건 및 설명',''));if(detail===null)return;const count=Number((await ask('목표 횟수 (1 이상)','1')));if(!Number.isSafeInteger(count)||count<1)return alert('목표 횟수를 확인해 주세요.');const reward=(await ask('보상 메모 (게임 재화로 자동 지급되지 않습니다)',''));if(reward===null)return;return update(w=>{w.quests.push({id:uid(),title:title.trim(),type,detail,target:count,progress:0,reward,claimed:false});record(w,'퀘스트 등록: '+title);});}
  if(act==='inject-create'){
    if(w.gfInject?.lorebookId&&!(await gfqConfirm('새 로어북을 만들어 연결합니다. 가챠 포지 설정의 월드 로어북도 새 로어북으로 바꿔 주셔야 합니다. 계속하시겠습니까?')))return;
    (async()=>{try{await gfqInjectCreate(w);save();render();
      if((await gfqConfirm('로어북을 만들었습니다: '+w.gfInject.lorebookName+'\n\n이어서 이 월드의 가챠 포지 로어북 설정에 자동으로 연결할까요? (기존 로어북은 그대로 두고 맨 앞에 추가, 스토리 장면에도 사용)'))){try{await gfqInjectConnect(w,true);render();gfqToast('가챠 포지 연결','다음 챕터·장면부터 퀘스트 현황이 반영됩니다','info');}catch(e){alert('자동 연결에 실패했습니다: '+(e.message||e)+'\n가챠 포지 설정 → 월드 로어북에 직접 추가하고, 로어북을 스토리 장면에도 사용하는 설정을 켜 주세요.');}}
    }catch(e){alert('로어북을 만들지 못했습니다: '+(e.message||e)+(e.status===403?'\n\n원격 접속에서는 마리나라 설정 → 고급 → Admin Access가 필요합니다.':''));}})();
    return;
  }
  if(act==='inject-connect'||act==='inject-disconnect'){
    const on=act==='inject-connect';
    if(on&&!(await gfqConfirm('이 월드의 가챠 포지 로어북 설정에 \''+(w.gfInject?.lorebookName||'')+'\'을(를) 맨 앞에 추가하고, 로어북을 스토리 장면에도 사용하도록 켭니다. 기존 로어북과 예산은 그대로 둡니다. 진행하시겠습니까?')))return;
    (async()=>{try{await gfqInjectConnect(w,on);render();gfqToast(on?'가챠 포지 연결':'연결 해제',on?'다음 챕터·장면부터 퀘스트 현황이 반영됩니다':'로어북 설정을 연결 전으로 되돌렸습니다','info');}catch(e){alert((on?'자동 연결':'연결 해제')+'에 실패했습니다: '+(e.message||e)+(e.status===403?'\n\n원격 접속에서는 마리나라 설정 → 고급 → Admin Access가 필요합니다.':'')+'\n\n가챠 포지 설정의 월드 로어북에서 직접 '+(on?'추가':'제거')+'해 주세요.');}})();
    return;
  }
  if(act==='inject-now'){(async()=>{const ok=await gfqInjectSync(true);alert(ok?'로어북에 현재 현황을 반영했습니다.':'반영하지 못했습니다: '+(w.gfInject?.error||''));})();return;}
  if(act==='date-set'||act==='date-next'||act==='time-next'){
    const c=gfqCurrentDate(w),k=gfqCurrentClock(w),latest=gfqLatestChapter(w,c);
    let date=null,clock=null,label='';
    if(act==='date-next'){if(!c)return;date=gfqAddDays(c.date,1);label='하루 경과';}
    else if(act==='time-next'){
      // next period of the day; past 심야 the next day's 새벽
      if(!c)return;const i=k?GFQ_PERIODS.indexOf(k.period):-1,next=GFQ_PERIODS[(i+1)%GFQ_PERIODS.length];
      clock={period:i<0?'아침':next};if(i===GFQ_PERIODS.length-1)date=gfqAddDays(c.date,1);label='시간 경과';
    }else{
      const ans=(await ask('세계관 현재 날짜와 시각을 입력해 주세요.\n예: 2033-04-08 · 2033년 4월 8일 오후 3시 · 4월 9일 저녁 · 오후 6시 · 제국력 312년 4월 9일',c?(c.date+(k?' '+gfqClockText(k):'')):''));if(ans===null)return;
      date=gfqDatesIn(ans)[0]||null;
      if(!date){const m=ans.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/u);if(m)date=gfqResolveStamp({md:[+m[1],+m[2]]},c?.date||null,null,w.gfDateAnchor?.date||null);}
      const rest=ans.replace(/(?:[가-힣]{1,5}(?:력|기)\s*)?\d{1,4}\s*(?:년\s*|[-./])\s*\d{1,2}\s*(?:[-./]|월\s*)\s*\d{1,2}\s*일?|\d{1,2}\s*월\s*\d{1,2}\s*일/u,'');
      clock=gfqTimeIn(rest,k?.period||'')||(gfqPeriodIn(rest)?{period:gfqPeriodIn(rest)}:null);
      if(!date&&!clock)return alert('날짜(YYYY-MM-DD 또는 M월 D일)나 시각(오후 3시, 저녁 등)을 입력해 주세요.');
      if(!date&&!c)return alert('먼저 날짜를 정해 주세요. (예: 2033-04-08 오후 3시)');
      const era=gfqEraIn(ans);if(era)w.gfEra=era;
      label='직접 입력';
    }
    const ms=Date.now(),day=date||c.date;
    update(w=>{
      if(date&&act==='date-set')gfqRebase(w,date);
      if(date)w.gfDateManual={date,chapter:latest,at:now(),ms,...(clock||{})};
      if(clock)w.gfTimeManual={...clock,date:day,chapter:latest,at:now(),ms:ms+1};
      record(w,'세계관 '+(date?'날짜':'시각')+' '+label+': '+(date?date:'')+(clock?(date?' ':'')+gfqClockText(clock):''));
    });
    if(date)gfqDueToast(w,date);return;
  }
  if(act==='date-auto'){
    const c=gfqCurrentDate(w);
    if(c&&!/추정/.test(c.basis)&&!(await gfqConfirm('원문이나 직접 입력으로 정한 날짜('+gfqDateText(w,c.date)+')가 있습니다. 그래도 세계관에 맞게 다시 정할까요?')))return;
    (async()=>{
      let g=null,how='';
      if(String(data.aiConnectionId||'').trim()){
        gfqToast('날짜 정하는 중','세계관 설정과 스토리를 보고 날짜를 고르고 있습니다','date');
        try{g=await gfqAiWorldDate(w);how='AI';}catch(e){how='자동 (AI 실패: '+String(e?.message||e).slice(0,60)+')';}
      }
      if(!g){g=gfqGuessWorldDate(w);how=how||'자동';}
      if(!g?.date)return alert('날짜를 정하지 못했습니다. 직접 입력해 주세요.');
      const show=(g.era?g.era+' '+(+g.date.slice(0,4))+'년 '+(+g.date.slice(5,7))+'월 '+(+g.date.slice(8,10))+'일':gfqDateText(w,g.date))+(g.era?'':' ('+gfqWeekday(g.date)+')')+(gfqClockOf(g)?' '+gfqClockText(gfqClockOf(g)):'');
      if(!(await gfqConfirm('세계관에 맞춰 고른 날짜 ('+how+')\n\n'+show+'\n'+(g.reason?'근거: '+g.reason+'\n':'')+'\n이 날짜로 정할까요? 원문에 날짜가 나오면 원문이 우선합니다.')))return;
      const latest=gfqLatestChapter(w,c);
      update(w=>{
        if(g.era)w.gfEra=g.era;
        if(!w.gfDateAnchor)gfqSetAnchor(w,g,latest||'','ai');
        const ms=Date.now(),k=gfqClockOf(g);
        w.gfDateManual={date:g.date,chapter:latest,at:now(),ms,by:'ai',...(g.reason?{reason:g.reason}:{}),...(k||{})};
        record(w,'세계관 날짜 지정 ('+how+'): '+g.date+(k?' '+gfqClockText(k):'')+(g.reason?' · '+g.reason:''));
      });
      gfqToast('날짜 지정',show,'date');gfqDueToast(w,g.date);
    })();
    return;
  }
  if(act==='undo-auto'){if(!w.gfUndo)return;if(!(await gfqConfirm('마지막 자동 반영('+w.gfUndo.count+'개) 직전 상태로 퀘스트·자산·소지품·거래 내역·검토 목록을 되돌리시겠습니까? 그 이후 직접 수정한 내용도 함께 되돌아갑니다.')))return;try{const s=JSON.parse(w.gfUndo.snap);Object.assign(w,s);delete w.gfUndo;record(w,'마지막 자동 반영을 되돌렸습니다.');save();render();}catch(e){alert('되돌리지 못했습니다: '+e.message);}return;}
  if(act==='money-rescan'){w.gfMissingMoney=gfqMissingMoney(w);save();render();return alert('누락 의심 금액 '+w.gfMissingMoney.length+'개를 찾았습니다.');}
  if(act==='money-fill-ledger'){
    const m=(w.gfMissingMoney||[])[Number(el.dataset.idx)];if(!m)return;
    const open=(w.gfLedger||[]).filter(t=>t.amount===null);if(!open.length)return;
    const ans=(await ask('이 금액('+gfqAmount(m.amount,m.unit||'원')+')이 어느 거래의 금액인지 번호를 입력해 주세요. 상태(입금 여부)는 바뀌지 않습니다.\n'+m.sentence.slice(0,160)+'\n\n'+open.map((t,i)=>(i+1)+': '+t.name+' · '+gfqLabel('money',t.state)+(t.history?.[0]?.source?' · '+t.history[0].source:'')).join('\n'),'1'));
    if(ans===null)return;const t=open[Number(ans)-1];if(!t)return alert('번호를 확인해 주세요.');
    t.amount=m.amount;t.unit=t.unit||m.unit||'원';t.history||=[];t.history.push({at:now(),state:t.state,amount:m.amount,evidence:m.sentence,source:m.source,note:'금액 보완'});
    record(w,'거래 금액 보완: '+t.name+' → '+gfqAmount(m.amount,m.unit||'원')+' · '+m.source);
    w.gfMissingMoney=w.gfMissingMoney.filter(v=>v!==m);gfqRelinkQuestRewards(w);save();render();return;
  }
  if(act==='money-dismiss'){const m=(w.gfMissingMoney||[])[Number(el.dataset.idx)];if(!m)return;w.gfMoneyDismissed||=[];w.gfMoneyDismissed.push(m.amount);w.gfMissingMoney=w.gfMissingMoney.filter(v=>v!==m);save();render();return;}
  if(act==='money-to-candidate'){
    const m=(w.gfMissingMoney||[])[Number(el.dataset.idx)];if(!m)return;
    const name=(await ask('거래 이름을 입력해 주세요.\n'+m.sentence,''));if(!name?.trim())return;
    const state=(await ask('상태 코드를 입력해 주세요.\npending: 지급 예정 / receivable: 미수금 / received: 입금 확인 / paid: 지출',"pending"));
    if(state===null)return;if(!['pending','receivable','received','paid'].includes(state.trim()))return alert('올바른 상태 코드를 입력해 주세요.');
    const p=gfqBuildProposal({category:'asset',name:name.trim(),status:'confirmed',financialStatus:state.trim(),amount:m.amount,unit:m.unit||'원',owner:'player',source:m.source,eventKind:state.trim()==='paid'?'expense':'payment'},m.sentence,gfqRuleCtx(w));
    p.auditNote=[p.auditNote,'누락 의심 금액에서 직접 추가한 후보입니다.'].filter(Boolean).join(' ');
    w.aiProposals||=[];w.aiProposals.push(p);w.gfMissingMoney=w.gfMissingMoney.filter(v=>v!==m);save();render();return;
  }
  if(act==='use-voucher'){const it=w.items.find(x=>x.id===id&&x.kind==='voucher');if(!it||it.qty<1)return;const where=(await ask('어디에 사용하셨는지 적어 주세요. (예: 챕터 5 · 건틀릿 강화 공임)',''));if(where===null)return;return update(w=>{it.qty-=1;record(w,'이용권 사용: '+it.name+' (남은 횟수 '+it.qty+')'+(where.trim()?' · '+where.trim():''));});}
  if(act==='receive-item'){const it=w.items.find(x=>x.id===id&&x.state==='pending');if(!it)return;const ev=(await ask('수령을 확인한 근거를 입력해 주세요. (예: 챕터 4 · 장면 2에서 건틀릿을 받음)',''));if(!ev?.trim())return alert('수령 근거가 필요합니다.');return update(w=>{delete it.state;it.receivedAt=now();gfqGearStage(it,{evidence:ev.trim(),source:'수동 확인'},'수령 완료');record(w,'물품 수령 확인(수동): '+it.name+' · '+ev.trim());});}
  if(act==='reward-to-ledger'){const q=w.quests.find(x=>x.id===id),i=Number(el.dataset.idx),r=q?.rewardDetails?.[i];if(!r)return;if(!(await gfqConfirm('퀘스트 보상 \''+r.name+' '+gfqAmount(r.amount,r.unit)+'\'을(를) 거래 내역에 '+gfqLabel('certainty',r.certainty)+' 상태로 기록하시겠습니까? 같은 금액의 거래가 이미 있으면 기존 거래에 연결됩니다.')))return;return update(w=>{const hits=(w.gfLedger||[]).filter(t=>t.amount===r.amount&&t.unit===String(r.unit||''));if(hits.length===1){r.txId=hits[0].id;record(w,'퀘스트 보상 거래 내역 연결: '+r.name+' → '+hits[0].name);}else if(hits.length>1){alert('같은 금액의 거래가 여러 건 있어 자동으로 연결하지 않았습니다. 프로필 탭의 거래 내역에서 해당 거래를 확인해 주세요.');}else gfqRewardToLedger(w,q,i);});}
  if(act==='toggle-step'){const i=Number(el.dataset.step);return update(w=>{const q=w.quests.find(x=>x.id===id);if(!q||!Array.isArray(q.steps)||!Number.isSafeInteger(i)||i<0||i>=q.steps.length)return;q.stepDone=q.steps.map((_,k)=>q.stepDone?.[k]===true);q.stepDone[i]=!q.stepDone[i];record(w,'세부 목표 '+(q.stepDone[i]?'완료':'완료 취소')+': '+q.title+' · '+q.steps[i]);});}
  if(act==='increment'||act==='complete'){return update(w=>{const q=w.quests.find(x=>x.id===id);if(!q||q.claimed)return;q.progress=act==='complete'?q.target:Math.min(q.target,q.progress+1);if(act==='complete'){q.claimed=true;gfqAwardQuestReputation(w,q);record(w,'퀘스트 완료: '+q.title+' / '+q.reward);}else record(w,'진행도 변경: '+q.title+' '+q.progress+'/'+q.target);});}
  if(act==='delete-quest'){const q=w.quests.find(x=>x.id===id);if(!q||!(await gfqConfirm('퀘스트를 삭제하시겠습니까?')))return;return update(w=>{w.quests=w.quests.filter(x=>x.id!==id);for(const child of w.quests)if(child.parentQuestId===id)delete child.parentQuestId;for(const k of ['gfQuestLinkReviews','gfQuestLinkChecked','gfBranchCandidates'])if(w[k])delete w[k][id];for(const m of Object.values(w.gfQuestLinkReviews||{}))if(Array.isArray(m))for(let j=m.length-1;j>=0;j--)if(m[j].parentId===id)m.splice(j,1);record(w,'퀘스트 삭제 및 하위 연결 해제: '+q.title);});}
  if(act==='add-field'||act==='edit-field'){const f=act==='edit-field'?w.fields.find(x=>x.id===id):null;const name=(await ask('필드 이름',f?.name||''));if(!name?.trim())return;const value=(await ask('필드 값',f?.value||''));if(value===null)return;const unit=(await ask('단위 (없으면 빈칸)',f?.unit||''));if(unit===null)return;return update(w=>{if(f){record(w,`${f.name}: ${f.value} → ${value}`);Object.assign(f,{name:name.trim(),value,unit});}else{w.fields.push({id:uid(),name:name.trim(),value,unit});record(w,'필드 추가: '+name);}});}
  if(act==='delete-field'){const f=w.fields.find(x=>x.id===id);if(!f||!(await gfqConfirm('필드를 삭제하시겠습니까?')))return;return update(w=>{w.fields=w.fields.filter(x=>x.id!==id);record(w,'필드 삭제: '+f.name);});}
  if(act==='add-item'||act==='edit-item'){const it=act==='edit-item'?w.items.find(x=>x.id===id):null;const name=(await ask('소지품 이름',it?.name||''));if(!name?.trim())return;const qty=Number((await ask('수량 (0 이상)',String(it?.qty??1))));if(!Number.isSafeInteger(qty)||qty<0)return alert('수량은 0 이상의 정수여야 합니다.');return update(w=>{if(it){record(w,`소지품 수정: ${it.name} ${it.qty} → ${qty}`);Object.assign(it,{name:name.trim(),qty});}else{w.items.push({id:uid(),name:name.trim(),qty});record(w,'소지품 추가: '+name);}});}
  // v0.12.0: use an owned item (one fewer); whatever came out of it (e.g. a box holding a dagger) is added.
  if(act==='item-use'){
    const it=w.items.find(x=>x.id===id);if(!it||it.state==='pending'||it.kind==='voucher')return;
    const out=(await ask(it.name+'을(를) 하나 사용합니다.\n안에서 나온 물건이 있으면 적어 주세요. 여러 개는 쉼표로 구분하고, 없으면 비워 두세요. (예: 단도, 편지)',''));if(out===null)return;
    const got=String(out).split(/[,，、]/).map(t=>t.replace(/\s+/g,' ').trim().slice(0,100)).filter(Boolean).slice(0,10);
    return update(w=>{
      const left=Math.max(0,(Number(it.qty)||1)-1);
      if(left)it.qty=left;else w.items=w.items.filter(x=>x.id!==it.id);
      for(const name of got){const same=w.items.find(i=>i.name===name&&i.state!=='pending'&&i.kind!=='voucher');if(same)same.qty=(Number(same.qty)||0)+1;else w.items.push({id:uid(),name,qty:1,source:'사용: '+it.name});}
      if(!left&&selectedItem===it.id)selectedItem=got.length?(w.items.find(i=>i.name===got[0])?.id||''):'';
      record(w,'소지품 사용: '+it.name+(left?' (남은 '+left+'개)':'')+(got.length?' → 나온 물건: '+got.join(', '):''));
    });
  }
  if(act==='delete-item'){const it=w.items.find(x=>x.id===id);if(!it||!(await gfqConfirm('소지품을 삭제하시겠습니까?')))return;return update(w=>{w.items=w.items.filter(x=>x.id!==id);record(w,'소지품 삭제: '+it.name);});}
  if(act==='resync-world')return syncWorld();if(act==='scan-chapters')return scanExistingChapters();if(['select-all-ai','unselect-all-ai','delete-selected-ai','delete-all-ai','approve-selected-ai'].includes(act)){
    const checks=[...panel.querySelectorAll('.gfq-ai-check')],selected=checks.filter(x=>x.checked).map(x=>x.value);
    if(act==='select-all-ai'||act==='unselect-all-ai'){checks.forEach(x=>x.checked=act==='select-all-ai');return;}
    const ids=act==='delete-all-ai'?(w.aiProposals||[]).map(x=>x.id):selected;
    if(!ids.length)return alert('먼저 항목을 선택해 주세요.');
    if(act==='approve-selected-ai'){
      if(!(await gfqConfirm(ids.length+'개 항목 중 검증 가능한 항목만 반영하시겠습니까? 불확실하거나 타인 소유인 항목은 제외됩니다.')))return;
      let applied=0;for(const candidateId of ids)if(approveAiProposal(candidateId,true))applied++;
      save();render();alert(applied+'개 항목을 승인했습니다. 반영할 수 없는 항목은 검토 목록에 남겨 두었습니다.');return;
    }
    if(!(await gfqConfirm(ids.length+'개의 AI 분석 후보를 삭제하시겠습니까? 이미 승인한 기록이나 게임 저장 데이터는 삭제하지 않습니다.')))return;
    const target=new Set(ids);w.aiProposals=(w.aiProposals||[]).filter(x=>!target.has(x.id));save();render();return;
  }if(act==='ledger-update'){
    const t=(w.gfLedger||[]).find(x=>x.id===id);if(!t)return;
    const state=(await ask('거래 상태 코드를 입력해 주세요.\npending: 지급 예정 / receivable: 미수금 / received: 입금 확인 / paid: 지출 / waived: 면제 / ownership: 지분·소유',t.state));
    if(state===null)return;if(!GFQ_MONEY_STATES.includes(state))return alert('올바른 상태를 입력해 주세요.');
    const evidence=(await ask('상태 변경의 근거를 입력해 주세요.',''));
    if(!evidence?.trim())return alert('변경 근거가 필요합니다.');
    if(!(await gfqConfirm('거래 '+t.name+'의 상태를 '+state+'(으)로 변경하시겠습니까?')))return;
    const at=now();t.state=state;t.updatedAt=at;t.history||=[];t.history.push({at,state,amount:t.amount,evidence:evidence.trim(),source:'수동 확인'});save();render();return;
  }if(act==='invoke-quest-bridge')return invokeQuestBridge();if(act==='prepare-ai-prompt')return prepareAiPrompt();if(act==='import-ai-result')return importAiResult();if(act==='approve-ai-proposal')return approveAiProposal(id);if(act==='remove-ai-proposal'){w.aiProposals=w.aiProposals.filter(x=>x.id!==id);save();render();return;}if(act==='refresh-ai-connections')return refreshAiConnections();if(act==='context-preview')return copyQuestContext();if(act==='export')return exportData();if(act==='import')return importData();if(act==='delete-world'){if(!(await gfqConfirm('현재 월드의 퀘스트 데이터를 삭제하시겠습니까? 게임 원본 저장 데이터에는 영향을 주지 않습니다.')))return;delete data.worlds[data.world];data.world=Object.keys(data.worlds)[0]||'';save();render();}
  });
  gfqSaveBaseline();
  mount();setTimeout(()=>gfqSyncPull('start').finally(()=>gfqSyncStartDone?.()),600);document.addEventListener('visibilitychange',()=>{if(document.hidden){if(gfqSyncMeta().dirty&&!gfqSyncBusy){if(gfqSyncT){clearTimeout(gfqSyncT);gfqSyncT=0;}gfqSyncPush();}}else gfqSyncPull('visible');});setTimeout(refreshAiConnections,900);setTimeout(syncWorld,1200);worldSyncTimer=null;const mo=new MutationObserver(()=>{if(!document.hidden&&findHost()!==gameHost)mount();});mo.observe(document.documentElement,{childList:true,subtree:false});
  const sync=setInterval(()=>{if(document.hidden)return;if(!gameHost || !gameHost.isConnected || !getButton())mount();},12000);
  // Re-promote dialog to the browser top layer after entering or exiting fullscreen.
  let fsRefresh=null;
  function refreshFullscreenDialog(){
    gfqToastPlace();
    for(const b of [toastBox,questBox]){try{if(b&&b.children.length){if(b.matches(':popover-open'))b.hidePopover();b.showPopover();}}catch{}}
    if(!(panel&&panel.isConnected)&&!gfqDialogs.size)return;
    if(fsRefresh)clearTimeout(fsRefresh);
    fsRefresh=setTimeout(()=>{fsRefresh=null;
      // Panel first, then any open question dialogs so they stay on top of it.
      for(const d of [panel,...gfqDialogs]){if(!d||!d.isConnected)continue;try{if(d.open)d.close();d.showModal();}catch(e){console.warn('[퀘스트] 전체화면 팝업 복원 실패',e);}}
    },75);
  }
  document.addEventListener('fullscreenchange',refreshFullscreenDialog);
  document.addEventListener('webkitfullscreenchange',refreshFullscreenDialog);
  window.addEventListener('pagehide',()=>{if(injectTimer)clearTimeout(injectTimer);if(autoTimer)clearTimeout(autoTimer);if(sceneRecheck)clearTimeout(sceneRecheck);document.removeEventListener('fullscreenchange',refreshFullscreenDialog);document.removeEventListener('webkitfullscreenchange',refreshFullscreenDialog);if(fsRefresh)clearTimeout(fsRefresh);if(worldSyncTimer)clearInterval(worldSyncTimer);mo.disconnect();if(gameObserver)gameObserver.disconnect();if(gameDebounce)clearTimeout(gameDebounce);clearInterval(sync);});
})();
