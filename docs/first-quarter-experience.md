# 첫 분기 안내 계약

새 게임의 기존 생성·월초 저장이 끝나면 한 번 직원 인수인계를 연다. 닫기·Escape로 즉시 게임에 돌아갈 수 있다. 게임 메뉴의 **취임 안내 → 직원 인수인계 다시 보기**는 모든 재임 월에 열 수 있다. 이어하기·장면 전환·결산 뒤 렌더는 인수인계를 자동으로 열지 않는다. 타이틀 취임 안내는 게임 상태 없이도 원작 크레딧과 설명을 표시한다.

| 재임 | 담당자의 확인 목표 | 직접 행동 |
| --- | --- | --- |
| 1개월 | 확정 수주와 발주 전 재고·미착·생산 중 소재 확인 | 정 영업 보고, 재고·입항 장부 |
| 2개월 | 첫 결산 뒤 이익·현금·채권·차입 차이 확인 | 한 재무 보고, 경영 장부 |
| 3개월 | 다음 분기의 생산 부하와 정비 상태 확인 | 구 공장 보고, 생산 현황 |
| 4개월 | 보고 → 장부 → 결재 순서만 짧게 상기 | 기존 게임 명령 사용 |
| 5개월 이후 | 본문 안내 제거, 취임 안내는 유지 | 기존 게임 명령 사용 |

분기 모드(`G.mpt === 3`)는 첫 턴에 세 달의 확인 관점을 함께 보여 준다. 첫 결재가 세 달을 집행하고 다음 화면이 4개월차임을 명시한다. 목표는 읽기 전용 권고이며 완료 체크·강제 순서·추가 보상은 없다.

`src/ui/onboarding.js`는 `G.s.turn`과 `G.mpt`만으로 안내 단계를 정한다. `G`, 저장 schema, 엔진 RNG를 바꾸지 않으며 `dealTurn`이나 `briefing`을 호출하지 않는다. 직원 행동은 이미 화면에서 공유하는 보고 캐시와 `ccShowReport`를 사용한다. 장부 행동은 기존 `ccOpenDossier`를 사용한다. 인수인계 역시 같은 native dialog의 제목 초점·Escape·닫기·호출자 초점 복귀를 사용하며 열린 dialog와 겹치지 않는다.

검증 명령: `node --test tests/onboarding.test.mjs tests/setup.test.mjs tests/save.test.mjs tests/audio-integration.test.mjs`.

브라우저 확인 지점: `#cc-help`, `#cc-reopen-handover`, `.cc-dossier-close`, `#cc-quarter-guidance[data-guidance-stage]`, `[data-guidance="report"]`, `[data-guidance="ledger"]`, `#go`. 단계 값은 `month-1`, `month-2`, `month-3`, `quarter`, `independent`이다. VM은 행동 연결·상태 불변·저장·전환을 검증하며 실제 키보드 Escape와 1440×1000/390×844 화면 배치는 별도 브라우저 QA 대상이다.
