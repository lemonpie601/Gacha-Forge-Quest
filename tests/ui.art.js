// v0.12.0: gallery pictures stored as .png/.jpg are retried as .webp after Marinara's webp conversion (needs jsdom): node tests/ui.art.js
const {JSDOM}=require('jsdom'),fs=require('fs'),assert=require('assert');
const src=fs.readFileSync(process.argv[2]||require('path').join(__dirname,'..','extension.js'),'utf8');
const dom=new JSDOM('<!doctype html><body></body>',{url:'https://local.test/gacha-forge',runScripts:'outside-only'});
const win=dom.window,doc=win.document;
win.HTMLDialogElement.prototype.showModal=function(){this.open=true};win.HTMLDialogElement.prototype.close=function(){this.open=false};
win.__gfqNativeDialogs=true;win.alert=()=>{};win.confirm=()=>true;win.prompt=()=>null;
win.fetch=async()=>({ok:false,status:404,json:async()=>({}),headers:{get:()=>''}});
const world={quests:[],fields:[],items:[],history:[],gfRunId:'run-x',gfDisplayName:'신선무협',
  gfCast:{'석란':{name:'석란',art:'/api/global-gallery/file/5kkgBZEKs0nbNjSAuKV9U.png',chapters:[3],scenes:[{chapter:3,index:2}]},
    '유':{name:'유',roster:true,art:'/api/global-gallery/file/IrBq.webp',chapters:[3],scenes:[{chapter:3,index:2}]}}};
win.localStorage.setItem('gf-quest-v1',JSON.stringify({v:1,world:'신선무협',worlds:{'신선무협':world}}));
const host=doc.createElement('marinara-capability-gacha-forge');doc.body.append(host);
const sr=host.attachShadow({mode:'open'});sr.innerHTML='<div><button class="gf-fs-bar icon-button">⛶</button></div>';
win.eval(src);
sr.querySelector('button[data-gfq="top"]').click();
const panel=doc.getElementById('gfq-01-panel');
panel.querySelector('[data-tab="cast"]').dispatchEvent(new win.MouseEvent('click',{bubbles:true}));
const imgs=()=>[...panel.querySelectorAll('img')];
const broken=imgs().find(i=>i.getAttribute('src').endsWith('5kkgBZEKs0nbNjSAuKV9U.png'));assert.ok(broken,'old png address rendered');
broken.dispatchEvent(new win.Event('error'));
assert.strictEqual(broken.getAttribute('src'),'/api/global-gallery/file/5kkgBZEKs0nbNjSAuKV9U.webp','retried as webp');
broken.dispatchEvent(new win.Event('load'));
const W=()=>JSON.parse(win.localStorage.getItem('gf-quest-v1')).worlds['신선무협'];
assert.strictEqual(W().gfCast['석란'].art,'/api/global-gallery/file/5kkgBZEKs0nbNjSAuKV9U.webp','stored address updated');
// Only once per image, and a webp that fails is left alone.
broken.dispatchEvent(new win.Event('error'));assert.strictEqual(broken.getAttribute('src'),'/api/global-gallery/file/5kkgBZEKs0nbNjSAuKV9U.webp');
const ok=imgs().find(i=>i.getAttribute('src').endsWith('IrBq.webp'));ok.dispatchEvent(new win.Event('error'));assert.strictEqual(ok.getAttribute('src'),'/api/global-gallery/file/IrBq.webp');
assert.strictEqual(W().gfCast['유'].art,'/api/global-gallery/file/IrBq.webp');
console.log('UI art OK');process.exit(0);
