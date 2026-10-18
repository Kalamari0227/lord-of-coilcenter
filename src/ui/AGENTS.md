# 화면 어댑터 지침

원본 경영 화면을 지도·집무실·인물 보고·보조 장부로 연결하는 계층이다.

## 파일별 책임

| 파일 | 수정할 내용 |
| --- | --- |
| `company.js` | 화면 상태, 공유 DOM·초상·표 도우미, 지도·집무실, 직원 보고, 명령 배치 |
| `dialogs.js` | 기존 결재 창의 제목 초점, 영업 배분·발주 입력 이름, 발주 검증 오류 |
| `dossiers.js` | 생산·재고·거래처·재무·보고·연혁·게임 설명의 내용과 보조 dialog 수명 |
| `strategy-title.js` | 타이틀 메뉴, 저장 이어하기, 원본 부임 설정 화면 연결 |
| `strategy-theme.css` | 전략 화면의 글꼴·간격·창틀·레이아웃·초상·반응형 규칙 |
| `audio-settings.js`/CSS | 음향 설정·미리듣기·의미 이벤트 ID와 보고서 재생 수명 |
| `theme.css` | 색 토큰, 원본 CSS 변수 연결, 기존 표·입력·결재 창의 공통 테마 |

## 상태와 재사용 경계

- 이 계층의 공유 심볼은 `cc` 접두사를 쓴다. `ccElement`, `ccEscape`, `ccCommand`, `ccPortraitMarkup`을 재사용한다.
- `ccElement`의 세 번째 인자는 HTML이다. 회사명·인물명 같은 일반 문자열은 `ccEscape` 또는 `textContent`로 넣는다.
- `ccView.page/person/preparing`은 장면·선택 직원·부임 준비 화면 전용이다. 실제 경영 데이터는 `G.s`·`G.W`에서 읽는다.
- `ccShowReport`와 `ccBriefingDossier`는 `ccBriefings`의 동일한 `G.s` 객체별 `WeakMap` 결과를 공유한다.
- 직원 선택·장부 재열기 때 `briefing`을 매번 다시 호출하거나 캐시를 비우지 않는다. 같은 상태의 보고가 달라지지 않아야 한다.
- `face`·`crewBlock` 교체는 원본 결재 화면에도 적용된다. 초상 변경은 지도 화면만 확인해서 끝내지 않는다.
- `ccRenderSetup`은 준비 화면에서 `ccLegacySetup`을 호출한다. 원본 설정 폼을 별도로 복제하지 않는다.

## 보조 창과 입력

- `ccOpenDossier`는 열린 dialog가 있으면 새 창을 열지 않는다. 제목 연결·제목 초점·닫기 버튼을 유지한다.
- 보조 창은 native dialog의 Escape로 닫힌다. `close`에서 DOM을 제거하고 연결된 호출 버튼으로 초점을 돌린다.
- 원본 연속 결재는 중간 Escape를 차단한다. 보조 장부의 닫기 동작을 결재 큐에 일괄 적용하지 않는다.
- 발주 입력은 고객명과 톤 단위, 영업 배분은 점 단위를 접근성 이름에 포함한다.
- 빈 값·비수치·음수·최대량 초과 발주는 설명, `aria-invalid`, `aria-describedby`, 제출 비활성화를 함께 유지한다.
- 일괄 수량 설정 버튼도 검증 대상이다. 오류는 `role="alert"` 영역에 표시한다.
- 긴 표는 `cc-table-scroll`로 감싸 키보드 초점과 영역 이름을 제공한다. 문서 전체의 가로 넘침으로 대신하지 않는다.

## 음향 연결

- 효과음은 실제 행동의 성공 지점에 둔다. 렌더·hover·자동 저장에 넣지 않는다. 확정음은 `ui.js`의 `showVerdict` 한 곳, 수동 저장은 성공 뒤에만 울린다.
- `ccAudioScene`은 report-open 수명으로 결산을 닫을 때까지 decision을 유지한다. `ccApprovalOpen`만 보고 결산 음악을 바꾸지 않는다.
- 이벤트 ID·종료 중복 방지는 오디오 전용 WeakMap/WeakSet에 둔다. G나 게임 저장에 음향 필드를 추가하지 않는다.
- 음소거를 재개 과정에서 풀지 않는다. 설정 창은 미리듣기를 종료한 뒤 사용자 닫기 효과음을 내고 초점을 복원한다.

## 그림과 CSS

- 사람 초상은 `art/strategy-officers.webp`의 3열×2행 atlas다: 위 `jung, seo, gu`, 아래 `han, oh, lin`. neutral 원본 PNG 바이트는 `source-art/strategy-officers.png`에 보존한다. 세 표정 경로·셀·fallback 계약은 `art/staff-expressions.json`에 있다.
- `background-size: 300% 200%`; 열 위치는 `0%/50%/100%`, 행 위치는 `0%/100%`다. `ccOfficers` 순서와 함께 맞춘다.
- 지도·집무실 그림 위 거점은 실제 HTML 버튼이다. 글자·수치·행동을 그림에 구워 넣지 않는다.
- CSS는 `strategy-theme.css` 다음 `theme.css` 순으로 결합된다. 전략 스타일이 나중에 덮는다고 가정하지 말고 선택자 명시도와 계산된 스타일을 확인한다.
- `theme.css`의 `--bg`, `--ink` 등 원본 변수 연결은 기존 폼·장부까지 이어진다. 새 화면을 위해 이 연결을 끊지 않는다.
- `shell.html`의 기본 CSS에 원본 설정·결재·결산 요소가 의존한다. 새 클래스만 보며 기본 스타일을 제거하지 않는다.

## 관련 화면 변경의 확인

- 배치 변경은 `1440×1000`과 `390×844`에서 지도·집무실·직원 선택·명령 접근·긴 표 스크롤을 확인한다.
- 보조 창 변경은 닫기·Escape·호출 버튼 초점 복귀를, 결재 변경은 입력 오류와 정상 발주·결산까지 확인한다.
- 타이틀·설정 변경은 새로 시작·뒤로가기·저장 유무별 이어하기를 확인한다. 이 목록은 해당 흐름을 바꾼 경우에 적용한다.
