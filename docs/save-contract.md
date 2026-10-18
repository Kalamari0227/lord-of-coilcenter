# v1 checkpoint 소비 계약

2026-10-18 T3 조사. 이 문서는 현재 생성 데이터와 실제 소비 경계를 기록한다. 검증기 강화·백업·가져오기 UI는 후속 T6/T11 작업이며 이 문서로 구현 완료를 주장하지 않는다.

## 저장 경계와 코퍼스

키는 `coilcenter:foundation:v1`, `v=1`이다. `coilcenter.save.v1`은 별개 원본 키이며 자동 변환·삭제 대상이 아니다. `save.js:serializeGame`의 데이터에서 플랫폼 어댑터가 `pendingTurns`를 빼고 `bigPlan`을 카드 ID로, `pending`을 `{turn,effect}`로 바꾼다. 함수·DOM·현재 결재 큐는 저장하지 않는다. 신규 게임, 결재 시작 직전, 결산 직후가 checkpoint다. 부분 결재는 저장하지 않는다.

`tests/fixtures/save-v1/generate.mjs`는 현재 `newGame → dealTurn → 실제 option.apply/card.submit → advance → saveGame`으로 생성한다. 월간/분기 신규(turn1), 중간(turn13/history12), 완료(turn49/history48/COMPLETE) 6개와 credit/rebate/safety 예약효과 3개, quality 프로젝트 진행 1개다. 예약효과·프로젝트 파일은 실제 factory/startProject를 직접 호출한 경계 fixture이며 실제 UI 캠페인이 아니다. 중간·완료에는 재고·채권·구매 발주 및 프로젝트 이력이 포함된다.

생성 시 사건 RNG는 LCG `(imul(seed,1664525)+1013904223)>>>0`, 시작 seed `20261018`, 출력은 `state/2^32`다. `newGame`이 첫 출력으로 engine seed를 만들며, seed와 전임자 운영 후 engine RNG는 `generation.json`에 별도 기록한다. Date.now만 고정한다. render/showReport/toast는 VM에서 제외한다. 따라서 이 파일은 경제·저장 경계 코퍼스이고 UI가 소비하는 난수까지 같은 정상 캠페인 기준선은 아니다. 생성 명령은 명시적으로만 실행하며 회귀 테스트는 fixture를 다시 만들지 않는다.

```sh
node tests/fixtures/save-v1/generate.mjs
node --test tests/save-v1-corpus.test.mjs tests/save.test.mjs
```

기존 파일 재생성은 경제 기준선 갱신이다. 소스 해시·생성 입력·차이를 검토한 뒤에만 채택한다. 회귀는 각 pinned 입력을 `ccValidSave → resumeGame → saveGame`에 통과시켜 `at`를 제외한 **전체** 직렬화 객체가 같음을 검사한다. 현금 +1 복원 결함 주입에서 10개 roundtrip 검사가 실제 실패한 뒤 원복 GREEN을 기록했다.

## 읽는 법

**필수**는 현재 생성기가 쓰고 소비자가 직접 읽는 필드다. **선택**은 실제 소비자에 fallback이 있거나 특정 사건이 발생할 때만 생성되는 필드다. **참조**는 코드 소유 사전에 재연결해야 하는 값이다. 현재 validator가 필수 여부를 모두 검사한다는 뜻은 아니다. 모든 수치는 유한한 number여야 하며 경제 금액·비율에 임의 상한을 추가하지 않는다. 과거/prelude turn, 과거 도착일, 음수 손익·자본과 임기 이후 예약·프로젝트 종료일은 실제로 발생한다.

## 루트·세션

| 경로 | 필수/선택/참조 및 소비 계약 | 근거 |
| --- | --- | --- |
| `v, at` | 필수: 버전 1, 유한 timestamp. `at`는 저장 시 갱신되는 표시 메타데이터 | `save.js:serializeGame/sinceLabel`, `session-save.js:ccValidSave` |
| `mode, mpt, diffKey` | 필수: normal/1 또는 quick/3. diffKey는 `DIFF` own key | `ui.js:newGame/advance`, `session-save.js:resumeGame` |
| `s, W, ui` | 필수 객체. 아래의 소비 필드 계약 적용 | `engine.js:resolveTurn`, `world.js:worldPre/worldPost`, `ui.js:buildDecision` |
| `seen` | 필수 객체, card ID→마지막 노출 turn. 값은 유한 turn 수치 | `ui.js:dealTurn`, `issues.js:worldIssues` |
| `picks` | 필수 객체; 현재 생성기와 serializeGame이 유지하는 슬롯. 실제 결재 완료 큐를 복원하지 않는다 | `ui.js:newGame/dealTurn`, `save.js:serializeGame` |
| `bigPlan` | 필수 객체. 키는 1..48 정수 turn의 문자열, 값은 `DECK.big[].id` 참조. 복원 시 카드 객체/함수 재연결 | `session-save.js:saveGame/ccValidSave/resumeGame`, `ui.js:dealTurn` |
| `pending` | 필수 배열, 각 원소의 turn은 양의 정수(48 상한 없음), effect는 아래 태그 계약 | `ui.js:advance`, `session-save.js:ccRestoreEffect` |
| `turnDiscount, yieldPenalty, extraFixed` | 필수 유한 수. extraFixed는 태양광 절감 때문에 음수도 정상 | `ui.js:advance/buildDecision`, `issues.js:solarCard` |
| `lastCust` | 선택 turn; 생성 시 없어도 정상 | `save.js:serializeGame`, 원본 고객 사건 노출 기록 |
| `resultLines` | 필수 문자열 배열, markup 신뢰 금지 | `ui.js:advance`, `save.js:serializeGame` |
| `ui.cover, hqTake, overtime, yieldSpend, salesSpend` | 필수: 유한 수/boolean. 소비는 발주량·수율·영업 투자에 직접 연결 | `ui.js:buildDecision` |
| `ui.expandPick` | 필수 nullable `CFG.LINE` 참조 | `ui.js:buildDecision`, `engine.js:resolveTurn` |
| `ui.orderTon, orderBy, orderPlan, custFocus, salesMix` | 선택 또는 null. orderBy는 고객별 톤, orderPlan은 분기 월별 유한 수 배열, salesMix는 고객별 배분 수치. 결산 뒤 null로 리셋 | `ui.js:orderCard.submit/advance/buildDecision` |

## 경제 상태 `s`

| 경로 | 필수/선택/참조 및 소비 계약 | 근거 |
| --- | --- | --- |
| `turn, over, overReason` | 필수: turn 1..49 정수, over boolean, 이유 null/COMPLETE/INSOLVENT/CAPITAL_ERODED. 완료는 history 48·turn49, 조기 종료는 그보다 이를 수 있음 | `engine.js:resolveTurn` STEP17/21 |
| `country, companyName` | 필수 문자열. country와 companyName은 신뢰하지 않는 저장 문자열(이 조사로 새 국가 enum을 만들지 않음) | `ui.js:newGame/render`, 타이틀/법인 화면 |
| `cash,equity,paidIn,morale,trust,lossStreak,myShare,rng,hqSpotCredit,buildings` | 필수 유한 수. rng는 engine seeded generator 상태. 음수 현금·자본은 실패 종료에도 남을 수 있음 | `engine.js:createInitialState/resolveTurn` |
| `fa.{land,buildingNbv,machineCost,machineAccDep}` | 필수 유한 수; 담보·감가상각에 사용 | `engine.js:creditLimit/resolveTurn` STEP18 |
| `debt.{principal,rate,limit,extra}` | 필수 유한 수; 금리·대출 한도·차입 | `engine.js:creditLimit/resolveTurn` STEP16/17 |
| `market.{pm,phase,hqRate,scrapRate}` | 필수, phase는 `CFG.PHASE` own key, 나머지 유한 수 | `engine.js:marketDemand/resolveTurn` STEP20 |
| `hq.{cumMaterialTons,cumHqMargin,cumConsolidated}` | 필수 유한 누적량/금액 | `engine.js:resolveTurn/grade` |
| `hq.cumAutoDemand,cumAutoShipped` | 선택 유한 수; `||0` 누적 fallback, 신규 pristine state에는 없음 | `engine.js:resolveTurn/grade` |
| `custShare,salesMix` | 현재 생성 필수 고객별 수치 객체. 키는 JP/EU/CN/PART/HOME. 엔진에는 구 데이터 salesMix fallback도 존재하나 현 validator 템플릿은 필수로 검사 | `engine.js:createInitialState/portfolio/resolveTurn` STEP2b |
| `cum.{sales,revenue,op,np}` | 필수. sales는 C2C/SLIT/LEVEL/BLANK별 수치, 나머지 누적 유한 금액 | `engine.js:resolveTurn`, 결말 |
| `running,prelude` | 선택: 이미 운영 중인 회사의 true 및 이전 12개월 report 배열. 현재 newGame은 항상 생성 | `world.js:runPrelude/applyLegacy`, `ui.js:ccSettlementComparison` |

## 배열 내부 레코드

`ccShape`는 배열 내부를 검사하지 않는다. 아래 필드는 `ccObject` 하나로 대체할 수 없다.

| 레코드 | 필수 필드 | 선택/fallback/참조 | 실제 소비 |
| --- | --- | --- | --- |
| `s.invRaw[]` | qty,unitCost (유한 수), dt | arrivalTurn(없으면 현재 turn), gr(없으면 COMMON), legacy boolean. dt=FIRM/SPOT, gr=CFG.GRADE | `inventoryAging/drawFifo/creditLimit`, resolveTurn STEP5/12 |
| `s.invFg[]` | proc,qty,unitCost,dt,ya,ra,yActual | madeTurn(현재 turn fallback), gr(COMMON fallback). ya/ra/yActual은 판매 단가·수율차익 계산에 직접 사용. proc=C2C/SLIT/LEVEL/TRAP/DIE | `commonDemandNow/inventoryAging/drawFifo`, 판매/재고 장부 |
| `s.poOpen[]` | qty,unitPriceFixed,etaTurn,dt | gr(COMMON fallback) | `openPoTons`, resolveTurn STEP4/5; etaTurn으로 입고·지급 생성 |
| `s.ar[],s.ap[]` | amount,dueTurn | ar.delayed boolean | resolveTurn STEP15 현금 수금/지급, bs.arDelayed |
| `s.lines[]` | id,type,cap,capex | type=`CFG.LINE` own key(SLIT/LEVEL/BLANK) | `capacityOf`, 증설·담보·감가상각 |
| `s.effortQueue[]` | amount,turnsLeft | 유한 수; turnsLeft는 매달 감소 | resolveTurn STEP2 |
| `s.custQueue[]` | turn | mix가 있으면 고객별 유한 수치 객체; mix 없는 구 원소는 소비 시 제거 | resolveTurn STEP2b |
| `s.buildQueue[]` | type,capex,readyTurn | type=`CFG.LINE` 참조. readyTurn 임기 이후 허용 | resolveTurn STEP21, 현장/증설 장부 |
| `s.scenario[]` | to,phase,label,name,brief | drift 선택(국면 기본값 fallback), phase=`CFG.PHASE`; 비어 있으면 chapterOf 결과 없음 | `makeScenario/chapterOf`, resolveTurn STEP20, 지도 임무 |
| `s.nasi[]` | turn,tons | potential 선택(tons fallback); tons/potential은 PROC_LIST 공정별 유한 수치 | `makeNasi`, resolveTurn STEP2b/수요, `ui.js:look/orderRows` |
| `s.history[],s.prelude[]` | 아래 report 계약 | 과거 prelude turn은 0 이하도 정상 | 결산 비교/판매·손익·현금 장부/결말/worldPost |

### Report 계약

`engine.js:resolveTurn`의 `report` 생성부(현재 1271행 부근)가 원천이다. 필수 스칼라는 `turn,date,phase,pm,hqPerTon,revenue,gp,ebitda,op,np,hqMargin,consolidated,fixedCost,varCost,depreciation,interest,valuationLoss,badDebt,scrapTon,scrapRevenue,yieldGain,degradeLoss,degradeTon,dumpLoss,dumpTon,carryCost,overTons,hqSpotOffer,hqSpotTon,commonShareOfSales,hqSpotCredit,cashIn,cashOut,spotExposure,util,shortRatio,materialTons,invTons`이다. date는 문자열, phase는 국면 참조, 나머지는 유한 수다.

필수 객체는 `sales,bs,cum,custShare,shipped,produced,demand,demandAuto,demandCommon,nasiPotential,run,capNow,stock`, 필수 배열은 `crashes,shortageEvents,nasi,log,flags`다. log/flags는 문자열 배열, crashes는 CUST 고객 ID 배열, shortageEvents는 PROC_LIST 공정 ID 배열, nasi는 내시 레코드 배열이다. `bs`에는 `invTons,invValue,longTons,longValue,ar,arDelayed,ap,debt,cash,seaValue,debtLimit,debtRoom,debtUse,equity,interest,nwc`; `stock`에는 `onhand,sea,prod,nasi3,fg` 유한 수가 있다. `phaseChange,lineReady`는 특정 월에만 생기는 선택 문자열이다. report 안 nasi는 위 nasi 계약을 따른다. `crashes`와 `shortageEvents`의 문자열은 각각 실제 고객·공정 사전에 속해야 한다. `ui.js:ccSettlementComparison`은 연속 turn 및 gp/fixedCost/varCost/depreciation/op를 직접 계산하고, `world.js:worldPost`는 shipped/util/shortRatio를 읽는다. 원장 일부를 `{}`로 대체하면 결산 또는 worldPost에서 오류가 난다.

## 세계 상태 `W`

`world.js:initWorld`의 고정 객체를 유지한다. 필수 수치: `equip,quality,fatigue,comp,deferMaint,maintAge,maintCool,projCapHit,priceDir,capHit,qBoost`. 필수 고객별 수치 객체: `rel,cut,concede,relHigh`; 필수 맵: `temp,pledge,threat,negoTurn,projBoost,shareHist`. `policy`는 tight/normal/ample, `priceRumor`는 null 또는 수치 방향이다. `stats.{breakdowns,claims,shortages,concessions,deferrals,maint,overloadMonths,utilSum,months,churn,hqHit,hqMiss,cashTight,qualSum,projects,dropped,spot}`와 `style.{grow,cash,cust,craft,hq}`는 필수 유한 수다. stats.accidents는 안전 사고 뒤에만 생기는 선택 유한 수다. projBoost는 vol/qual/credit 등의 선택 유한 수 효과 맵이다. template의 null 자리는 무형식 값 허용을 뜻하지 않는다.

| 경로 | 필수/선택/참조 계약 | 소비 |
| --- | --- | --- |
| `temp[customer]` | amt,until 유한 수; 고객 참조. pledge/negoTurn은 고객별 수치, threat는 고객별 boolean | `standingCut/tempCut/worldPost`, 단가 협상 |
| `hq` | target,ytd 유한 수, commit null/full/mid/low, log 배열 | `issues.js:hqAnnualCard`, `world.js:hqYearEnd` |
| `hq.log[]` | year,target,ytd,r,commit | 본사 연간 평가/기록 |
| `project` | null 또는 key,start,end,base,goal,lower,progress. key=`PROJECTS` own key. end는 임기 이후도 정상 | `startProject/projectProgress/projectTick`, 현장/보고 |
| `projectLog[]` | key,name,start,end,pct,grade; key PROJECTS, grade win/half/lose | `projectTick/projectOptions`, 프로젝트 선택/연혁 |
| `mem[]` | turn,tag,label | cust 선택(CUST 참조), risk 선택 문자열 또는 null(끝난 프로젝트의 risk를 null로 지움). `causeRef/chainOf`는 turn/tag/cust/label 소비 |
| `impacts[]` | label | cash,vol,order,trust,equip,quality,fatigue 수치·risk 문자열·cut `[customer,number]`·rel `[customer,number][]` 선택 | `lever/settleImpacts` |
| `lastImpacts[]` | label,rows | rows는 `[sign,text][]`; sign도 코드 표시용 값이며 저장 문자열을 HTML로 신뢰하지 않음 | `settleImpacts`, 결산/기록 |
| `fired[],lastFired[]` | turn,kind,text | why/chain은 생략 또는 null 허용. chain은 turn,date,label,gap,ago | `fire/chainOf`, 결산·연혁 |
| `miles[],newMiles[]` | key,turn,date,title | who,msg,next 선택. 누계흑자 보조 이정표에는 세 필드가 실제 없음 | `milestone/checkMilestones`, 결산 축하/연혁 |
| `snaps[]` | turn,sales,op,cash,raw,util,quality,equip,rel,trust,morale,hqPace | hqPace는 null 또는 유한 수 | `snapshot`, 추이 장부 |
| `utilHist[],coverHist[],shareHist[customer][]` | 유한 수 배열 | 세계 상태 추이, 최근 활용률/고객 변화 |
| `breakdown` | null 또는 turn,sev | `worldPost`, `issues.js:breakdownCard` |
| `claim` | null 또는 cust,turn | cust CUST 참조; `worldPost`, `claimCard` |
| 사건 이후 추가 필드 | capBonus,hires,safety,shortFired는 선택 유한 수; churnAt은 고객별 turn 맵; needHist는 유한 수 배열; packCheap,spares,hqWatch,insLow는 선택 boolean; solar는 own/lease | `issues.js` 각 option.apply, `world.js:worldPre/briefing/checkMilestones` |

선택 동적 필드를 모두 제거하면 기존 선택 효과가 사라진다. 새로운 필드는 생성자·소비자에 함께 연결해 계약을 갱신한다. 이미 저장한 문구는 데이터로 보존하되 출력 경계에서 textContent/문맥별 escaping 또는 검증 ID로 재구성한 코드 markup을 사용한다.

## 예약 효과

- credit: `{turn,effect:{kind:'credit',customer}}`, customer는 CUST own key. 복원은 고객 bad 비율에 따라 0.4/0.1 확률, 현금 −980000, 관계 −10, 사건 기록을 원본 closure와 맞춘다.
- rebate: `{turn,effect:{kind:'rebate'}}`; 확률 0.5, trust −10/morale −6와 감사 기록.
- safety: `{turn,effect:{kind:'safety'}}`; 확률 `0.3+W.fatigue/250`, 현금 −260000/morale −12/capHit×0.9와 사고 횟수/기록.
- 알 수 없는 kind/customer는 거절한다. 알려지지 않은 closure를 no-op이나 safety로 추정해 복원하지 않는다. 현재 `ccRestoreEffect` 마지막 분기는 safety이므로 반드시 그 앞 경계 검증을 유지한다.

## 손상 입력과 현행 결함

`malformed-cases.json`은 정상 normal-mid에서 변경할 경로/값 또는 raw JSON을 정의한다. 현재 관측은 evidence `before-malformed.json`에 별도로 기록한다. 미래 validator 테스트는 이 파일의 모든 사례가 이미 거절된다고 가정하면 안 된다.

현재 잘린 JSON, null/빈 루트, NaN/Infinity 문법, `1e400` 비유한 수, 숫자 대신 문자열, 버전2, prototype 위험 키, 모르는 효과/고객/대형카드가 거절된다. `s.lines=[{}]`도 type 참조 검사로 거절된다. 반면 재고·채권·영업투자·scenario/nasi/buildQueue/history 및 W.project 등의 빈 레코드는 통과한다. 실제 resume 뒤의 합법적 소비 함수 호출에서 비유한 경제 상태 또는 예외가 확인되었다. 이는 **기존 결함**이며 T3에서 고치거나 올바른 동작으로 고정하지 않는다. 일부 빈 기억/이정표는 즉시 경제 예외 없이 통과하더라도 표시 레코드 계약을 만족하지 못한다.

## 후속 저장/가져오기 계약(미구현)

T6/T11은 기존 v1 내부를 유지하고 revision/hash를 별도 key로 둔다. 같은 origin의 쓰기를 Web Locks로 직렬화하고 lock 안에서 직전 읽은 primary raw 최신성을 재확인한다. 검증한 이전 primary를 backup에 보존한 뒤 새 primary commit/read-back한다. backup 실패 시 primary를 건드리지 않으며 metadata 실패를 primary 성공으로 혼동하지 않는다. 읽기·새 게임·삭제·import는 같은 coordinator를 사용한다. 협력하지 않는 구 버전 writer는 완전 방지할 수 없으므로 event/재확인으로 감지하고 덮어쓰기를 중지한다. Web Locks가 없으면 안전 자동 쓰기를 끄고 파일 checkpoint 내보내기를 제공한다.

파일은 UTF-8 JSON, known v1, 필수 필드·참조 검증을 통과한 월 checkpoint만 받는다. 상한은 10MiB(현재 corpus 최대가 그보다 작음). 미지원 버전·잘린 파일·prototype 위험 키를 거절하고, preview→확정 적용하며 취소는 G/storage를 보존한다. W.mem/fired/impact/milestones/projects/resultLines의 HTML·event-handler 문자열도 신뢰하지 않는다. 파일 preview·적용·장부에서 문자로 표시하거나 적용 전에 거절해야 하며 실행해서는 안 된다.
