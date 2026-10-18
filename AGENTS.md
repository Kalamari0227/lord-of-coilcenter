# 코일센터의 제왕 — 프로젝트 지침

분석 기준: 2026-10-14 · `main` / `8404448` 기반의 로컬 변경 포함.

## 제품과 현재 범위

해외 코일센터를 운영하는 고전 전략 경영 게임. 순수 JavaScript/HTML/CSS와 Node 내장 도구를 사용한다.
타이틀 → 사업 지도·집무실 → 여섯 직원의 보고·장부 → 결재·발주 → 결산 흐름이다.
사용자가 원하는 화면은 코에이 옛 전략 게임의 지도·인물·명령 중심이다. 경영 대시보드로 되돌리지 않는다.
화면·음향 작업에서는 기존 경제·사건 계산, 2026년 시작, 48개월/16분기, 달러·톤, 모법이익 목표를 보존한다.
지도는 기존 사업 정보의 탐색 화면이다. 별도 요청 없이 전쟁·도시 개척·이동 시간·인물 능력치를 도입하지 않는다.
`../renaissance`는 별도 참조 저장소다. 이 게임 변경을 위해 참조 저장소를 함께 수정하지 않는다.

## 구조와 작업 위치

| 작업 | 위치 | 주의 |
| --- | --- | --- |
| 월별 경제·수율·재고·채권·손익·등급 | `engine.js` | `resolveTurn`은 입력 상태를 복제 |
| 직원·현장 상태·시나리오·후속 영향 | `world.js` | 전임자 운영 시뮬레이션도 포함 |
| 고정 사건·상태별 안건 | `decks.js`, `issues.js` | 선택 효과와 지연 사건 |
| 세션·결재 큐·월 진행·원본 장부 | `ui.js` | 새 화면에서도 이 흐름을 재사용 |
| 원본 직렬화·명예의 전당·설치 | `save.js` | 현재 저장 함수는 플랫폼 파일이 덮어씀 |
| 현재 저장·복원 | `src/platform/session-save.js` | 월초 checkpoint와 예약 효과 복원 |
| 독립 음향·음원 | `src/platform/audio.js`, `music/`, `audio/` | G·RNG와 분리, manifest gain과 루프 계약 유지 |
| 현재 화면과 스타일 | `src/ui/` | 하위 `AGENTS.md` 적용 |
| 현재 정적 빌드·개발 서버 | `scripts/build.mjs`, `scripts/dev.mjs` | 출력은 `dist/` |
| 기본 스타일 | `shell.html` | 여러 `<style>` 블록 모두 필요 |
| 이미지 | `art/`, `source-art/` | 배포 그림은 PNG와 인물 WebP atlas를 함께 사용. neutral 초상 원본 PNG는 `source-art/strategy-officers.png`에 보존하며 배포하지 않음 |
| 회귀 검사 | `tests/*.test.mjs` | Node test + VM으로 공유 스크립트 로딩 |
| 원본 단일 파일 경로 | `build.sh`, `assets.js`, `index.html`, `sw.js` | 현재 dist 경로와 구별 |

## 코드 지도

AST 선언·호출부와 직접 읽기로 확인했다. JS/TS LSP가 없어 의미적 참조 중심성은 미측정이다.

| 심볼 | 위치 | 역할 |
| --- | --- | --- |
| `createInitialState`, `resolveTurn`, `grade` | `engine.js` | 초기 상태·월 계산·최종 평가 |
| `initWorld`, `worldPre`, `worldPost`, `runPrelude` | `world.js` | 세계 상태·월 전후 처리·인수 전 실적 |
| `worldIssues` | `issues.js` | 현재 상황에 맞는 안건 후보 |
| `newGame`, `dealTurn`, `openDecisions` | `ui.js` | 세션 생성·안건 구성·선택 |
| `advance`, `showReport`, `render` | `ui.js` | 월/분기 집행·결산·화면 분기 |
| `serializeGame` | `save.js` | 플랫폼 저장이 재사용하는 직렬화 |
| `ccValidSave`, `ccRestoreEffect` | `src/platform/session-save.js` | 저장 검증·예약 효과 재연결 |
| `build` | `scripts/build.mjs` | 현재 게임 코드·CSS·자산·SW 생성 |

## 로딩과 상태 계약

- 게임은 ES module이 아니라 **공유 스코프의 classic script 하나**다. 도구와 테스트만 `.mjs` ESM이다.
- 결합 순서: `engine → decks → world → issues → src/platform/audio → ui → save → src/platform/session-save → src/ui/*.js`.
- `src/ui`의 JS/CSS는 직계 파일만 이름순으로 수집한다. 다른 platform 파일은 자동 포함되지 않는다.
- `save.js`의 초기 `render()` 이후, 모든 어댑터가 로드되면 빌드가 마지막 `render()`를 호출한다.
- 함수 재할당과 뒤 파일의 함수 선언 호이스팅에 의존한다. 파일명·순서·모듈 형식 변경은 동작 변경으로 취급한다.
- 실제 게임 상태는 `G.s`와 `G.W`, 화면 선택은 `ccView`다. 장면 탐색이 월 계산을 실행하면 안 된다.
- `advance`는 예약 사건 → `worldPre` → `resolveTurn` → `worldPost`를 월별로 실행한다. 분기 모드도 이 월별 집행을 유지한다.
- 엔진의 seeded RNG 외에 사건은 `Math.random`도 쓴다. 장식·음향이 게임 난수를 추가 소비하지 않게 분리한다.

## 저장 계약

- 현재 키는 `coilcenter:foundation:v1`. 원본 `coilcenter.save.v1`을 자동 변환하거나 덮어쓰지 않는다.
- 신규 게임 직후, 결재 시작 직전, 결산 완료 뒤 저장한다. `ccApprovalOpen` 동안 부분 결재 저장을 거절한다.
- `bigPlan`은 사건 ID로 직렬화하고 `DECK.big`의 실제 카드에 재연결한다. 함수 자체를 JSON으로 보존할 수 있다고 가정하지 않는다.
- 예약 사건은 `{ turn, effect }`로 저장하며 현재 `credit`, `rebate`, `safety`를 태깅·검증·복원한다.
- 예약 효과 추가 시 태깅, 저장 검증, 원본과 동일한 복원 효과, 저장 회귀 검사를 함께 갱신한다.
- 알 수 없는 효과·손상된 저장은 기존 checkpoint를 덮어쓰지 않는다. UI 이동은 저장 성공 여부를 확인한다.

## 실행 명령

저장소 루트에서 실행한다. Node.js 22 이상, 현재 외부 패키지 설치는 필요 없다.

```sh
npm run dev                                         # http://127.0.0.1:4186
PORT=4190 npm run dev                                # 포트 변경
npm test                                            # tests/*.test.mjs
node --test tests/rules.test.mjs tests/save.test.mjs  # 계산·저장만 선택
npm run build                                       # 현재 게임 → dist/
npm run audio:render                                # 창작 21개 음원 재생성
npm run audio:verify                                # 음원·해시·루프·믹스 예산 검사
npm run check                                       # 음원 검사·테스트·프로덕션 빌드
```

- `tests/build.test.mjs`는 임시 출력 디렉터리로 빌드한다. `npm run build`와 `npm run check`의 마지막 빌드는 소유 확인된 `dist/` 전체를 다시 생성한다. 공유 체크아웃에서는 [출시 체크리스트](docs/release-checklist.md)의 격리 출력 빌드를 사용하고, 전체 `npm run check`는 자신이 소유한 별도 소스 복사본에서 실행한다.
- 자신의 체크아웃에서 `npm run check` 뒤 개발 서버를 계속 쓸 때는 해당 서버를 재시작해 개발용 dist를 복원한다. 사용자 공유 서버·탭은 건드리지 않으며 결재 중인 탭을 새로고침하지 않는다.
- dev는 파일 변경 후 재빌드하며 브라우저는 수동 새로고침이다. scripts/manifest/icon/package.json 변경은 서버 재시작이 필요하다.
- VM 테스트는 실제 브라우저 UI·서비스워커를 검증하지 않는다. 관련 화면·저장·캐시 변경은 해당 표면에서 별도로 확인한다.

## 빌드·자산 함정

- `dist/`, 루트 `index.html`, `assets.js`를 소스처럼 직접 편집하지 않는다. 각각의 생성 원본을 수정한다.
- `bash build.sh`는 루트 `index.html`을 덮어쓰는 **원본 빌드**이며 새 `src` 화면을 포함하지 않는다.
- `make-assets.ps1`은 Windows 절대 경로가 고정된 원본 보조 도구다. 현재 환경의 일반 실행 명령으로 사용하지 않는다.
- 현재 SW는 `scripts/build.mjs`의 템플릿에서 생성된다. 루트 `sw.js` 변경은 dist SW에 적용되지 않는다.
- build는 안전한 출력 경로를 확인한 뒤 출력 디렉터리 전체를 재생성하여 오래된 파일도 제거한다. 비어 있지 않은 출력은 같은 소스의 유효한 `.coilcenter-build.json` 소유 표시가 있어야 한다. 표시 없는 기존 dist는 거절하므로 해당 서버를 정리하고 폴더를 별도로 백업한 뒤 빈 출력 위치를 사용한다. 소유 표시를 수동으로 만들어 강제 채택하지 않는다.
- 콘텐츠·캐시 hash는 빌드 템플릿·코드·CSS·package.json·manifest·아이콘과 `art/` 아래 모든 일반 파일(하위 폴더 포함)의 경로·바이트, audio manifest 및 그 목록의 WAV를 반영한다. 음원은 필수 precache에서 제외하고 요청 성공 때만 캐시한다. 미캐시 오프라인 음원 실패가 shell 설치를 막으면 안 된다.
- dev는 새 SW 등록을 막고, 개발용 sw.js가 기존 production 등록의 정상 update 때 캐시 가로채기를 종료한다. 열린 게임을 자동 새로고침하거나 저장·캐시를 삭제하지 않는다. 자동 갱신 뒤에도 이전 화면이면 개발 전용 `/__dev/recover`의 「개발 화면 복구」를 누른다. 기존 등록을 갱신·해제한 뒤 그 탭만 루트로 돌아간다.

## 문서 선택

- 제품·시각 변경: `DESIGN.md`, 구조·규칙 보존: `docs/foundation.md`.
- 새 그림 제작: `docs/media-production.md`. 코일센터는 냉간 코일 가공시설이며 용광로·제련탑·용융강은 맞지 않는다.
- `art-prompts.md`의 과거 치비·디오라마 지침보다 현재 `DESIGN.md`와 새 사람 초상/지도 기준을 우선한다.
- `docs/verification.md`는 날짜가 있는 과거 검증 기록이다. 그 통과 결과를 새 변경의 검증으로 인용하지 않는다.
- 음악 변경: `docs/audio-production.md`, `docs/audio-verification.md`. 설정은 `coilcenter:audio:v1`, 게임 checkpoint와 별도다. 기술 검사 통과를 사람의 청취·물리 iOS 검증으로 대체하지 않는다.
- 필요한 문서만 읽는다. 전체 저장소 재조사나 다단계 검토를 모든 변경의 필수 절차로 만들지 않는다.
