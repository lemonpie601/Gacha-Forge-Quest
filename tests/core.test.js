const fs=require('fs'),assert=require('assert');
const src=fs.readFileSync(process.argv[2]||require("path").join(__dirname,"..","extension.js"),'utf8');
const grab=name=>{const i=src.indexOf('  function '+name+'(');if(i<0)throw Error('missing '+name);let d=0,j=src.indexOf('{',i);for(;j<src.length;j++){if(src[j]==='{')d++;else if(src[j]==='}'){d--;if(!d)break;}}return src.slice(i,j+1);};
const grabConst=c=>{const i=src.indexOf('  const '+c+'=');if(i<0)throw Error('missing const '+c);const j=src.indexOf('=',i)+1;if(src[j]==='{'){let d=0,k=j;for(;k<src.length;k++){if(src[k]==='{')d++;else if(src[k]==='}'){d--;if(!d)break;}}return src.slice(i,k+1)+';\n';}return src.slice(i,src.indexOf('\n',i)+1);};
const consts=['GFQ_CURRENCIES','GFQ_UNIT_OF','gfqUnit','gfqIsMoneyUnit','GFQ_THEME_UNIT','GFQ_UNIT_ALT','GFQ_NATIVE_NUM','gfqCurCache','gfqMoneyScale','GFQ_CONDITIONAL','gfqIsCond','GFQ_INJECT_SECTIONS','gfqWeekday','GFQ_DAY_WORDS','gfqChapterOfSource','GFQ_REVIEW_NOTES','GFQ_PAY_CUE','GFQ_CASH_WORDS','GFQ_DISCOUNT_WORDS','GFQ_SKIP','GFQ_TIMING','GFQ_LEGACY_PACK','GFQ_GENERIC','gfqEsc','GFQ_LABELS','gfqLabel','gfqAmount','gfqTimingText','GFQ_MONEY_STATES','gfqMoney','GFQ_RANK','gfqChainOf','GFQ_LINK_REASON','GFQ_CERT_RANK','GFQ_EQUIP_TYPES','gfqEquipType','gfqIsEquipment','GFQ_CH_WORDS','GFQ_ITEM_PREFIX'].map(grabConst).join('');
const names=['gfqApplyEquipmentCandidate','gfqGearStage','gfqGearFromStory','gfqMergeMoneyRewards','gfqCleanLore','gfqMergeLore','gfqInjectText','gfqQuestRewardItems','gfqKNum','gfqMoneyIn','gfqDetectUnit','gfqMainUnit','gfqInjectLines','gfqInjectFit','gfqInjectSections','gfqCash','gfqVNDate','gfqDayDiff','gfqDateHeading','gfqDateMap','gfqDateAt','gfqHeadingDates','gfqStampDates','gfqYmd','gfqDatesIn','gfqAddDays','gfqTimelineFrom','gfqCurrentDate','gfqResolveTiming','gfqSumTotals','gfqAutoGate','gfqEventsFor','gfqVNState','gfqEvidenceList','gfqLineHits','gfqSceneHits','gfqAutoBatches','gfqAutoEligible','gfqMissingMoney','gfqAmountsIn','gfqDedupeRewards','gfqRewardText','gfqScreenEvent','gfqLocateEvidence','gfqBuildProposal','gfqEventEligible','gfqNormMap','gfqApplySale','gfqChapterHashes','gfqParseChapterRange','gfqApplyBenefit','gfqApplyPurchase','gfqLedgerSummary','gfqRewardFromProposal','gfqClearedHint','gfqChapterBatches','gfqContextItems','gfqResolveLink','gfqApplyLink','gfqMarkComponents','gfqLedgerMatch','gfqLedgerQuestion','gfqLedgerRecord','gfqRelinkQuestRewards','gfqApplyItem','gfqConsolidationInput','gfqApplyConsolidation','gfqQuestPresentation','gfqStepLine','gfqUpdateQuest','gfqAwardQuestReputation','gfqRuleCtx','gfqTiming','gfqSafeProposal','gfqStoryRecords','gfqParseEvents','gfqDuplicate','gfqCollectEvents','gfqKnownKeys','gfqIntegrateQuests','gfqQuestGroup','gfqAnalysisSummary','gfqCaptionChapter','gfqItemKey','gfqSimilarItem'];
const code="let n=0;const uid=()=>'id'+(n++);const record=(w,text)=>{(w.history||=[]).unshift({text});};const now=()=>'T';const prompt=()=>{throw Error(\"prompt called\")};const alert=()=>{};"+consts+names.map(grab).join('\n')+'\nreturn {'+names.join(',')+'};';
const F=new Function(code)();
const L={legacy:true,hero:'채서래'};
let pass=0;const t=(name,fn)=>{fn();pass++;console.log('✓',name);};
const story='채서래는 계약서에 서명했다.  기본 수당 950,000원과 위험 수당 450,000원, 총 1,400,000원이 지급될 예정이다. 그는 이후 C급 면허를 취득했다.';
t('근거: 공백·따옴표 차이 허용, 원문 구간 반환',()=>{
  assert.strictEqual(F.gfqLocateEvidence('기본 수당 950,000원과  위험 수당',[story]),'기본 수당 950,000원과 위험 수당');
  assert.strictEqual(F.gfqLocateEvidence('계약서에 서명했다. 기본',[story]),'계약서에 서명했다.  기본');
  assert.strictEqual(F.gfqLocateEvidence('“계약서에 서명했다”',[story]),'계약서에 서명했다');
});
t('근거: 원문에 없는 문장은 거부',()=>{assert.strictEqual(F.gfqLocateEvidence('계좌에 140만 원이 입금됐다',[story]),null);});
t('근거: 너무 짧은 인용은 거부',()=>{assert.strictEqual(F.gfqLocateEvidence('원과',[story]),null);});
t('면허 이름: 다른 면허는 강제 변경하지 않음',()=>{
  const a=F.gfqSafeProposal({category:'credential',name:'B급 탐색자 면허',evidence:'B급 탐색자 면허를 받았다'});
  assert.strictEqual(a.name,'B급 탐색자 면허');
  const b=F.gfqSafeProposal({category:'credential',name:'C급 면허',evidence:'물리계 C급 정식 면허를 발급받았다'},L);
  assert.strictEqual(b.name,'물리계 C급 정식 면허');
});
t('정산 완료만으로 received 확정 안 함 (기존 동작 유지)',()=>{
  const r=F.gfqSafeProposal({category:'asset',financialStatus:'received',name:'보수',evidence:'정산을 완료했다'});
  assert.strictEqual(r.financialStatus,'receivable');
});
t('잘린 JSON에서 완전한 사건만 복구',()=>{
  const raw='```json\n{"events":[{"category":"asset","name":"a","evidence":"x}y"},{"category":"quest","name":"b"},{"category":"item","name":"잘';
  const p=F.gfqParseEvents(raw);assert.ok(p.partial);assert.strictEqual(p.events.length,2);assert.strictEqual(p.events[0].evidence,'x}y');
});
t('정상 JSON / 배열 / 쓰레기 입력',()=>{
  assert.strictEqual(F.gfqParseEvents('{"events":[]}').partial,false);
  assert.strictEqual(F.gfqParseEvents('[{"a":1}]').events.length,1);
  assert.strictEqual(F.gfqParseEvents('응답 없음'),null);
});
t('시간순 정렬: 챕터 → 줄거리 → 장면 번호',()=>{
  const w={gfChapterIndex:[{chapter:2,premise:'P2'},{chapter:1,premise:'P1'}],gfStorySamples:[{chapter:'2',index:'1',text:'S2-1'},{chapter:'1',index:'10',text:'S1-10'},{chapter:'1',index:'2',text:'S1-2'},{chapter:'?',index:'?',text:'S?'}]};
  assert.deepStrictEqual(F.gfqStoryRecords(w).map(r=>r.text),['P1','S1-2','S1-10','P2','S2-1','S?']);
});
t('수집: 근거 위치를 원문 구간으로 교정하고 탈락 사유 집계',()=>{
  const w={aiProposals:[],aiAcceptedKeys:[]},out=[],stats={format:0,filtered:0,evidence:0,duplicate:0};
  F.gfqCollectEvents([
    {category:'asset',name:'보수 총액',status:'active',financialStatus:'pending',owner:'player',amount:1400000,unit:'원',evidence:'총 1,400,000원이  지급될 예정이다'},
    {category:'asset',name:'가짜',status:'active',financialStatus:'received',owner:'player',evidence:'계좌에 300만 원이 입금됐다'},
    {category:'asset',name:'NPC 돈',status:'active',financialStatus:'received',owner:'npc',evidence:'기본 수당 950,000원과'},
    {category:'asset',name:'보수 총액',status:'active',financialStatus:'pending',owner:'player',amount:1400000,unit:'원',evidence:'총 1,400,000원이 지급될 예정이다'},
    {name:''}
  ],[story],w,F.gfqKnownKeys(w),out,stats);
  assert.strictEqual(out.length,1);assert.strictEqual(out[0].evidence,'총 1,400,000원이 지급될 예정이다');
  assert.deepStrictEqual(stats,{format:1,filtered:1,evidence:1,duplicate:1});
});
t('이미 승인한 근거는 다시 후보로 만들지 않음',()=>{
  const w={aiProposals:[],aiAcceptedKeys:['asset|총 1,400,000원이 지급될 예정이다']},out=[],stats={format:0,filtered:0,evidence:0,duplicate:0};
  F.gfqCollectEvents([{category:'asset',name:'x',status:'active',financialStatus:'pending',owner:'player',evidence:'총 1,400,000원이 지급될 예정이다'}],[story],w,F.gfqKnownKeys(w),out,stats);
  assert.strictEqual(out.length,0);assert.strictEqual(stats.duplicate,1);
});
t('v0.3.4 통합 사례 회귀: 구성 수당 제거, 총액 유지',()=>{
  const ev=[{category:'asset',name:'긴급 설비 방어 보수',amount:1400000,unit:'원',source:'챕터 3 · 장면 4'},{category:'asset',name:'기본 수당',amount:950000,unit:'원',source:'챕터 3 · 장면 4'},{category:'asset',name:'위험 수당',amount:450000,unit:'원',source:'챕터 3 · 장면 4'}];
  const r=F.gfqIntegrateQuests(ev,L);assert.strictEqual(r.length,1);assert.strictEqual(r[0].name,'긴급 설비 방어 보수 총액');
});
t('퀘스트 보상: 정산 완료 표현만으로 수령 확인 금지',()=>{
  const a=F.gfqSafeProposal({category:'quest',status:'completed',financialStatus:'received',evidence:'현장 긴급 대응 수당 정산을 완료한다',questRewards:[{name:'현장 긴급 대응 수당',kind:'money',certainty:'received',evidence:''}]});
  assert.strictEqual(a.financialStatus,'receivable');assert.strictEqual(a.questRewards[0].certainty,'confirmed');
  const b=F.gfqSafeProposal({category:'quest',status:'active',financialStatus:'received',evidence:'방어 보수 정산을 마무리한다',questRewards:[{name:'보수',kind:'money',certainty:'received'}]});
  assert.strictEqual(b.financialStatus,'pending');assert.strictEqual(b.questRewards[0].certainty,'pending');
  const c=F.gfqSafeProposal({category:'quest',status:'completed',financialStatus:'received',evidence:'수당이 계좌에 입금됐다',questRewards:[{name:'수당',kind:'money',certainty:'received'}]});
  assert.strictEqual(c.financialStatus,'received');assert.strictEqual(c.questRewards[0].certainty,'received');
});
t('지급 시점: 상대 표현은 발화 장면 기준으로 기록',()=>{
  const a=F.gfqTiming({evidence:'맞춤 경량 건틀릿 및 특수 수선 세트를 내일 이 시간에 그대로 수령하시게 됩니다.',source:'챕터 3 · 장면 1'});
  assert.deepStrictEqual(a,{text:'내일 이 시간',anchor:'챕터 3 · 장면 1'});
  assert.strictEqual(F.gfqTiming({evidence:'임무 완료 시 금일 오후 6시 정각에 세후 총 1,400,000원을 정산',source:'s'}).text,'임무 완료 시 · 금일 오후 6시 정각');
  assert.strictEqual(F.gfqTiming({timing:'임무 완료 시',evidence:'',source:'s'}).text,'임무 완료 시');
  assert.strictEqual(F.gfqTiming({evidence:'기본급 500,000원은 그대로 보장됩니다',source:'s'}),null);
});
t('총액 보정이 퀘스트 제목을 덮어쓰지 않음',()=>{
  const r=F.gfqIntegrateQuests([{category:'quest',name:'제1공방 방어',questObjective:'제1공방 용해로 폭발을 막는다',amount:1400000,unit:'원',source:'챕터 3 · 장면 1',evidence:'e'}],L);
  assert.strictEqual(r[0].name,'제1공방 긴급 방어 작전');
});
t('월드 판별: 기존 월드는 이름과 보정 규칙을 자동 설정',()=>{
  const old={gfStorySamples:[{text:'채서래는 하역 통로를 지켰다.'}]};
  assert.deepStrictEqual(F.gfqRuleCtx(old),{legacy:true,hero:'채서래'});
  const fresh={gfStorySamples:[{text:'홍길동은 의뢰를 받았다.'}]};
  assert.deepStrictEqual(F.gfqRuleCtx(fresh),{legacy:false,hero:''});
  fresh.protagonist='홍길동';assert.deepStrictEqual(F.gfqRuleCtx(fresh),{legacy:false,hero:'홍길동'});
  old.gfRulePack='';assert.strictEqual(F.gfqRuleCtx(old).legacy,false);
});
t('새 월드: 기존 월드 전용 규칙이 적용되지 않음',()=>{
  const ev=[{category:'asset',name:'긴급 설비 방어 보수',amount:1400000,unit:'원',source:'챕터 3 · 장면 4'},{category:'asset',name:'기본 수당',amount:950000,unit:'원',source:'챕터 3 · 장면 4'},{category:'quest',name:'냉장 물류창고 조사',source:'챕터 1 · 줄거리',evidence:'x'}];
  const r=F.gfqIntegrateQuests(ev);assert.strictEqual(r.length,3);assert.strictEqual(r[0].name,'긴급 설비 방어 보수');
  assert.strictEqual(F.gfqSafeProposal({category:'credential',name:'물리계 C급 면허',evidence:'물리계 C급 면허'}).name,'물리계 C급 면허');
  assert.strictEqual(F.gfqDuplicate({category:'credential',name:'물리계 면허',evidence:'a'},{category:'credential',name:'물리계 C급 면허',evidence:'b'}),false);
  assert.strictEqual(F.gfqEventEligible({category:'quest',owner:'player',name:'보수 정산'}),true);
});
t('기존 월드: v0.3.4 필터 유지',()=>{
  assert.strictEqual(F.gfqEventEligible({category:'quest',owner:'player',name:'보수 정산'},L),false);
  assert.strictEqual(F.gfqEventEligible({category:'item',owner:'player',name:'앰플',evidence:'한도윤이 앰플을 추가 장전했다'},L),false);
  assert.strictEqual(F.gfqDuplicate({category:'credential',name:'물리계 면허',evidence:'a'},{category:'credential',name:'물리계 C급 면허',evidence:'b'},L),true);
});
const Q=(id,o)=>({id,category:'quest',name:o.t,questTitle:o.t,status:o.s||'active',source:o.src||'챕터 1',evidence:o.e||('근거 '+id),questRewards:o.r||[],questObjective:''});
t('퀘스트 통합: 같은 임무 후보를 하나로 묶고 원문 근거 보존',()=>{
  const pool=[Q('a',{t:'오염 원인 조사',s:'completed',e:'오염원을 찾았다'}),Q('b',{t:'냉각 밸브 개방',r:[{name:'보수',kind:'money',amount:100,certainty:'pending'}]}),{id:'m',category:'asset',name:'돈',evidence:'x'},Q('c',{t:'별개 의뢰'})];
  const inp=F.gfqConsolidationInput({quests:[]},pool);
  assert.strictEqual(inp.candidates.length,3);
  const r=F.gfqApplyConsolidation(pool,[{memberIds:['c1','c2'],title:'공방 방어 작전',objective:'공방을 지킨다',steps:[{text:'오염 원인 조사',done:true},{text:'냉각 밸브 개방',done:false}],status:'completed'},{memberIds:['c3']}],inp.candMap,inp.questMap);
  assert.deepStrictEqual(r.list.map(p=>p.name),['공방 방어 작전','돈','별개 의뢰']);
  const m=r.list[0];
  assert.strictEqual(m.status,'active'); // 미완료 단계가 있으면 AI가 completed라 해도 진행 중
  assert.strictEqual(m.evidence,'근거 b'); // 보상 있는 후보를 기준으로 근거 유지
  assert.deepStrictEqual(m.sourceEvidence,['오염원을 찾았다','근거 b']);
  assert.deepStrictEqual(m.questStepDone,[true,false]);
  assert.strictEqual(m.mergedCount,2);assert.strictEqual(r.mergedGroups,1);
});
t('퀘스트 통합: 잘못된 ID·중복 배정·단독 후보 처리',()=>{
  const pool=[Q('a',{t:'A'}),Q('b',{t:'B'}),Q('c',{t:'C'})];
  const inp=F.gfqConsolidationInput({quests:[]},pool);
  const r=F.gfqApplyConsolidation(pool,[{memberIds:['c1','c9','x'],title:''},{memberIds:['c1','c2'],title:'AB'},{memberIds:['c3']},null,'bad'],inp.candMap,inp.questMap);
  // c1은 첫 그룹(유효 멤버 1개, 기존 퀘스트 없음)이라 그대로 두고, 두 번째 그룹에서 c1+c2가 묶임
  assert.deepStrictEqual(r.list.map(p=>p.name),['AB','C']);
  const bad=F.gfqApplyConsolidation(pool,'not array',inp.candMap,inp.questMap);
  assert.deepStrictEqual(bad.list,pool);
});
t('퀘스트 통합: 모든 단계 완료가 뒷받침될 때만 완료',()=>{
  const pool=[Q('a',{t:'A',s:'completed'}),Q('b',{t:'B'})];
  const inp=F.gfqConsolidationInput({quests:[]},pool);
  const r=F.gfqApplyConsolidation(pool,[{memberIds:['c1','c2'],title:'AB',steps:[{text:'1',done:true},{text:'2',done:true}],status:'completed'}],inp.candMap,inp.questMap);
  assert.strictEqual(r.list[0].status,'completed');
});
t('기존 퀘스트 갱신: 새 퀘스트 대신 단계·완료·보상 갱신, 명성 제안 대체',()=>{
  const q={id:'q1',title:'공방 방어',detail:'d',target:1,progress:0,claimed:false,steps:['오염 원인 조사'],stepDone:[false],rewardDetails:[{name:'명성 상승',kind:'reputation',certainty:'suggested',amount:1,unit:'점'}]};
  const w={quests:[q],fields:[],history:[]};
  const pool=[Q('a',{t:'공방 방어 완료',s:'completed',r:[{name:'방어 보수',kind:'money',amount:500000,unit:'원',certainty:'confirmed'}]})];
  const inp=F.gfqConsolidationInput(w,pool);
  assert.strictEqual(inp.existing[0].id,'e1');
  const r=F.gfqApplyConsolidation(pool,[{memberIds:['c1'],existingQuestId:'e1',title:'공방 방어',steps:[{text:'오염 원인 조사',done:true},{text:'게이트 파편 파괴',done:true}],status:'completed'}],inp.candMap,inp.questMap);
  const x=r.list[0];assert.strictEqual(x.updateOf,'q1');assert.strictEqual(r.updates,1);
  F.gfqUpdateQuest(w,q,x,F.gfqQuestPresentation(x));
  assert.deepStrictEqual(q.steps,['오염 원인 조사','게이트 파편 파괴']);
  assert.deepStrictEqual(q.stepDone,[true,true]);
  assert.strictEqual(q.claimed,true);
  assert.deepStrictEqual(q.rewardDetails.map(r=>r.name),['방어 보수']);
  assert.ok(!w.fields.some(f=>f.name==='명성'),'금전 보상이 있으면 기본 명성을 주지 않음');
  assert.strictEqual(w.quests.length,1);
});
t('기존 퀘스트 갱신: 갱신 대상 ID가 엉터리면 연결하지 않음',()=>{
  const pool=[Q('a',{t:'A'})];
  const inp=F.gfqConsolidationInput({quests:[{id:'q1',title:'X'}]},pool);
  const r=F.gfqApplyConsolidation(pool,[{memberIds:['c1'],existingQuestId:'q1'}],inp.candMap,inp.questMap);
  assert.deepStrictEqual(r.list,pool);
});
const M=(id,o)=>({id,category:o.c||'asset',name:o.n,amount:o.a??null,unit:o.u??'원',financialStatus:o.f||'pending',status:o.s||'confirmed',evidence:o.e||('근거 '+id),source:o.src||'챕터 3 · 장면 1',transactionId:o.tid||''});
t('구성 금액: 같은 장면의 합계를 찾아내되 별개 지급은 유지 (50만 원 사례)',()=>{
  const list=[M('b',{n:'1차 방어 소집 기본급',a:500000}),M('x',{n:'기본 수당',a:950000}),M('y',{n:'위험 수당',a:450000}),M('t',{n:'긴급 설비 방어 보수 총액',a:1400000})];
  assert.strictEqual(F.gfqMarkComponents(list),2);
  assert.strictEqual(list[0].role,undefined);
  assert.strictEqual(list[1].role,'component');assert.strictEqual(list[2].role,'component');assert.strictEqual(list[3].role,'total');
  assert.strictEqual(list[1].componentOf,'t');
});
t('구성 금액: 합이 맞지 않으면 건드리지 않음',()=>{
  const list=[M('a',{n:'A',a:300}),M('b',{n:'B',a:500}),M('c',{n:'C',a:1000})];
  assert.strictEqual(F.gfqMarkComponents(list),0);
});
t('맥락 목록: 원장·검토 후보·수령 예정 물품에 짧은 ID 부여, 2,000자 제한',()=>{
  const w={gfLedger:[{id:'L1',name:'긴급 설비 방어 보수',amount:1400000,unit:'원',state:'pending',timing:{text:'임무 완료 시',anchor:'챕터 3 · 장면 1'},history:[]}],
    items:[{id:'I1',name:'맞춤 건틀릿',qty:1,state:'pending',timing:{text:'내일 이 시간',anchor:'챕터 3 · 장면 1'}}]};
  const c=F.gfqContextItems(w,[M('p',{n:'1차 기본급',a:500000})]);
  assert.match(c.text,/\[t1\] 거래 · 긴급 설비 방어 보수 · 1,400,000 원 · 지급 예정 · 시점: 임무 완료 시/);
  assert.match(c.text,/\[i2\] 물품 · 맞춤 건틀릿/);assert.match(c.text,/\[t3\] 거래 · 1차 기본급 · 500,000 원/);
  const many=F.gfqContextItems({gfLedger:Array.from({length:200},(_,i)=>({id:'L'+i,name:'긴 이름의 거래 항목 '+i,amount:i,unit:'원',state:'pending',history:[]}))},[]);
  assert.ok(many.text.length<=2000);
});
t('연결 검증: 금액 불일치·상태 역행·유형 불일치 거부, 정상 연결은 체인 공유',()=>{
  const w={gfLedger:[{id:'L1',name:'보수',amount:1400000,unit:'원',state:'pending',history:[]}],items:[{id:'I1',name:'건틀릿',state:'pending'}]};
  const c=F.gfqContextItems(w,[]);
  const ok=M('n',{n:'보수 입금',a:1400000,f:'received'});ok.linkTo='t1';assert.strictEqual(F.gfqResolveLink(ok,c.map),'ok');assert.strictEqual(ok.chainKey,'L1');assert.ok(!('linkTo' in ok));
  const amt=M('n',{n:'기본급',a:500000,f:'received'});amt.linkTo='t1';assert.strictEqual(F.gfqResolveLink(amt,c.map),'amount');assert.strictEqual(amt.chainKey,undefined);
  const w2={gfLedger:[{id:'L2',name:'보수',amount:100,unit:'원',state:'received',history:[]}]};const c2=F.gfqContextItems(w2,[]);
  const back=M('n',{n:'보수 약속',a:100,f:'pending'});back.linkTo='t1';assert.strictEqual(F.gfqResolveLink(back,c2.map),'state');
  const cat=M('n',{n:'돈',a:1,f:'received'});cat.linkTo='i2';assert.strictEqual(F.gfqResolveLink(cat,c.map),'category');
  const ghost=M('n',{n:'돈',a:1});ghost.linkTo='t99';const st={};F.gfqApplyLink(ghost,c.map,st);assert.strictEqual(st.linkRejected,1);assert.match(ghost.auditNote,/없는 맥락 ID/);
  const inherit=M('n',{n:'보수 입금',a:null,f:'received'});inherit.linkTo='t1';F.gfqResolveLink(inherit,c.map);assert.strictEqual(inherit.amount,1400000);assert.match(inherit.auditNote,/이전 기록에서/);
});
t('원장: 약속 → 입금이 한 거래로 이어지고, 늦게 승인한 약속이 상태를 되돌리지 않음',()=>{
  const w={gfLedger:[],history:[]};
  const promise=M('p1',{n:'긴급 설비 방어 보수',a:1400000,f:'pending'});
  const paid=M('p2',{n:'보수 입금',a:1400000,f:'received',e:'계좌에 140만 원이 입금됐다'});paid.chainKey='p1';
  F.gfqLedgerRecord(w,paid,true);          // 입금 장면을 먼저 승인
  F.gfqLedgerRecord(w,promise,true);       // 약속 장면을 나중에 승인
  assert.strictEqual(w.gfLedger.length,1);
  assert.strictEqual(w.gfLedger[0].state,'received');
  assert.strictEqual(w.gfLedger[0].history.length,2);assert.strictEqual(w.gfLedger[0].history[1].note,'이전 단계 근거');
});
t('원장: 별개 지급(다른 금액)은 별도 거래',()=>{
  const w={gfLedger:[],history:[]};
  F.gfqLedgerRecord(w,M('a',{n:'보수 총액',a:1400000}),true);
  F.gfqLedgerRecord(w,M('b',{n:'1차 기본급',a:500000}),true);
  assert.strictEqual(w.gfLedger.length,2);
});
t('퀘스트 보상 ↔ 원장: 금액이 정확히 하나만 맞으면 연결',()=>{
  const q={rewardDetails:[{name:'보수',kind:'money',amount:1400000,unit:'원',certainty:'pending'},{name:'명성',kind:'reputation'}]};
  const w={quests:[q],gfLedger:[{id:'L1',amount:1400000,unit:'원',state:'received'}]};
  assert.strictEqual(F.gfqRelinkQuestRewards(w),1);assert.strictEqual(q.rewardDetails[0].txId,'L1');
  const q2={rewardDetails:[{name:'보수',kind:'money',amount:100,unit:'원'}]};
  const w2={quests:[q2],gfLedger:[{id:'A',amount:100,unit:'원'},{id:'B',amount:100,unit:'원'}]};
  assert.strictEqual(F.gfqRelinkQuestRewards(w2),0);
});
t('원장: 퀘스트 보상에서 만든 거래는 이후 같은 금액의 계약 승인과 합쳐짐',()=>{
  const w={gfLedger:[{id:'Q',name:'보수',amount:1400000,unit:'원',state:'pending',origin:'quest-reward',chainKeys:[],history:[]}],history:[]};
  F.gfqLedgerRecord(w,M('c',{n:'긴급 설비 방어 보수 총액',a:1400000}),true);
  assert.strictEqual(w.gfLedger.length,1);
});
t('수령 예정 물품: 등록 후 연결된 수령 장면으로 보유 전환',()=>{
  const w={items:[],history:[]};
  const promise={id:'g1',category:'item',name:'맞춤 경량 건틀릿',status:'active',financialStatus:'pending',amount:1240000,unit:'원',evidence:'건틀릿을 내일 이 시간에 수령하시게 됩니다',source:'챕터 3 · 장면 1'};
  assert.strictEqual(F.gfqApplyItem(w,promise),true);
  assert.strictEqual(w.items[0].state,'pending');assert.strictEqual(w.items[0].qty,1);assert.strictEqual(w.items[0].value,1240000);
  assert.strictEqual(w.items[0].timing.text,'내일 이 시간');
  const got={id:'g2',category:'item',name:'건틀릿',status:'confirmed',financialStatus:'ownership',amount:1,unit:'개',evidence:'건틀릿을 건네받았다',source:'챕터 4',chainKey:'g1'};
  assert.strictEqual(F.gfqApplyItem(w,got),true);
  assert.strictEqual(w.items.length,1);assert.strictEqual(w.items[0].state,undefined);
  const mention={id:'g3',category:'item',name:'앰플',status:'confirmed',financialStatus:'ownership',amount:null,unit:'',evidence:'앰플이 있었다'};
  assert.strictEqual(F.gfqApplyItem(w,mention),false);
});
t('소지품 중복: 비슷한 이름의 보유품이 있으면 자동으로 더하지 않고, 고른 대로 처리',()=>{
  const own=()=>({items:[{id:'k1',name:'데뷔 응원 키트',qty:2}],history:[]});
  assert.strictEqual(F.gfqItemKey('여분의 데뷔 응원 키트'),F.gfqItemKey('데뷔 응원키트'));
  assert.strictEqual(F.gfqSimilarItem(own(),'여분의 데뷔 응원 키트').id,'k1');assert.strictEqual(F.gfqSimilarItem(own(),'데뷔 응원 키트').id,'k1');
  assert.strictEqual(F.gfqSimilarItem(own(),'초코파이'),null);assert.strictEqual(F.gfqSimilarItem(own(),'키'),null,'too short to compare');
  const again={id:'d1',category:'item',name:'여분의 데뷔 응원 키트',status:'confirmed',financialStatus:'ownership',amount:2,unit:'개',evidence:'응원 키트를 다시 챙겼다'};
  let w=own();assert.strictEqual(F.gfqApplyItem(w,again),false,'automatic pass leaves it for the player');assert.deepStrictEqual(w.items.map(i=>[i.name,i.qty]),[['데뷔 응원 키트',2]]);
  w=own();assert.strictEqual(F.gfqApplyItem(w,again,{sameItem:'k1'}),true);assert.deepStrictEqual(w.items.map(i=>[i.name,i.qty]),[['데뷔 응원 키트',2]],'same thing: count unchanged');assert.match(w.history[0].text,/이미 가진 물건 재확인: 데뷔 응원 키트/);
  w=own();assert.strictEqual(F.gfqApplyItem(w,again,{newItem:true}),true);assert.deepStrictEqual(w.items.map(i=>[i.name,i.qty]),[['데뷔 응원 키트',2],['여분의 데뷔 응원 키트',2]]);
  w={items:[],history:[]};assert.strictEqual(F.gfqApplyItem(w,{...again,name:'초코파이'}),true,'nothing similar: added as before');assert.strictEqual(w.items[0].qty,2);
});
t('로어북: 착용 중인 장비가 스토리 반영 내용에 들어감',()=>{
  const w={quests:[],fields:[],history:[],gfLedger:[],items:[{id:'a',name:'단도',qty:1,equipType:'무기',equipSlot:'허리',equipOptions:'공격력  +10',equipped:true},{id:'b',name:'외투',qty:1,equipType:'방어구'},{id:'c',name:'시설용 단말기',qty:1}]};
  const L=F.gfqInjectLines(w);
  assert.deepStrictEqual(L.filter(l=>l[0]==='착용 중'),[['착용 중','단도 [허리] (공격력 +10)']],'only what is worn');
  assert.ok(F.gfqInjectText(w,2000).includes('착용 중: 단도 [허리] (공격력 +10)'));
});
t('챕터 단위 분석: 챕터마다 한 회차, 긴 챕터는 나눠서 순서 유지',()=>{
  const recs=[{source:'챕터 1 · 줄거리',text:'p1'},{source:'챕터 1 · 장면 1',text:'a'},{source:'챕터 2 · 장면 1',text:'b'},
    ...Array.from({length:5},(_,i)=>({source:'챕터 3 · 장면 '+(i+1),text:'x'.repeat(3000)})),{source:'챕터 ? · 장면 ?',text:'z'}];
  const b=F.gfqChapterBatches(recs,7000);
  assert.deepStrictEqual(b.map(x=>x.label),['챕터 1','챕터 2','챕터 3 1/3부','챕터 3 2/3부','챕터 3 3/3부','챕터 미상']);
  assert.deepStrictEqual(b.map(x=>x.length),[2,1,2,2,1,1]);
  assert.strictEqual(b[0][0].text,'p1');
});
t('물품 가치: N원 상당 물품은 현금이 아닌 수령 예정 물품',()=>{
  const r=F.gfqSafeProposal({category:'contract',name:'건틀릿 수령 예정',financialStatus:'receivable',amount:1240000,unit:'원',status:'confirmed',evidence:'1,240,000원 상당의 맞춤 경량 건틀릿 및 특수 수선 세트를 내일 이 시간에 그대로 수령하시게 됩니다.'});
  assert.strictEqual(r.category,'item');assert.strictEqual(r.financialStatus,'pending');assert.strictEqual(r.amount,null);assert.strictEqual(r.value,1240000);
  const cash=F.gfqSafeProposal({category:'asset',name:'보수',financialStatus:'pending',amount:1400000,unit:'원',evidence:'세후 총 1,400,000원을 정산해 드립니다'});
  assert.strictEqual(cash.category,'asset');
});
t('보상 연결: 통합 단계에서 같은 챕터 수당·면허를 퀘스트 보상으로 연결, 명성 기본값 대체',()=>{
  const pool=[Q('q',{t:'격리동 수습',s:'completed',src:'챕터 2'}),
    {id:'m',category:'asset',name:'현장 긴급 대응 수당',financialStatus:'receivable',amount:null,unit:'',status:'completed',evidence:'수당 정산을 완료한다',source:'챕터 2'},
    {id:'c',category:'credential',name:'물리계 정식 면허',status:'completed',evidence:'면허 교부',source:'챕터 2'}];
  const inp=F.gfqConsolidationInput({quests:[]},pool);
  assert.strictEqual(inp.rewards.length,2);
  const r=F.gfqApplyConsolidation(pool,[{memberIds:['c1'],rewardIds:['r1','r2','r9'],title:'격리동 수습'}],inp.candMap,inp.questMap,inp.rewardMap);
  const q=r.list.find(p=>p.category==='quest');
  assert.deepStrictEqual(q.questRewards.map(x=>[x.kind,x.certainty,x.chainKey]),[['money','confirmed','m'],['credential','received','c']]);
  assert.strictEqual(r.list.length,3,'reward candidates stay for their own approval');
  assert.ok(!F.gfqQuestPresentation(q).rewardList.some(x=>x.kind==='reputation'));
  const w={quests:[{rewardDetails:q.questRewards}],gfLedger:[{id:'T',chainKeys:['m'],state:'receivable'}]};
  assert.strictEqual(F.gfqRelinkQuestRewards(w),1);assert.strictEqual(w.quests[0].rewardDetails[0].txId,'T');
});
t('보상 연결: 한 보상 후보는 한 임무에만',()=>{
  const pool=[Q('a',{t:'A'}),Q('b',{t:'B'}),{id:'m',category:'asset',name:'보수',financialStatus:'pending',amount:5,unit:'원',evidence:'e'}];
  const inp=F.gfqConsolidationInput({quests:[]},pool);
  const r=F.gfqApplyConsolidation(pool,[{memberIds:['c1'],rewardIds:['r1']},{memberIds:['c2'],rewardIds:['r1']}],inp.candMap,inp.questMap,inp.rewardMap);
  assert.strictEqual(r.rewardLinks,1);assert.strictEqual(r.list.find(p=>p.name==='B').questRewards.length,0);
});
t('세부 목표: 목표 문장만 반복하는 단일 단계는 표시하지 않음',()=>{
  assert.deepStrictEqual(F.gfqQuestPresentation({name:'x',questSteps:['목표 문장 전체']}).steps,[]);
});
t('챕터 클리어 참고 표시',()=>{
  const w={gfChapterIndex:[{chapter:1,cleared:true},{chapter:3,cleared:false}]};
  assert.match(F.gfqClearedHint(w,{category:'quest',status:'active',source:'챕터 1'}),/클리어/);
  assert.strictEqual(F.gfqClearedHint(w,{category:'quest',status:'active',source:'챕터 3 · 장면 1'}),'');
  assert.strictEqual(F.gfqClearedHint(w,{category:'quest',status:'completed',source:'챕터 1'}),'');
});
t('혜택: 50% 감면은 1회 이용권, 이미 적용된 면제는 기록만, 상시 혜택은 자산 필드',()=>{
  const b=F.gfqSafeProposal({category:'asset',name:'굴착충 소재 공임 50퍼센트 감면',financialStatus:'waived',amount:50,unit:'%',evidence:'공임 50퍼센트 감면 혜택은 그대로 보장됩니다'});
  assert.strictEqual(b.category,'benefit');assert.strictEqual(b.benefitUses,1);
  const w={items:[],fields:[],history:[]};
  assert.strictEqual(F.gfqApplyBenefit(w,{...b,id:'b1'}),'voucher');
  assert.deepStrictEqual([w.items[0].name,w.items[0].qty,w.items[0].kind,w.items[0].detail],['굴착충 소재 공임 50퍼센트 감면권',1,'voucher','50 %']);
  F.gfqApplyBenefit(w,{...b,id:'b1',evidence:'다른 장면'});assert.strictEqual(w.items[0].qty,1,'same chain is not a second voucher');
  F.gfqApplyBenefit(w,{...b,id:'b2'});assert.strictEqual(w.items[0].qty,2,'a new grant adds a use');
  assert.strictEqual(F.gfqApplyBenefit(w,{name:'공임비 면제',benefitConsumed:true,evidence:'e'}),'consumed');assert.strictEqual(w.items.length,1);
  F.gfqApplyBenefit(w,{name:'공방 우선 이용',benefitPermanent:true,evidence:'e'});assert.strictEqual(w.fields[0].name,'보유 혜택 · 공방 우선 이용');
  assert.strictEqual(F.gfqSafeProposal({category:'contract',name:'공임비 면제',financialStatus:'waived',amount:400000,unit:'원',evidence:'공임비 400,000원을 면제합니다'}).category,'contract','a waived won amount stays a contract record');
});
t('명성: 공적 평가 제안(1~5)은 금전 보상과 함께 유지, 기본 +1은 금전 보상과 함께 붙지 않음',()=>{
  const pool=[Q('q',{t:'공방 방어',r:[{name:'보수',kind:'money',amount:1400000,unit:'원',certainty:'pending'}]})];
  const inp=F.gfqConsolidationInput({quests:[]},pool);
  const r=F.gfqApplyConsolidation(pool,[{memberIds:['c1'],reputation:{amount:9,reason:'공방 폭발을 막아 다수 인명을 구함'}}],inp.candMap,inp.questMap,inp.rewardMap);
  const rl=F.gfqQuestPresentation(r.list[0]).rewardList;
  assert.deepStrictEqual(rl.map(x=>[x.kind,x.amount]),[['money',1400000],['reputation',5]],'clamped to 5');
  const plain=F.gfqQuestPresentation({name:'x',questRewards:[{name:'보수',kind:'money',amount:1,unit:'원'},{name:'명성 상승',kind:'reputation',amount:1,certainty:'suggested'}]}).rewardList;
  assert.ok(!plain.some(x=>x.kind==='reputation'));
  const w={fields:[{id:'f',name:'명성',value:'4',unit:'점'}],history:[]},q={title:'공방 방어',rewardDetails:rl};
  F.gfqAwardQuestReputation(w,q);assert.strictEqual(w.fields[0].value,'9');assert.match(w.history[0].text,/명성 \+5점 \(확장 명성 규칙 제안: 공방 폭발을/);
});
t('구매: 지출은 원장, 산 물품은 소지품(받기 전이면 수령 예정)',()=>{
  const w={items:[{id:'i',name:'회복 포션',qty:2}],history:[]};
  F.gfqApplyPurchase(w,{id:'p',name:'잡화점 구매',purchasedItems:[{name:'회복 포션',qty:3,received:true},{name:'맞춤 방패',qty:1,received:false}],evidence:'e',source:'s'});
  assert.strictEqual(w.items[0].qty,5);assert.strictEqual(w.items[1].state,'pending');
});
t('원장 요약: 승인된 원화 거래만 상태별 합산',()=>{
  const s=F.gfqLedgerSummary({gfLedger:[{unit:'원',amount:1400000,state:'received'},{unit:'원',amount:300000,state:'paid'},{unit:'원',amount:500000,state:'pending'},{unit:'원',amount:null,state:'receivable'},{unit:'%',amount:50,state:'waived'}]});
  assert.deepStrictEqual(s,{unit:'원',received:1400000,paid:300000,receivable:0,pending:500000,unknown:1,other:1,byUnit:{}});
});
t('판매: 대금은 원장, 판 물품은 소지품에서 차감 · 현금으로 받은 대금은 입금으로 인정',()=>{
  const w={items:[{id:'i',name:'마석 조각',qty:5}],history:[]};
  F.gfqApplySale(w,{name:'마석 판매',soldItems:[{name:'마석 조각',qty:3},{name:'없는 물건',qty:1}]});
  assert.strictEqual(w.items[0].qty,2);assert.match(w.history[0].text,/찾지 못했습니다: 없는 물건/);
  const r=F.gfqSafeProposal({category:'asset',name:'마석 판매 대금',financialStatus:'received',amount:300000,unit:'원',evidence:'상인에게서 판매 대금 300,000원을 현금으로 건네받았다'});
  assert.strictEqual(r.financialStatus,'received');
  const r2=F.gfqSafeProposal({category:'asset',name:'보수',financialStatus:'received',amount:1,unit:'원',evidence:'보수 정산을 완료했다'});
  assert.strictEqual(r2.financialStatus,'receivable','정산 완료만으로는 여전히 입금 아님');
});
t('분석 범위: 챕터 지문과 범위 입력 해석',()=>{
  const b=F.gfqChapterBatches([{source:'챕터 1 · 장면 1',text:'a'},{source:'챕터 2 · 장면 1',text:'b'}]);
  const h1=F.gfqChapterHashes(b);
  const h2=F.gfqChapterHashes(F.gfqChapterBatches([{source:'챕터 1 · 장면 1',text:'a'},{source:'챕터 2 · 장면 1',text:'b'},{source:'챕터 2 · 장면 2',text:'c'}]));
  assert.strictEqual(h1['1'],h2['1']);assert.notStrictEqual(h1['2'],h2['2'],'a new scene changes only that chapter');
  assert.deepStrictEqual([...F.gfqParseChapterRange('2-4',['1','2','3','4','5'])],['2','3','4']);
  assert.deepStrictEqual([...F.gfqParseChapterRange('5, 1',['1','2','5'])].sort(),['1','5']);
  assert.strictEqual(F.gfqParseChapterRange('9',['1']).size,0);
});
const S3='약정 보수는 긴급 설비 방어 기본 수당 950,000원에 고온·약물 매연 및 용해로 폭발 위험 수당 450,000원을 확정 가산하여, 임무 완료 시 금일 오후 6시 정각에 세후 총 1,400,000원을 등록 계좌로 즉시 정산해 드립니다! 이 경우에도 방금 하역 통로를 지켜내신 1차 방어 소집 기본급 500,000원과 굴착충 소재 공임 50퍼센트 감면 혜택은 그대로 보장됩니다! 의복 및 신체 손상, 열기 피로도에 대해서는 무진 길드 산하 특실 재해보험과 청맥 길드 연계 치료가 100퍼센트 무상 적용되며';
const ev=(x)=>F.gfqScreenEvent({owner:'player',status:'confirmed',...x},[S3]).proposal;
t('금액 표기 해석',()=>{
  const a=F.gfqAmountsIn('세후 총 1,400,000원, 140만 원, 50퍼센트');assert.ok(a.has(1400000)&&a.has(50));
});
t('수당은 혜택이 아니라 돈: AI가 benefit으로 보내도 자산 거래로 되돌림',()=>{
  const p=ev({category:'benefit',name:'긴급 설비 방어 위험 수당',financialStatus:'receivable',amount:450000,unit:'원',evidence:'위험 수당 450,000원을 확정 가산하여'});
  assert.strictEqual(p.category,'asset');assert.strictEqual(p.amount,450000);
  const mixed=ev({category:'benefit',name:'1차 방어 소집 기본급 및 공임 50% 감면 보장',financialStatus:'receivable',amount:500000,unit:'원',evidence:'1차 방어 소집 기본급 500,000원과 굴착충 소재 공임 50퍼센트 감면 혜택은 그대로 보장됩니다'});
  assert.strictEqual(mixed.category,'asset');assert.match(mixed.auditNote,/할인·감면 혜택은 별도/);
});
t('혜택 구분: 앞으로 쓸 할인은 이용권, 무상 적용·면제는 기록만',()=>{
  assert.strictEqual(ev({category:'benefit',name:'굴착충 소재 공임 50퍼센트 감면',financialStatus:'waived',amount:50,unit:'%',evidence:'굴착충 소재 공임 50퍼센트 감면 혜택은 그대로 보장됩니다'}).benefitMode,'voucher');
  assert.strictEqual(ev({category:'benefit',name:'특실 재해보험 및 연계 치료 100% 무상',financialStatus:'waived',amount:null,unit:'',evidence:'청맥 길드 연계 치료가 100퍼센트 무상 적용되며'}).benefitMode,'record');
});
t('금액 검증: 원문에 없는 금액(900,000원)은 비움',()=>{
  const p=ev({category:'asset',name:'긴급 설비 방어 수당',financialStatus:'pending',amount:900000,unit:'원',evidence:'긴급 설비 방어 기본 수당 950,000원에 고온·약물 매연'});
  assert.strictEqual(p.amount,null);assert.match(p.auditNote,/원문 근거에 없어/);
  assert.strictEqual(ev({category:'asset',name:'총액',financialStatus:'pending',amount:1400000,unit:'원',evidence:'세후 총 1,400,000원을 등록 계좌로'}).amount,1400000);
});
t('퀘스트 안의 보상은 원문 근거가 확인될 때만 유지',()=>{
  const p=ev({category:'quest',name:'공방 방어',status:'active',evidence:'세후 총 1,400,000원을 등록 계좌로',questRewards:[
    {name:'정산금',kind:'money',amount:1400000,unit:'원',certainty:'pending',evidence:'세후 총 1,400,000원'},
    {name:'현장 긴급 대응 수당',kind:'money',amount:null,certainty:'confirmed',evidence:''},
    {name:'틀린 금액',kind:'money',amount:900000,unit:'원',certainty:'pending',evidence:'기본 수당 950,000원'}]});
  assert.deepStrictEqual(p.questRewards.map(r=>[r.name,r.amount]),[['정산금',1400000],['틀린 금액',null]]);
});
t('보상 정리: 같은 금액 중복과 총액의 구성 금액 제거',()=>{
  const r=F.gfqDedupeRewards([{name:'기본 수당',kind:'money',amount:950000,unit:'원'},{name:'위험 수당',kind:'money',amount:450000,unit:'원'},{name:'총 정산금',kind:'money',amount:1400000,unit:'원'},{name:'1차 기본급',kind:'money',amount:500000,unit:'원'},{name:'정산금 중복',kind:'money',amount:1400000,unit:'원',chainKey:'k'},{name:'명성 상승',kind:'reputation',amount:3}]);
  assert.deepStrictEqual(r.map(x=>x.name),['정산금 중복','1차 기본급','명성 상승']);
});
t('보상 표시: 명성 점수와 사유',()=>{
  assert.strictEqual(F.gfqRewardText({name:'명성 상승',kind:'reputation',amount:3,unit:'점',certainty:'suggested',assessed:true,evidence:'확장 명성 규칙 제안: 공방 폭발을 막음'}),'명성 상승 +3점 (제안·미지급) — 공방 폭발을 막음');
  assert.strictEqual(F.gfqRewardText({name:'보수',kind:'money',amount:1400000,unit:'원',certainty:'pending'}),'보수 1,400,000 원 (지급 예정)');
});
t('누락 의심 금액: AI가 빠뜨린 50만 원 기본급을 원문에서 찾아냄',()=>{
  const w={gfStorySamples:[{chapter:'3',index:'1',text:S3}],aiProposals:[
    {category:'asset',amount:1400000,evidence:'기본 수당 950,000원에 고온·약물 매연 및 용해로 폭발 위험 수당 450,000원을 확정 가산하여, 임무 완료 시 금일 오후 6시 정각에 세후 총 1,400,000원'}]};
  const m=F.gfqMissingMoney(w);
  assert.deepStrictEqual(m.map(x=>x.amount),[500000]);assert.match(m[0].sentence,/1차 방어 소집 기본급 500,000원/);
  w.gfMoneyDismissed=[500000];assert.strictEqual(F.gfqMissingMoney(w).length,0,'dismissed amounts stay quiet');
});
t('누락 의심 금액: 물품 가치(상당)와 지급 표현 없는 금액은 제외',()=>{
  const w={gfStorySamples:[{chapter:'1',index:'1',text:'1,240,000원 상당의 건틀릿을 받게 됩니다. 시장에서 사과가 3,000원이었다.'}]};
  assert.strictEqual(F.gfqMissingMoney(w).length,0);
});
t('보상 표시: 적용된 혜택은 적용됨, 이름에 있는 금액은 반복하지 않음, 같은 혜택 중복 제거',()=>{
  assert.strictEqual(F.gfqRewardText({name:'공임비 면제',kind:'benefit',amount:400000,unit:'원',certainty:'received'}),'공임비 면제 400,000 원 (적용됨)');
  assert.strictEqual(F.gfqRewardText({name:'보수 세후 1,400,000원',kind:'money',amount:1400000,unit:'원',certainty:'confirmed'}),'보수 세후 1,400,000원 (확정·미수령)');
  const r=F.gfqDedupeRewards([{name:'작전 중 의복·신체 손상 및 열기 피로도 무상 보험·치료',kind:'benefit',evidence:'a'},{name:'의복·신체 손상 및 열기 피로도 무상 보험·치료',kind:'benefit',evidence:'b'}]);
  assert.strictEqual(r.length,1);
});
t('퀘스트 자체에는 금액을 두지 않음(경고 없이)',()=>{
  const p=ev({category:'quest',name:'공방 방어',status:'active',amount:1400000,unit:'원',evidence:'1차 방어 소집 기본급 500,000원과'});
  assert.strictEqual(p.amount,null);assert.ok(!/원문 근거에 없어/.test(p.auditNote||''));
});
t('원장 승인: 금액이 분명히 다른 거래는 묻지 않고 새 거래, 같은 금액이면 번호로 묻기',()=>{
  const w={gfLedger:[{id:'L',name:'보수 총액',amount:1400000,unit:'원',state:'pending',chainKeys:[],history:[{source:'챕터 3'}]}],history:[]};
  assert.strictEqual(F.gfqLedgerQuestion(w,M('b',{n:'1차 방어 소집 기본급',a:500000})),null,'different amount → no question');
  F.gfqLedgerRecord(w,M('b',{n:'1차 방어 소집 기본급',a:500000}),false);
  assert.strictEqual(w.gfLedger.length,2);
  const W={gfLedger:[{id:'L',name:'보수 총액',amount:1400000,unit:'원',state:'pending',chainKeys:[],history:[]}],history:[]};
  const q=F.gfqLedgerQuestion(W,M('c',{n:'보수 입금',a:1400000,f:'received'}));
  assert.ok(q&&/1: 보수 총액/.test(q.text),'same amount → asks');
  // v0.12.0: the answer is collected first; without it nothing is written.
  assert.strictEqual(F.gfqLedgerRecord(W,M('c',{n:'보수 입금',a:1400000,f:'received'}),false),false);assert.strictEqual(W.gfLedger.length,1);
  F.gfqLedgerRecord(W,M('c',{n:'보수 입금',a:1400000,f:'received'}),false,'1');
  assert.strictEqual(W.gfLedger.length,1);assert.strictEqual(W.gfLedger[0].state,'received');
});
t('화면 챕터: 게임 원문(Chapter Three)과 한국어(3챕터) 모두 인식',()=>{
  const f=F.gfqCaptionChapter;
  assert.strictEqual(f('Chapter Three · 제1공방 방어'),'3');assert.strictEqual(f('Chapter 12 · 귀환'),'12');assert.strictEqual(f('CHAPTER TEN'),'10');
  assert.strictEqual(f('3챕터 · 성수동 제1공방'),'3');assert.strictEqual(f('챕터 4 · 귀환'),'4');
  assert.strictEqual(f('Story'),'');assert.strictEqual(f('윤세라 · Part 2'),'');assert.strictEqual(f('Chapter Eleventy'),'');
});
t('자동 분석 대상: 챕터 모드는 끝난 챕터만, 장면 모드는 새 장면만',()=>{
  const w={gfStorySamples:[{id:'a',chapter:'3',index:'1',text:'x'},{id:'b',chapter:'3',index:'2',text:'y'},{id:'c',chapter:'4',index:'1',text:'z'}]};
  let r=F.gfqAutoBatches(w,'chapter');assert.deepStrictEqual(r.list.map(b=>b.chapter),['3'],'chapter 4 is still running');
  w.gfAnalyzed={'3':r.hashes['3']};assert.strictEqual(F.gfqAutoBatches(w,'chapter').list.length,0,'already analysed');
  w.gfChapterIndex=[{chapter:4,cleared:true}];assert.deepStrictEqual(F.gfqAutoBatches(w,'chapter').list.map(b=>b.chapter),['4'],'cleared flag finishes a chapter');
  w.gfSeenScenes=['a','b'];r=F.gfqAutoBatches(w,'scene');
  assert.deepStrictEqual(r.list.map(b=>b.map(t=>t.id)),[['c']]);assert.deepStrictEqual(r.hashes,{});
  assert.strictEqual(F.gfqAutoBatches(w,'manual').list.length,0);
});
t('자동 반영 대상: 검증 경고가 붙은 항목은 검토 목록에 남김',()=>{
  assert.strictEqual(F.gfqAutoEligible({status:'confirmed',financialStatus:'pending'}),true);
  assert.strictEqual(F.gfqAutoEligible({status:'uncertain'}),false);
  assert.strictEqual(F.gfqAutoEligible({status:'confirmed',auditNote:'AI가 제시한 금액 900,000 원이(가) 원문 근거에 없어 금액을 비웠습니다.'}),false);
  assert.strictEqual(F.gfqAutoEligible({status:'confirmed',auditNote:'이전 기록 연결 제안을 거부했습니다(금액 불일치). 별개 항목으로 검토해 주세요.'}),false);
  assert.strictEqual(F.gfqAutoEligible({status:'confirmed',auditNote:'계좌 입금 근거가 없어 미수·정산 기록으로 보류했습니다.'}),true,'a safe downgrade is still applied');
});
t('대사 화면 읽기: 챕터·대사 번호·현재 대사',()=>{
  const el=(t)=>({textContent:t});
  const root={querySelector:sel=>({'.vn':el('◀ 챕터 3챕터 · 제1공방 07 / 58 한도윤: 비상 냉각 밸브를 지금 열어!'),'.vn-caption':el('압수 폐기물의 출처3챕터 · 성수동 제1공방'),'.vn-count':el('07 / 58')})[sel]||null};
  assert.deepStrictEqual(F.gfqVNState(root),{text:'◀ 챕터 3챕터 · 제1공방 07 / 58 한도윤: 비상 냉각 밸브를 지금 열어!',chapter:'3',line:7,total:58});
  assert.strictEqual(F.gfqVNState({querySelector:()=>null}),null);
});
t('대사 일치: 근거 문장 전체 또는 앞뒤 일부가 화면 대사에 있을 때',()=>{
  const vis=F.gfqNormMap('채서래는 비상 냉각 밸브를 열어 용해로 폭발을 막아 냈다.').out;
  assert.ok(F.gfqLineHits('비상 냉각 밸브를 열어 용해로 폭발을 막아',vis));
  assert.ok(F.gfqLineHits('비상 냉각 밸브를 열어 용해로 폭발을 막아 냈다. 그리고 공방장은 크게 웃었다.',vis),'evidence spanning two lines');
  assert.ok(!F.gfqLineHits('세후 총 1,400,000원을 등록 계좌로',vis));
});
t('장면 도달 판정: 순서대로 근거를 따라가고, 지난 챕터·마지막 대사에서 남은 항목 처리',()=>{
  const q={deferred:true,category:'quest',source:'챕터 3 · 장면 1',evidence:'용역을 위촉하고자 합니다',sourceEvidence:['용역을 위촉하고자 합니다','비상 냉각 밸브를 열어 용해로 폭발을 막아']};
  const m={deferred:true,category:'asset',source:'챕터 3 · 장면 1',evidence:'세후 총 1,400,000원을 등록 계좌로'};
  const vn=(text,line=5,chapter='3',total=58)=>({text,chapter,line,total});
  assert.deepStrictEqual(F.gfqSceneHits([q,m],vn('공방장: 정식 긴급 설비 방어 용역을 위촉하고자 합니다!')).map(h=>h.at),[0]);
  q.stage=1;assert.deepStrictEqual(F.gfqSceneHits([q],vn('공방장: 정식 긴급 설비 방어 용역을 위촉하고자 합니다!')),[],'an earlier line does not repeat');
  assert.deepStrictEqual(F.gfqSceneHits([q],vn('채서래는 비상 냉각 밸브를 열어 용해로 폭발을 막아 냈다')).map(h=>h.at),[1]);
  assert.deepStrictEqual(F.gfqSceneHits([q,m],vn('다른 대사',58)).map(h=>h.at),['flush','flush'],'last line of the chapter');
  assert.deepStrictEqual(F.gfqSceneHits([m],vn('다른 대사',2,'4')).map(h=>h.at),['flush'],'reader is already in chapter 4');
  assert.deepStrictEqual(F.gfqSceneHits([{...m,deferred:false}],vn('세후 총 1,400,000원을 등록 계좌로')),[]);
});
t('알림 문구: 돈 수령·지출·아이템 획득·수령 예정·혜택',()=>{
  const ev=p=>F.gfqEventsFor({quests:[]},p,new Map(),0).map(e=>e.title+' | '+e.text);
  assert.deepStrictEqual(ev({category:'asset',name:'방어 보수',financialStatus:'received',amount:1400000,unit:'원'}),['돈 수령 | +1,400,000원 · 방어 보수']);
  assert.deepStrictEqual(ev({category:'asset',name:'포션 구매',financialStatus:'paid',amount:30000,unit:'원',purchasedItems:[{name:'회복 포션',qty:3,received:true}]}),['지출 | −30,000원 · 포션 구매','아이템 구매 | 회복 포션 ×3']);
  assert.deepStrictEqual(ev({category:'item',name:'마석 조각',status:'confirmed',financialStatus:'ownership',amount:2,unit:'개'}),['아이템 획득 | 마석 조각 ×2']);
  assert.deepStrictEqual(ev({category:'item',name:'맞춤 건틀릿',status:'active',financialStatus:'pending',evidence:'내일 이 시간에 수령하시게 됩니다'}),['수령 예정 | 맞춤 건틀릿 · 내일 이 시간']);
  assert.deepStrictEqual(ev({category:'benefit',name:'공임 50% 감면',benefitMode:'voucher',benefitUses:1}),['혜택 획득 | 공임 50% 감면권 ×1']);
  assert.deepStrictEqual(ev({category:'asset',name:'기본 수당',financialStatus:'pending',amount:950000,unit:'원',role:'component'}),[],'components stay quiet');
});
t('누락 의심: 회고 문장의 합계(3,900,000원)는 제외하고 과거 지급만 표시',()=>{
  const S='전날 물류창고 기본 보수 1,200,000원과 오늘 오전 협회 격리동 방어 수당 1,300,000원에 이어, 이번 1,400,000원까지 더하면 채서래 씨가 이틀간 현금으로만 확정 지으신 순수 용역 수익이 벌써 세후 3,900,000원에 달합니다!';
  const w={gfStorySamples:[{chapter:'3',index:'3',text:S}],gfLedger:[{amount:1400000,unit:'원',state:'pending',history:[]}]};
  const m=F.gfqMissingMoney(w);
  assert.deepStrictEqual(m.map(x=>x.amount),[1200000,1300000]);assert.ok(m.every(x=>x.recap));
  assert.deepStrictEqual([...F.gfqSumTotals([1200000,1300000,1400000,3900000])],[3900000]);
});
t('자동 분석 간격: 새 챕터는 바로, 같은 챕터의 짧은 추가 장면은 기다림, 실패 후 5분 대기',()=>{
  const b=(ch,len)=>Object.assign([{id:'x',text:'가'.repeat(len)}],{chapter:ch});
  const t0=1e9;
  assert.strictEqual(F.gfqAutoGate({},[b('3',50)],t0,'scene').wait,0,'first chapter');
  assert.strictEqual(F.gfqAutoGate({gfAutoLastAt:t0-5000,gfAutoLastChapter:3},[b('4',50)],t0,'scene').wait,0,'newly generated chapter');
  assert.ok(F.gfqAutoGate({gfAutoLastAt:t0-5000,gfAutoLastChapter:3},[b('3',50)],t0,'scene').wait>=30000,'trickling scenes of the same chapter wait');
  assert.ok(F.gfqAutoGate({gfAutoLastAt:t0-120000,gfAutoLastChapter:3},[b('3',100)],t0,'scene').wait>0,'too little new text');
  assert.strictEqual(F.gfqAutoGate({gfAutoLastAt:t0-120000,gfAutoLastChapter:3},[b('3',900)],t0,'scene').wait,0);
  assert.ok(F.gfqAutoGate({gfAutoFailAt:t0-60000},[b('5',900)],t0,'scene').wait>=240000,'back off after a failure');
  assert.strictEqual(F.gfqAutoGate({gfAutoLastAt:t0-1000},[b('3',10)],t0,'chapter').wait,0,'chapter mode is not throttled');
});
const LIC='차갑고 매끄러운 은빛 플라스틱 면허증 표면에는 [성명: 채서래 / 분류: 물리계 / 등급: C급(수시 재심사 우대) / 교부일: 2033-04-08]이라는 글자가 홀로그램 인장과 함께 또렷하게 각인되어 있었다.';
t('날짜 읽기: 원문 표기 형식과 잘못된 날짜',()=>{
  assert.deepStrictEqual(F.gfqDatesIn(LIC),['2033-04-08']);
  assert.deepStrictEqual(F.gfqDatesIn('2033년 4월 9일 오전, 그리고 2033.04.10'),['2033-04-09','2033-04-10']);
  assert.deepStrictEqual(F.gfqDatesIn('2033-02-30'),[]);
  assert.strictEqual(F.gfqAddDays('2033-04-30',1),'2033-05-01');
});
t('세계관 날짜: 원문 날짜는 근거에 적혀 있을 때만, 날 바뀜은 추정',()=>{
  assert.deepStrictEqual(F.gfqTimelineFrom({currentDate:'2033-04-08',dateEvidence:'교부일: 2033-04-08'},[LIC],null),{date:'2033-04-08',basis:'원문',evidence:'교부일: 2033-04-08'});
  assert.strictEqual(F.gfqTimelineFrom({currentDate:'2033-04-09',dateEvidence:'교부일: 2033-04-08'},[LIC],null),null,'date not written in its evidence');
  const next='다음 날 아침, 채서래는 공방으로 향했다.';
  assert.deepStrictEqual(F.gfqTimelineFrom({currentDate:'',daysPassed:1,daysEvidence:'다음 날 아침'},[next],'2033-04-08'),{date:'2033-04-09',basis:'추정',evidence:'다음 날 아침'});
  assert.strictEqual(F.gfqTimelineFrom({daysPassed:1,daysEvidence:'공방으로 향했다'},[next],'2033-04-08'),null,'no day-change words');
  assert.strictEqual(F.gfqTimelineFrom({daysPassed:1,daysEvidence:'다음 날 아침'},[next],null),null,'nothing to count from');
});
t('현재 날짜: 최신 챕터 기준, 직접 입력은 이후 챕터에서 덮어씀, 상대 시점 풀이',()=>{
  const w={gfDates:{'2':{date:'2033-04-07',basis:'원문'},'3':{date:'2033-04-08',basis:'원문',evidence:'교부일'}}};
  assert.deepStrictEqual([F.gfqCurrentDate(w).date,F.gfqCurrentDate(w).basis,F.gfqCurrentDate(w).source],['2033-04-08','원문','챕터 3']);
  w.gfDateManual={date:'2033-04-09',chapter:3};assert.strictEqual(F.gfqCurrentDate(w).date,'2033-04-09');
  w.gfDates['4']={date:'2033-04-12',basis:'원문'};assert.strictEqual(F.gfqCurrentDate(w).date,'2033-04-12','a newer chapter wins over an older manual entry');
  assert.strictEqual(F.gfqResolveTiming(w,{text:'내일 이 시간',anchor:'챕터 3 · 장면 1'}),'2033-04-09');
  assert.strictEqual(F.gfqResolveTiming(w,{text:'3일 후',anchor:'챕터 3 · 장면 1'}),'2033-04-11');
  assert.strictEqual(F.gfqResolveTiming(w,{text:'임무 완료 시',anchor:'챕터 3 · 장면 1'}),null);
  assert.strictEqual(F.gfqResolveTiming(w,{text:'내일',anchor:'챕터 9 · 장면 1'}),null,'unknown chapter date');
});
t('잘린 응답에서도 timeline 복구',()=>{
  const p=F.gfqParseEvents('{"timeline":{"currentDate":"2033-04-08","dateEvidence":"교부일: 2033-04-08"},"events":[{"name":"a"},{"name":"b');
  assert.strictEqual(p.root.timeline.currentDate,'2033-04-08');assert.strictEqual(p.events.length,1);
});
t('날짜 표시 줄: 그 아래 대사는 다음 날짜 표시 전까지 모두 그 날짜',()=>{
  assert.strictEqual(F.gfqDateHeading('2033-04-09'),'2033-04-09');
  assert.strictEqual(F.gfqDateHeading('[2033년 4월 10일 (목)] 오전'),'2033-04-10');
  assert.strictEqual(F.gfqDateHeading('면허증에는 교부일: 2033-04-08이라고 적혀 있었다'),null,'a date inside a sentence is not a heading');
  const w={gfStorySamples:[
    {id:'h1',chapter:'3',index:'1',text:'2033-04-09'},
    {id:'a',chapter:'3',index:'1',text:'공방장: 세후 총 1,400,000원을 등록 계좌로 정산해 드립니다.'},
    {id:'b',chapter:'3',index:'2',text:'건틀릿은 내일 이 시간에 수령하시게 됩니다.\n2033-04-10\n다음 날, 채서래는 건틀릿을 건네받았다.'},
    {id:'c',chapter:'4',index:'1',text:'채서래의 계좌에 1,400,000원이 입금됐다.'}]};
  const map=F.gfqDateMap(w);
  assert.strictEqual(F.gfqDateAt(map,'세후 총 1,400,000원을 등록 계좌로'),'2033-04-09');
  assert.strictEqual(F.gfqDateAt(map,'건틀릿은 내일 이 시간에 수령하시게 됩니다'),'2033-04-09','before the heading inside the same scene');
  assert.strictEqual(F.gfqDateAt(map,'채서래는 건틀릿을 건네받았다'),'2033-04-10','after the heading');
  assert.strictEqual(F.gfqDateAt(map,'계좌에 1,400,000원이 입금됐다'),'2033-04-10','carries into the next chapter');
  assert.deepStrictEqual(F.gfqHeadingDates(map),{'3':{date:'2033-04-10',basis:'원문',evidence:'날짜 표시 2033-04-10',source:'챕터 3'}});
  const p=F.gfqStampDates(map,{category:'item',evidence:'건틀릿은 내일 이 시간에 수령하시게 됩니다',source:'챕터 3 · 장면 2'});
  assert.strictEqual(F.gfqResolveTiming({},F.gfqTiming(p)),'2033-04-10','내일 resolves from the date of its own line');
  const q=F.gfqStampDates(map,{category:'quest',evidence:'세후 총 1,400,000원을 등록 계좌로',sourceEvidence:['세후 총 1,400,000원을 등록 계좌로','채서래는 건틀릿을 건네받았다']});
  assert.deepStrictEqual([q.date,q.endDate],['2033-04-09','2033-04-10']);
});
t('읽은 날짜 줄이 현재 날짜: 미리 분석된 챕터의 마지막 날짜보다 우선',()=>{
  const w={gfDates:{'4':{date:'2033-04-12',basis:'원문'}},gfReadingDate:{date:'2033-04-10',chapter:'4',ms:2}};
  assert.deepStrictEqual([F.gfqCurrentDate(w).date,F.gfqCurrentDate(w).basis],['2033-04-10','읽은 장면']);
  w.gfDateManual={date:'2033-04-11',chapter:4,ms:3};assert.strictEqual(F.gfqCurrentDate(w).date,'2033-04-11','the latest of reading/manual');
  w.gfReadingDate={date:'2033-04-12',chapter:'4',ms:4};assert.strictEqual(F.gfqCurrentDate(w).date,'2033-04-12');
  assert.strictEqual(F.gfqDayDiff('2033-04-10','2033-04-12'),2);
  const leaf=t=>({children:[],textContent:t});
  const root=lines=>({querySelector:()=>({querySelectorAll:()=>lines.map(leaf)})});
  assert.strictEqual(F.gfqVNDate(root(['3챕터 · 공방','2033-04-10','05 / 58'])),'2033-04-10');
  assert.strictEqual(F.gfqVNDate(root(['면허증 교부일: 2033-04-08이라고 적혀 있었다'])),null);
});
t('스토리 반영 글: 중요한 순서로 채우고 글자 수 상한을 지킴',()=>{
  const w={protagonist:'채서래',gfReadingDate:{date:'2033-04-10',chapter:'4',ms:1},
    quests:[{title:'협회 격리동 긴급 수습',claimed:true,doneDate:'2033-04-08'},{title:'제1공방 긴급 방어 작전',claimed:false,steps:['오염 원인 조사','게이트 파편 파괴'],stepDone:[true,false]}],
    gfLedger:[{name:'긴급 설비 방어 보수',amount:1400000,unit:'원',state:'pending',timing:{text:'임무 완료 시'}},{name:'1차 방어 소집 기본급',amount:500000,unit:'원',state:'receivable'}],
    items:[{name:'맞춤 경량 건틀릿',state:'pending',qty:1,timing:{text:'내일 이 시간',base:'2033-04-09'}},{name:'굴착충 소재 공임 50퍼센트 감면권',kind:'voucher',qty:1},{name:'회복 포션',qty:3}],
    fields:[{name:'명성',value:'3',unit:'점'},{name:'보유 자격 · 물리계 C급 정식 면허',value:'취득 · 2033-04-08'}]};
  const full=F.gfqInjectText(w,2000);
  assert.match(full,/^\[퀘스트 현황 · 퀘스트 확장 자동 기록\] 채서래의/);
  assert.match(full,/\n날짜: 2033-04-10 \(일\)/);
  assert.match(full,/\n진행 중: 제1공방 긴급 방어 작전 — 다음 목표: 게이트 파편 파괴/);
  assert.match(full,/\n받을 돈: 긴급 설비 방어 보수 1,400,000원 \(지급 예정 · 임무 완료 시\) · 1차 방어 소집 기본급 500,000원 \(확정·미입금\)/);
  assert.match(full,/\n수령 예정: 맞춤 경량 건틀릿 \(2033-04-10\)/);
  assert.match(full,/\n이용권: 굴착충 소재 공임 50퍼센트 감면권 ×1/);
  assert.match(full,/\n보유 자격: 물리계 C급 정식 면허 \(취득 · 2033-04-08\)/);
  assert.match(full,/\n명성: 3점/);assert.match(full,/\n완료: 협회 격리동 긴급 수습 \(2033-04-08\)/);assert.match(full,/\n소지품: 회복 포션 ×3/);
  const short=F.gfqInjectText(w,260);
  assert.ok(short.length<=260,short.length);
  assert.match(short,/날짜: 2033-04-10/);assert.match(short,/진행 중: 제1공방/);assert.ok(!/소지품/.test(short),'low priority lines dropped first');
});
t('가챠 포지 로어북 연결: 맨 앞에 추가, 기존 설정 유지, 해제 시 제거',()=>{
  const lore={worldIds:['wb1','wb2'],castIds:['cb'],worldBudget:6000,castBudget:20000,beat:false};
  assert.deepStrictEqual(F.gfqMergeLore(lore,'lb',true),{worldIds:['lb','wb1','wb2'],castIds:['cb'],worldBudget:6000,castBudget:20000,beat:true});
  assert.deepStrictEqual(F.gfqMergeLore({...lore,worldIds:['wb1','lb']},'lb',true).worldIds,['lb','wb1'],'moved to the front, not duplicated');
  assert.deepStrictEqual(F.gfqMergeLore({...lore,worldIds:['lb','wb1']},'lb',false),{worldIds:['wb1'],castIds:['cb'],worldBudget:6000,castBudget:20000,beat:false});
  assert.deepStrictEqual(F.gfqCleanLore({worldIds:Array.from({length:30},(_,i)=>'x'+i)}).worldIds.length,24,'game limit');
});
t('보상 물품: 퀘스트 보상은 수령 예정으로 등록되고, 이름이 같은 수령 대사가 그 칸을 보유로 바꿈',()=>{
  const w={items:[],history:[]};const q={title:'방어 작전',rewardDetails:[{name:'맞춤 경량 건틀릿',kind:'item',certainty:'confirmed'},{name:'명성 상승',kind:'reputation',certainty:'suggested'}]};
  assert.strictEqual(F.gfqQuestRewardItems(w,q),1);assert.strictEqual(w.items[0].state,'pending');assert.ok(q.rewardDetails[0].chainKey);
  assert.strictEqual(F.gfqQuestRewardItems(w,q),0,'not twice');
  assert.strictEqual(F.gfqApplyItem(w,{name:'맞춤 경량 건틀릿',status:'confirmed',financialStatus:'received',amount:1,unit:'개',evidence:'건틀릿을 건네받았다'}),true);
  assert.strictEqual(w.items.length,1);assert.strictEqual(w.items[0].state,undefined,'same entry now owned');
  const w2={items:[{id:'a',name:'회복 포션 세트',state:'pending'},{id:'b',name:'회복 포션 상자',state:'pending'}],history:[]};
  F.gfqApplyItem(w2,{name:'회복 포션',status:'confirmed',amount:2,unit:'개',evidence:'e'});
  assert.ok(w2.items.filter(i=>i.state==='pending').length===2,'two possible matches: no guess');
});
t('배경 관리자 호환: 패널 글자의 챕터는 보이는 모양은 같지만 검색에 걸리지 않음',()=>{
  const gfqNoMatch=new Function(grabConst('gfqNoMatch')+';return gfqNoMatch;')();const h=gfqNoMatch('<small>챕터 4 · 3챕터</small>'),re=/(?:\d+\s*챕터|챕터\s*\d+)/;
  assert.ok(!re.test(h));assert.strictEqual(h.replace(/⁠/g,''),'<small>챕터 4 · 3챕터</small>');
});
t('조건부 보장: 중도 철수 시 보장은 총액에 더하지 않는 조건부로 분류, 퀘스트에 연결되면 따로 남지 않음',()=>{
  const cond={id:'m1',category:'asset',name:'중도 철수 시 기본급 50% 및 실비 보험 보장',financialStatus:'pending',status:'confirmed',amount:600000,unit:'원',evidence:'이 경우에도 기본급의 50퍼센트인 60만 원과 실비 보험이 보장됩니다',source:'챕터 1'};
  assert.strictEqual(F.gfqSafeProposal(cond).financialStatus,'conditional');
  assert.strictEqual(F.gfqRewardFromProposal(cond).certainty,'conditional');
  const pay={...cond,id:'m2',name:'성수동 D급 게이트 용역 보수',amount:1500000,evidence:'기본급 120만 원 + 위험 수당 30만 원'};
  assert.strictEqual(F.gfqSafeProposal(pay).financialStatus,'pending','normal pay untouched');
  const q={id:'q1',category:'quest',name:'성수동 D급 게이트 긴급 정화',questTitle:'성수동 D급 게이트 긴급 정화',status:'active',evidence:'e',source:'챕터 1',questRewards:[]};
  const out=F.gfqApplyConsolidation([q,cond,pay],[{memberIds:['c1'],rewardIds:['r1','r2'],title:'성수동 D급 게이트 긴급 정화',steps:[]}],new Map([['c1','q1']]),new Map(),new Map([['r1','m1'],['r2','m2']]));
  assert.ok(!out.list.some(p=>p.id==='m1'),'conditional guarantee lives only on the quest');
  assert.strictEqual(out.list.find(p=>p.id==='m2').linkedQuest,'성수동 D급 게이트 긴급 정화');
  const quest=out.list.find(p=>p.category==='quest');assert.ok(quest.questRewards.some(r=>r.certainty==='conditional'&&r.amount===600000));
  const w={gfLedger:[{id:'a',name:'중도 철수 시 기본급 50% 보장',amount:600000,unit:'원',state:'pending'},{id:'b',name:'보수',amount:1500000,unit:'원',state:'pending'}]};
  assert.strictEqual(F.gfqLedgerSummary(w).pending,1500000,'floor not counted as money owed');
});
t('화폐: 골드·냥·전·크레딧과 글자로 쓴 수를 인식하고 화폐별로 따로 합산',()=>{
  const m=F.gfqMoneyIn('보수로 1,200골드와 은화 서른 닢, 그리고 닷 냥을 받았다. 엽전 삼백 냥은 다음에 준다. 3만 크레딧 입금. 이전 장면에서 두 문을 지났다.');
  const got=m.map(x=>x.n+x.unit);
  for(const k of ['1200골드','30은화','5냥','300냥','30000크레딧'])assert.ok(got.includes(k),k+' in '+got.join(','));
  assert.ok(!got.some(x=>/문|^2전/.test(x)),'no door / 이전 false positives: '+got.join(','));assert.ok(!got.includes('10000크레딧'),'3만 not read twice');
  assert.ok(F.gfqAmountsIn('금화 열두 닢을 건넸다').has(12));assert.strictEqual(F.gfqKNum('스물다섯'),25);assert.strictEqual(F.gfqKNum('이천오백'),2500);
  const w={gfStorySamples:[{id:'a',text:'의뢰비는 500골드다.'},{id:'b',text:'선금 200골드를 받았다. 숙박비 30골드.'}],gfLedger:[
    {id:'1',name:'선금',amount:200,unit:'골드',state:'received'},{id:'2',name:'잔금',amount:300,unit:'G',state:'pending'},{id:'3',name:'옛 빚',amount:5,unit:'냥',state:'received'}]};
  assert.strictEqual(F.gfqMainUnit(w),'골드');
  const sm=F.gfqLedgerSummary(w);assert.strictEqual(sm.unit,'골드');assert.strictEqual(sm.received,200);assert.strictEqual(sm.pending,300,'G counts as 골드');
  assert.strictEqual(sm.byUnit['냥'].received,5,'other currency kept apart');
  assert.strictEqual(F.gfqMainUnit({gfTheme:'east'}),'냥','theme default when the story names none');
  assert.strictEqual(F.gfqMainUnit({...w,gfCurrency:'마석'}),'마석','player choice wins');
});
t('보상: 같은 금액·화폐의 돈 보상은 하나로 묶고 확실한 쪽을 대표로',()=>{
  const r=F.gfqMergeMoneyRewards([{kind:'money',name:'긴급 설비 방어 보수 총액',amount:1400000,unit:'원',certainty:'pending'},{kind:'money',name:'세후 총액',amount:1400000,unit:'원',certainty:'confirmed'},{kind:'money',name:'철수 시 최소 보장',amount:1400000,unit:'원',certainty:'conditional',conditional:true},{kind:'money',name:'금화',amount:1400000,unit:'골드'},{kind:'item',name:'방패'}]);
  const won=r.filter(x=>x.unit==='원');
  assert.strictEqual(r.length,4);assert.strictEqual(won.length,2);
  const main=won.find(x=>!x.conditional);assert.strictEqual(main.certainty,'confirmed');assert.ok((main.aka||[]).length===1);
});
t('장비: 부위만 있는 물품도 장비로 보고, 원문 근거가 있는 옵션만 쌓는다',()=>{
  const ET=new Function(grabConst('GFQ_EQUIP_TYPES')+grabConst('gfqEquipType')+'return gfqEquipType;')();assert.strictEqual(ET({equipSlot:'머리'}),'방어구');assert.strictEqual(ET({name:'철광석'}),'일반 물품');
  const it={id:'i1',name:'건틀릿'};F.gfqApplyEquipmentCandidate({},{equipType:'무기',equipSlot:'손',equipOptions:'공격력 +5',equipEvidence:'건틀릿은 공격력 +5를 준다'},it);
  assert.strictEqual(it.equipType,'무기');assert.strictEqual(it.equipOptions,'공격력 +5');assert.strictEqual(it.gearStage,'옵션 확정');
  F.gfqApplyEquipmentCandidate({},{equipOptions:'공격력 +5',equipEvidence:'다시 공격력 +5'},it);assert.strictEqual(it.equipOptions,'공격력 +5','no duplicate option');
});
console.log('\n'+pass+'개 통과');
