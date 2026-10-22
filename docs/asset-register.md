# 배포 자산 출처 목록

검사일: 2026-10-22. 현재 정적 빌드 [`scripts/build.mjs`](../scripts/build.mjs)가 복사하는 파일과 생성 CSS를 기준으로 한다. 화면에서 사용하지 않는 기존 그림도 `art/` 전체 복사 대상이므로 포함했다. 제작 이력과 파일 일치는 권리 인증이 아니다. 배포 전 확인이 필요한 항목을 아래 상태로 남긴다.

- **SOURCE_VERIFIED**: 현재 파일을 제작 소스에서 재현하거나 기록된 원본 파일과 SHA-256으로 대조했다. 저작권 귀속·상업 이용 권리를 인증하지 않는다.
- **DOCUMENTED_UNVERIFIED**: 저장소에 제작 설명 또는 프롬프트가 있으나 제작 실행·외부 원본·권리 근거를 모두 확인한 것은 아니다.
- **UNVERIFIED**: 해당 바이너리의 생성 원본/저작자/라이선스를 확정할 근거를 찾지 못했다.
- **LOCAL_REFERENCE**: CSS의 로컬 폰트 이름/시스템 일반 글꼴 참조. 폰트 파일의 배포나 라이선스 허용을 뜻하지 않는다.

현재 배포 집합은 `art/` 38개(이미지 37개와 초상 상태 JSON 1개), 앱 아이콘 2개, WAV 22개와 `audio/manifest.json`이다. 런타임에서 퇴역한 오프닝 SVG 2개도 `art/` 전체 복사로 여전히 배포된다. `source-art/`와 그 안의 과거 폰트·시안은 배포하지 않는다.

## 아트와 앱 아이콘

S는 [`media-production.md`](media-production.md)의 제작일·프롬프트·원본 경로 기록을 뜻한다. 해당 문서는 2026-10-14 내장 이미지 생성 도구 사용, 외부 참조 이미지 미사용을 **기록**한다. 그 설명만으로 독립적인 권리 검증을 주장하지 않는다. [`DESIGN.md`](../DESIGN.md)의 장면·초상 규약이 작업 의도 근거다. 생성 서비스 약관 사본 또는 자산별 권리 양도·배포 허가서는 확인하지 않았다.

L은 과거 [`art-prompts.md`](../art-prompts.md)의 파일명·생성 지시와 [`make-assets.ps1`](../make-assets.ps1)의 PNG 포장 절차다. 프롬프트와 포장 코드는 실제 생성 실행 기록이 아니다. 최초 저장소 유입 시점은 아래 Git 커밋으로 확인했으며 제작일·저작자를 추정하지 않는다. 기존 L 그림 23개 및 아이콘 2개는 배포 전 출처와 권리 근거 확인이 필요한 항목이다.

| 경로 / 식별자 | 종류 | origin / generation reference | 저작·라이선스 근거와 확인 상태 | 변경 이력 |
|---|---|---|---|---|
| `art/blank_off.png` | 기존 PNG | L: [프롬프트](../art-prompts.md), [포장](../make-assets.ps1) | UNVERIFIED — 개별 생성 원본·저작자·허가문 미확인 | `8404448` 최초 유입; 이후 파일 변경 없음 |
| `art/blank_on.png` | 기존 PNG | L: [프롬프트](../art-prompts.md), [포장](../make-assets.ps1) | UNVERIFIED — 개별 생성 원본·저작자·허가문 미확인 | `8404448` 최초 유입; 이후 파일 변경 없음 |
| `art/bldg1.png` | 기존 PNG | L: [프롬프트](../art-prompts.md), [포장](../make-assets.ps1) | UNVERIFIED — 개별 생성 원본·저작자·허가문 미확인 | `8404448` 최초 유입; 이후 파일 변경 없음 |
| `art/cast_gu.png` | 기존 PNG | L: [프롬프트](../art-prompts.md), [포장](../make-assets.ps1) | UNVERIFIED — 개별 생성 원본·저작자·허가문 미확인 | `8404448` 최초 유입; 이후 파일 변경 없음 |
| `art/cast_han.png` | 기존 PNG | L: [프롬프트](../art-prompts.md), [포장](../make-assets.ps1) | UNVERIFIED — 개별 생성 원본·저작자·허가문 미확인 | `8404448` 최초 유입; 이후 파일 변경 없음 |
| `art/cast_jung.png` | 기존 PNG | L: [프롬프트](../art-prompts.md), [포장](../make-assets.ps1) | UNVERIFIED — 개별 생성 원본·저작자·허가문 미확인 | `8404448` 최초 유입; 이후 파일 변경 없음 |
| `art/cast_lin.png` | 기존 PNG | L: [프롬프트](../art-prompts.md), [포장](../make-assets.ps1) | UNVERIFIED — 개별 생성 원본·저작자·허가문 미확인 | `8404448` 최초 유입; 이후 파일 변경 없음 |
| `art/cast_oh.png` | 기존 PNG | L: [프롬프트](../art-prompts.md), [포장](../make-assets.ps1) | UNVERIFIED — 개별 생성 원본·저작자·허가문 미확인 | `8404448` 최초 유입; 이후 파일 변경 없음 |
| `art/cast_seo.png` | 기존 PNG | L: [프롬프트](../art-prompts.md), [포장](../make-assets.ps1) | UNVERIFIED — 개별 생성 원본·저작자·허가문 미확인 | `8404448` 최초 유입; 이후 파일 변경 없음 |
| `art/coil_l.png` | 기존 PNG | L: [프롬프트](../art-prompts.md), [포장](../make-assets.ps1) | UNVERIFIED — 개별 생성 원본·저작자·허가문 미확인 | `8404448` 최초 유입; 이후 파일 변경 없음 |
| `art/coil_m.png` | 기존 PNG | L: [프롬프트](../art-prompts.md), [포장](../make-assets.ps1) | UNVERIFIED — 개별 생성 원본·저작자·허가문 미확인 | `8404448` 최초 유입; 이후 파일 변경 없음 |
| `art/coil_over.png` | 기존 PNG | L: [프롬프트](../art-prompts.md), [포장](../make-assets.ps1) | UNVERIFIED — 개별 생성 원본·저작자·허가문 미확인 | `8404448` 최초 유입; 이후 파일 변경 없음 |
| `art/coil_s.png` | 기존 PNG | L: [프롬프트](../art-prompts.md), [포장](../make-assets.ps1) | UNVERIFIED — 개별 생성 원본·저작자·허가문 미확인 | `8404448` 최초 유입; 이후 파일 변경 없음 |
| `art/coil_tarp.png` | 기존 PNG | L: [프롬프트](../art-prompts.md), [포장](../make-assets.ps1) | UNVERIFIED — 개별 생성 원본·저작자·허가문 미확인 | `8404448` 최초 유입; 이후 파일 변경 없음 |
| `art/crane.png` | 기존 PNG | L: [프롬프트](../art-prompts.md), [포장](../make-assets.ps1) | UNVERIFIED — 개별 생성 원본·저작자·허가문 미확인 | `8404448` 최초 유입; 이후 파일 변경 없음 |
| `art/fg_blank.png` | 기존 PNG | L: [프롬프트](../art-prompts.md), [포장](../make-assets.ps1) | UNVERIFIED — 개별 생성 원본·저작자·허가문 미확인 | `8404448` 최초 유입; 이후 파일 변경 없음 |
| `art/fg_slit.png` | 기존 PNG | L: [프롬프트](../art-prompts.md), [포장](../make-assets.ps1) | UNVERIFIED — 개별 생성 원본·저작자·허가문 미확인 | `8404448` 최초 유입; 이후 파일 변경 없음 |
| `art/level_off.png` | 기존 PNG | L: [프롬프트](../art-prompts.md), [포장](../make-assets.ps1) | UNVERIFIED — 개별 생성 원본·저작자·허가문 미확인 | `8404448` 최초 유입; 이후 파일 변경 없음 |
| `art/level_on.png` | 기존 PNG | L: [프롬프트](../art-prompts.md), [포장](../make-assets.ps1) | UNVERIFIED — 개별 생성 원본·저작자·허가문 미확인 | `8404448` 최초 유입; 이후 파일 변경 없음 |
| `art/scrap.png` | 기존 PNG | L: [프롬프트](../art-prompts.md), [포장](../make-assets.ps1) | UNVERIFIED — 개별 생성 원본·저작자·허가문 미확인 | `8404448` 최초 유입; 이후 파일 변경 없음 |
| `art/ship.png` | 기존 PNG | L: [프롬프트](../art-prompts.md), [포장](../make-assets.ps1) | UNVERIFIED — 개별 생성 원본·저작자·허가문 미확인 | `8404448` 최초 유입; 이후 파일 변경 없음 |
| `art/slit_off.png` | 기존 PNG | L: [프롬프트](../art-prompts.md), [포장](../make-assets.ps1) | UNVERIFIED — 개별 생성 원본·저작자·허가문 미확인 | `8404448` 최초 유입; 이후 파일 변경 없음 |
| `art/slit_on.png` | 기존 PNG | L: [프롬프트](../art-prompts.md), [포장](../make-assets.ps1) | UNVERIFIED — 개별 생성 원본·저작자·허가문 미확인 | `8404448` 최초 유입; 이후 파일 변경 없음 |
| `art/strategy-map.png` | 전략 PNG | S: [제작 기록](media-production.md), 원본 `exec-c80d3cea-77e2-48a8-ac70-bf474e9caf91.png` | SOURCE_VERIFIED — 기록된 로컬 생성 원본과 SHA-256 일치; 상세 결과는 `.omo/evidence/ulw/commercial-20261018-01a139fb/G002-baseline-qa/a1/task-5/inventory.json` (로컬 검증 기록; 저장소 미포함)의 generatedOriginals 참조; 권리 근거 미확인 | 2026-10-14 초기 지도에서 제련 시설을 냉간 가공시설로 수정; `bc41730` 유입 |
| `art/strategy-office.png` | 전략 PNG | S: [제작 기록](media-production.md), 원본 `exec-d06030f5-94f8-4ce9-a449-9346bb670df1.png` | SOURCE_VERIFIED — 기록된 로컬 생성 원본과 SHA-256 일치; 상세 결과는 `.omo/evidence/ulw/commercial-20261018-01a139fb/G002-baseline-qa/a1/task-5/inventory.json` (로컬 검증 기록; 저장소 미포함)의 generatedOriginals 참조; 권리 근거 미확인 | 2026-10-14 초기 사무실의 원경 및 도면을 냉간 가공시설로 수정; `bc41730` 유입 |
| `art/strategy-officers.webp` | neutral 무손실 WebP | S: [제작 기록](media-production.md#staff-expressions--2026-10-18-t9), 원본 `source-art/strategy-officers.png` | SOURCE_VERIFIED — `.omo/evidence/ulw/commercial-20261018-01a139fb/G003-trust-v1-checkpoint/a1/task-9/pixel-proof.json` (로컬 검증 기록; 저장소 미포함)의 원본 RGBA 일치; 권리 근거 미확인 | 2026-10-18 원본 PNG 보존 후 배포 인코딩 변경 |
| `art/strategy-officers-concerned.webp` | concerned 무손실 WebP | [T9 제작 기록](media-production.md#staff-expressions--2026-10-18-t9), 내장 imagegen 원본 `exec-52238584-cbab-4d3a-9914-040a78ed907b.png` | SOURCE_VERIFIED — 생성 PNG와 디코딩 RGBA 일치; 별도 권리 인증 아님 | 2026-10-18 원본 6인 표정 편집 |
| `art/strategy-officers-positive.webp` | positive 무손실 WebP | [T9 제작 기록](media-production.md#staff-expressions--2026-10-18-t9), 내장 imagegen 원본 `exec-afc4d287-acb7-496e-840b-c720fe5f9244.png` | SOURCE_VERIFIED — 생성 PNG와 디코딩 RGBA 일치; 별도 권리 인증 아님 | 2026-10-18 원본 6인 표정 편집 |
| `art/staff-expressions.json` | 초상 상태 manifest | [T9 계약](../art/staff-expressions.json), `ui.js`의 여섯 직원 identity/이름/담당 | SOURCE_VERIFIED — 18개 상태·실재 파일·셀·neutral 및 이름/담당 fallback 검증 | 2026-10-18 추가; 경제·난수와 무관 |
| `art/locations/customers.webp` | 공간 WebP · 거래처 | [제작 기록](../source-art/locations/20261021/README.md), [프롬프트](../source-art/locations/20261021/generation-prompts.json), 원본 `source-art/locations/20261021/customers.png` | SOURCE_VERIFIED — 원본·배포본 SHA-256을 [manifest](../source-art/locations/20261021/manifest.json)와 현재 대조; 상업 이용 권리 미확인 | 2026-10-21 제작 기록; 무손실 변환 설명은 제작 기록 참조 |
| `art/locations/factory.webp` | 공간 WebP · 가공 공장 | [제작 기록](../source-art/locations/20261021/README.md), [프롬프트](../source-art/locations/20261021/generation-prompts.json), 원본 `source-art/locations/20261021/factory.png` | SOURCE_VERIFIED — 원본·배포본 SHA-256을 [manifest](../source-art/locations/20261021/manifest.json)와 현재 대조; 상업 이용 권리 미확인 | 2026-10-21 제작 기록; 무손실 변환 설명은 제작 기록 참조 |
| `art/locations/port.webp` | 공간 WebP · 수입 항만 | [제작 기록](../source-art/locations/20261021/README.md), [프롬프트](../source-art/locations/20261021/generation-prompts.json), 원본 `source-art/locations/20261021/port.png` | SOURCE_VERIFIED — 원본·배포본 SHA-256을 [manifest](../source-art/locations/20261021/manifest.json)와 현재 대조; 상업 이용 권리 미확인 | 2026-10-21 제작 기록; 무손실 변환 설명은 제작 기록 참조 |
| `art/locations/yard.webp` | 공간 WebP · 소재 야드 | [제작 기록](../source-art/locations/20261021/README.md), [프롬프트](../source-art/locations/20261021/generation-prompts.json), 원본 `source-art/locations/20261021/yard.png` | SOURCE_VERIFIED — 원본·배포본 SHA-256을 [manifest](../source-art/locations/20261021/manifest.json)와 현재 대조; 상업 이용 권리 미확인 | 2026-10-21 제작 기록; 무손실 변환 설명은 제작 기록 참조 |
| `art/opening/factory.webp` | 오프닝 WebP · 냉간 코일 공장 | [제작 기록·프롬프트](opening-media.md), 보존 원본 `source-art/opening/factory.png` | DOCUMENTED_UNVERIFIED — 생성·무손실 변환 기록과 보존 원본 있음; 현재 파일 해시 기록, 이번 검사에서 디코딩 픽셀 동등성·권리 미확인 | 2026-10-21 제작 기록; 선택 캐시 자산 |
| `art/opening/harbor.webp` | 오프닝 WebP · 새벽 산업항 | [제작 기록·프롬프트](opening-media.md), 보존 원본 `source-art/opening/harbor.png` | DOCUMENTED_UNVERIFIED — 생성·무손실 변환 기록과 보존 원본 있음; 현재 파일 해시 기록, 이번 검사에서 디코딩 픽셀 동등성·권리 미확인 | 2026-10-21 제작 기록; 선택 캐시 자산 |
| `art/opening/studio-calligraphy.png` | 오프닝 PNG · 선택된 C안 붓 흘림체 | [제작 기록](../source-art/opening/calligraphy-20261021/README.md), [프롬프트](../source-art/opening/calligraphy-20261021/prompts.json), 원본 `c-flow.png` | SOURCE_VERIFIED — 보존 원본과 현재 배포본의 SHA-256 일치; 상업 이용 권리 미확인 | 2026-10-21 선택 기록; 불투명 원본의 두 영역을 표시 |
| `art/opening/ethan.svg` | 이전 독립 SVG 로고 | [이전 시안 기록](opening-pixel-logos.md), [생성 소스](../scripts/render-opening-logos.mjs) | SOURCE_VERIFIED — 격리 위치에서 재생성한 바이트와 일치; 상업 이용 권리 미확인 | 런타임은 C안으로 교체했으나 빌드 전체 복사로 여전히 배포 |
| `art/opening/gonsama.svg` | 이전 독립 SVG 로고 | [이전 시안 기록](opening-pixel-logos.md), [생성 소스](../scripts/render-opening-logos.mjs) | SOURCE_VERIFIED — 격리 위치에서 재생성한 바이트와 일치; 상업 이용 권리 미확인 | 런타임은 C안으로 교체했으나 빌드 전체 복사로 여전히 배포 |
| `icon-192.png` | 앱 PNG 아이콘 | [manifest](../manifest.webmanifest), [빌드](../scripts/build.mjs)에서 배포 참조 확인 | UNVERIFIED — 생성 원본·저작자·라이선스 근거 미확인 | `8404448` 최초 유입; 이후 파일 변경 없음 |
| `icon-512.png` | 앱 PNG 아이콘 | [manifest](../manifest.webmanifest), [빌드](../scripts/build.mjs)에서 배포 참조 확인 | UNVERIFIED — 생성 원본·저작자·라이선스 근거 미확인 | `8404448` 최초 유입; 이후 파일 변경 없음 |

`source-art/strategy-officers.png`는 2026-10-14 원본을 바이트 그대로 보존한 **비배포 제작 소스**다. SHA-256 `2848705ba69d47ed3477e5c60248bf9600d43956876dbb7c622250fc23ca6d56`이며 기록된 로컬 생성 원본과 대조했다. 기존 `art/strategy-officers.png`를 이동했으며 이력·과거 QA의 PNG 경로는 당시 기록이다. 현재 배포는 위 WebP 세 장과 JSON이다.

## 음악·징글·효과음

[`audio-production.md`](audio-production.md)는 로컬 악보·합성으로 기존 BGM 6개, 징글 3개, 효과음 12개 제작을 기록한다. 현재 목록은 여기에 [`music/opening.mjs`](../music/opening.mjs)의 72초 오프닝 음악 1개를 더한 총 22개다. 실제 [`music/score.mjs`](../music/score.mjs)의 음표·음색 지정, [`music/synth.mjs`](../music/synth.mjs)의 FM/노이즈 합성, [`music/wav.mjs`](../music/wav.mjs)의 PCM 인코더, [`scripts/render-audio.mjs`](../scripts/render-audio.mjs)의 해시·출력 절차를 대조했다. 현재 제작 코드에는 외부 샘플을 읽거나 다운로드하는 경로가 없다. 이는 선율의 독창성 또는 권리 귀속에 대한 법적 판단이 아니다. 별도 자산 라이선스/권리 양도 문서는 미확인이다.

각 파일의 sourceHash는 현재 렌더러가 지정한 `music/opening.mjs → music/score.mjs → music/synth.mjs → music/wav.mjs → scripts/render-audio.mjs` 다섯 파일을 순서대로 연결한 SHA-256이다. [manifest](../audio/manifest.json)의 22개 fileHash 및 sourceHash를 현재 파일과 대조하고, 실제 제작 함수를 메모리에서 실행해 WAV 바이트를 재현한다. 2026-10-22 파일별 해시·재현 결과는 `.omo/evidence/ulw/commercial-readiness-20261022-01a139fb/G001-release-candidate-48-16-desktop-mobi/a1/inventory-fix/verification.json` (로컬 검증 기록; 저장소 미포함)에 기록했다. 이전 21곡 검사 기록은 당시의 역사 자료다. 재현 확인은 현재 Node 환경에 한정하며 청취 평가를 대신하지 않는다.

| 경로 / 식별자 | 종류 | origin / generation reference | 저작·라이선스 근거와 확인 상태 | 변경 이력 |
|---|---|---|---|---|
| `audio/manifest.json` | 음원 배포 manifest | [렌더러](../scripts/render-audio.mjs)의 22곡 메타데이터 | SOURCE_VERIFIED — 현재 경로·fileHash·sourceHash와 실제 WAV 대조; 권리 인증 아님 | 오프닝 1곡 추가 반영 |
| `audio/opening.wav` | cinematic · 철의 항로 · 72초 | [오프닝 악보](../music/opening.mjs) → [합성](../music/synth.mjs) → [렌더러](../scripts/render-audio.mjs) | SOURCE_VERIFIED — 현재 WAV 재현 해시·sourceHash 대조; 상업 이용 권리 미확인 | 2026-10-21 오프닝 제작 기록; 반복 없는 전용 음악 |
| `audio/title.wav` | bgm · 첫 발령 | [악보](../music/score.mjs) `title` → [합성](../music/synth.mjs) → [렌더러](../scripts/render-audio.mjs) | SOURCE_VERIFIED — 재현 해시 대조; 별도 권리 근거 미확인 | 2026-10-14 제작 기록; `bc41730` 유입 후 변경 없음 |
| `audio/map.wav` | bgm · 강철의 항로 | [악보](../music/score.mjs) `map` → [합성](../music/synth.mjs) → [렌더러](../scripts/render-audio.mjs) | SOURCE_VERIFIED — 재현 해시 대조; 별도 권리 근거 미확인 | 2026-10-14 제작 기록; `bc41730` 유입 후 변경 없음 |
| `audio/office.wav` | bgm · 책상 위의 세계 | [악보](../music/score.mjs) `office` → [합성](../music/synth.mjs) → [렌더러](../scripts/render-audio.mjs) | SOURCE_VERIFIED — 재현 해시 대조; 별도 권리 근거 미확인 | 2026-10-14 제작 기록; `bc41730` 유입 후 변경 없음 |
| `audio/decision.wav` | bgm · 결재의 시간 | [악보](../music/score.mjs) `decision` → [합성](../music/synth.mjs) → [렌더러](../scripts/render-audio.mjs) | SOURCE_VERIFIED — 재현 해시 대조; 별도 권리 근거 미확인 | 2026-10-14 제작 기록; `bc41730` 유입 후 변경 없음 |
| `audio/downturn.wav` | bgm · 차가운 시황 | [악보](../music/score.mjs) `downturn` → [합성](../music/synth.mjs) → [렌더러](../scripts/render-audio.mjs) | SOURCE_VERIFIED — 재현 해시 대조; 별도 권리 근거 미확인 | 2026-10-14 제작 기록; `bc41730` 유입 후 변경 없음 |
| `audio/ending.wav` | bgm · 남겨진 항로 | [악보](../music/score.mjs) `ending` → [합성](../music/synth.mjs) → [렌더러](../scripts/render-audio.mjs) | SOURCE_VERIFIED — 재현 해시 대조; 별도 권리 근거 미확인 | 2026-10-14 제작 기록; `bc41730` 유입 후 변경 없음 |
| `audio/month-close.wav` | jingle · 월 결산 | [악보](../music/score.mjs) `month-close` → [합성](../music/synth.mjs) → [렌더러](../scripts/render-audio.mjs) | SOURCE_VERIFIED — 재현 해시 대조; 별도 권리 근거 미확인 | 2026-10-14 제작 기록; `bc41730` 유입 후 변경 없음 |
| `audio/term-complete.wav` | jingle · 임기 완료 | [악보](../music/score.mjs) `term-complete` → [합성](../music/synth.mjs) → [렌더러](../scripts/render-audio.mjs) | SOURCE_VERIFIED — 재현 해시 대조; 별도 권리 근거 미확인 | 2026-10-14 제작 기록; `bc41730` 유입 후 변경 없음 |
| `audio/company-failure.wav` | jingle · 경영 종료 | [악보](../music/score.mjs) `company-failure` → [합성](../music/synth.mjs) → [렌더러](../scripts/render-audio.mjs) | SOURCE_VERIFIED — 재현 해시 대조; 별도 권리 근거 미확인 | 2026-10-14 제작 기록; `bc41730` 유입 후 변경 없음 |
| `audio/select.wav` | sfx · 선택 | [악보](../music/score.mjs) `select` → [합성](../music/synth.mjs) → [렌더러](../scripts/render-audio.mjs) | SOURCE_VERIFIED — 재현 해시 대조; 별도 권리 근거 미확인 | 2026-10-14 제작 기록; `bc41730` 유입 후 변경 없음 |
| `audio/confirm.wav` | sfx · 확인 | [악보](../music/score.mjs) `confirm` → [합성](../music/synth.mjs) → [렌더러](../scripts/render-audio.mjs) | SOURCE_VERIFIED — 재현 해시 대조; 별도 권리 근거 미확인 | 2026-10-14 제작 기록; `bc41730` 유입 후 변경 없음 |
| `audio/cancel.wav` | sfx · 닫기 | [악보](../music/score.mjs) `cancel` → [합성](../music/synth.mjs) → [렌더러](../scripts/render-audio.mjs) | SOURCE_VERIFIED — 재현 해시 대조; 별도 권리 근거 미확인 | 2026-10-14 제작 기록; `bc41730` 유입 후 변경 없음 |
| `audio/paper-open.wav` | sfx · 장부 열기 | [악보](../music/score.mjs) `paper-open` → [합성](../music/synth.mjs) → [렌더러](../scripts/render-audio.mjs) | SOURCE_VERIFIED — 재현 해시 대조; 별도 권리 근거 미확인 | 2026-10-14 제작 기록; `bc41730` 유입 후 변경 없음 |
| `audio/officer.wav` | sfx · 직원 | [악보](../music/score.mjs) `officer` → [합성](../music/synth.mjs) → [렌더러](../scripts/render-audio.mjs) | SOURCE_VERIFIED — 재현 해시 대조; 별도 권리 근거 미확인 | 2026-10-14 제작 기록; `bc41730` 유입 후 변경 없음 |
| `audio/dossier-next.wav` | sfx · 다음 안건 | [악보](../music/score.mjs) `dossier-next` → [합성](../music/synth.mjs) → [렌더러](../scripts/render-audio.mjs) | SOURCE_VERIFIED — 재현 해시 대조; 별도 권리 근거 미확인 | 2026-10-14 제작 기록; `bc41730` 유입 후 변경 없음 |
| `audio/stamp.wav` | sfx · 결재 도장 | [악보](../music/score.mjs) `stamp` → [합성](../music/synth.mjs) → [렌더러](../scripts/render-audio.mjs) | SOURCE_VERIFIED — 재현 해시 대조; 별도 권리 근거 미확인 | 2026-10-14 제작 기록; `bc41730` 유입 후 변경 없음 |
| `audio/order.wav` | sfx · 발주 | [악보](../music/score.mjs) `order` → [합성](../music/synth.mjs) → [렌더러](../scripts/render-audio.mjs) | SOURCE_VERIFIED — 재현 해시 대조; 별도 권리 근거 미확인 | 2026-10-14 제작 기록; `bc41730` 유입 후 변경 없음 |
| `audio/error.wav` | sfx · 입력 오류 | [악보](../music/score.mjs) `error` → [합성](../music/synth.mjs) → [렌더러](../scripts/render-audio.mjs) | SOURCE_VERIFIED — 재현 해시 대조; 별도 권리 근거 미확인 | 2026-10-14 제작 기록; `bc41730` 유입 후 변경 없음 |
| `audio/month-turn.wav` | sfx · 달력 넘김 | [악보](../music/score.mjs) `month-turn` → [합성](../music/synth.mjs) → [렌더러](../scripts/render-audio.mjs) | SOURCE_VERIFIED — 재현 해시 대조; 별도 권리 근거 미확인 | 2026-10-14 제작 기록; `bc41730` 유입 후 변경 없음 |
| `audio/save.wav` | sfx · 저장 | [악보](../music/score.mjs) `save` → [합성](../music/synth.mjs) → [렌더러](../scripts/render-audio.mjs) | SOURCE_VERIFIED — 재현 해시 대조; 별도 권리 근거 미확인 | 2026-10-14 제작 기록; `bc41730` 유입 후 변경 없음 |
| `audio/alert.wav` | sfx · 경고 | [악보](../music/score.mjs) `alert` → [합성](../music/synth.mjs) → [렌더러](../scripts/render-audio.mjs) | SOURCE_VERIFIED — 재현 해시 대조; 별도 권리 근거 미확인 | 2026-10-14 제작 기록; `bc41730` 유입 후 변경 없음 |

`audio/manifest.json`도 배포하는 메타데이터다. 22개 음원의 경로·종류·음량·길이·루프 경계·파일/소스 해시를 위 렌더러에서 생성하며, 현재 WAV와의 대조 결과는 같은 검증 자료에 기록한다.

## 폰트 의존성

현재 빌드는 `shell.html`의 `<style>`만 추출하고 새 HTML을 만든다. [shell.html](../shell.html)의 CDN `<link>` 두 개는 현재 배포 HTML에 포함되지 않는다. 생성 CSS에는 기존 family 참조도 남으므로 목록에서 제외하지 않았다. [`src/ui/theme.css`](../src/ui/theme.css)는 `--sans`를 시스템 스택으로 재정의하고 [`src/ui/strategy-theme.css`](../src/ui/strategy-theme.css)는 본문·제목 토큰을 정의한다. 아래의 `font:`는 파일 경로가 아닌 CSS dependency 식별자다. 현재 빌드에 폰트 바이너리 및 `@font-face`/`@import`는 없고, 실제 선택되는 로컬 폰트는 사용자 OS·설치 환경에 달려 있다.

| 경로 / 식별자 | 종류 | origin / generation reference | 저작·라이선스 근거와 확인 상태 | 변경 이력 |
|---|---|---|---|---|
| `font:Pretendard` | CSS family | [shell.html](../shell.html) | LOCAL_REFERENCE — 파일 미포함; 개별 폰트 라이선스·사용자 설치 권한 미확인 | shell 기존 스택 `8404448`; 현재 테마 스택 `bc41730` |
| `font:Pretendard Variable` | CSS family | [shell.html](../shell.html) | LOCAL_REFERENCE — 파일 미포함; 개별 폰트 라이선스·사용자 설치 권한 미확인 | shell 기존 스택 `8404448`; 현재 테마 스택 `bc41730` |
| `font:Galmuri11` | CSS family | [shell.html](../shell.html) | LOCAL_REFERENCE — 파일 미포함; 개별 폰트 라이선스·사용자 설치 권한 미확인 | shell 기존 스택 `8404448`; 현재 테마 스택 `bc41730` |
| `font:Galmuri11 Condensed` | CSS family | [shell.html](../shell.html) | LOCAL_REFERENCE — 파일 미포함; 개별 폰트 라이선스·사용자 설치 권한 미확인 | shell 기존 스택 `8404448`; 현재 테마 스택 `bc41730` |
| `font:Apple SD Gothic Neo` | CSS family | [테마](../src/ui/theme.css), [전략 테마](../src/ui/strategy-theme.css) | LOCAL_REFERENCE — 파일 미포함; 개별 폰트 라이선스·사용자 설치 권한 미확인 | shell 기존 스택 `8404448`; 현재 테마 스택 `bc41730` |
| `font:Malgun Gothic` | CSS family | [테마](../src/ui/theme.css), [전략 테마](../src/ui/strategy-theme.css) | LOCAL_REFERENCE — 파일 미포함; 개별 폰트 라이선스·사용자 설치 권한 미확인 | shell 기존 스택 `8404448`; 현재 테마 스택 `bc41730` |
| `font:system-ui` | CSS family | [테마](../src/ui/theme.css), [전략 테마](../src/ui/strategy-theme.css) | LOCAL_REFERENCE — 파일 미포함; 개별 폰트 라이선스·사용자 설치 권한 미확인 | shell 기존 스택 `8404448`; 현재 테마 스택 `bc41730` |
| `font:sans-serif` | CSS family | [테마](../src/ui/theme.css), [전략 테마](../src/ui/strategy-theme.css) | LOCAL_REFERENCE — 파일 미포함; 개별 폰트 라이선스·사용자 설치 권한 미확인 | shell 기존 스택 `8404448`; 현재 테마 스택 `bc41730` |
| `font:-apple-system` | CSS family | [테마](../src/ui/theme.css), [전략 테마](../src/ui/strategy-theme.css) | LOCAL_REFERENCE — 파일 미포함; 개별 폰트 라이선스·사용자 설치 권한 미확인 | shell 기존 스택 `8404448`; 현재 테마 스택 `bc41730` |
| `font:AppleMyungjo` | CSS family | [테마](../src/ui/theme.css), [전략 테마](../src/ui/strategy-theme.css) | LOCAL_REFERENCE — 파일 미포함; 개별 폰트 라이선스·사용자 설치 권한 미확인 | shell 기존 스택 `8404448`; 현재 테마 스택 `bc41730` |
| `font:Batang` | CSS family | [테마](../src/ui/theme.css), [전략 테마](../src/ui/strategy-theme.css) | LOCAL_REFERENCE — 파일 미포함; 개별 폰트 라이선스·사용자 설치 권한 미확인 | shell 기존 스택 `8404448`; 현재 테마 스택 `bc41730` |
| `font:Georgia` | CSS family | [테마](../src/ui/theme.css), [전략 테마](../src/ui/strategy-theme.css) | LOCAL_REFERENCE — 파일 미포함; 개별 폰트 라이선스·사용자 설치 권한 미확인 | shell 기존 스택 `8404448`; 현재 테마 스택 `bc41730` |
| `font:serif` | CSS family | [테마](../src/ui/theme.css), [전략 테마](../src/ui/strategy-theme.css) | LOCAL_REFERENCE — 파일 미포함; 개별 폰트 라이선스·사용자 설치 권한 미확인 | shell 기존 스택 `8404448`; 현재 테마 스택 `bc41730` |

원본 단일 파일 경로의 외부 의존성도 구분해 보존한다. 아래 URL 문자열 존재만 확인했으며 원격 파일을 내려받거나 현재 라이선스를 검증하지 않았다. 현재 dist의 네트워크 의존성으로 집계하지 않는다.

| 원본 shell 외부 링크 | 용도 | 현재 빌드 | 확인 상태 |
|---|---|---|---|
| `https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.css` | Pretendard Variable CSS, 버전 1.3.9 지정 | 제외 | DOCUMENTED_UNVERIFIED — [shell](../shell.html) 링크만 확인; 원격 라이선스 미확인 |
| `https://cdn.jsdelivr.net/npm/galmuri/dist/galmuri.css` | Galmuri CSS, 버전 미고정 | 제외 | DOCUMENTED_UNVERIFIED — [shell](../shell.html) 링크만 확인; 원격 라이선스 미확인 |

## 재검증과 남은 확인

2026-10-22 로컬 검사에 사용한 `.omo/evidence/ulw/commercial-readiness-20261022-01a139fb/G001-release-candidate-48-16-desktop-mobi/a1/inventory-fix/verify-inventory.mjs` (로컬 검증 기록; 저장소 미포함)는 격리 출력으로 실제 빌드를 실행하고, 배포된 art 38개·아이콘 2개·WAV 22개와 등록부의 경로 집합을 대조한다. `audio/manifest.json`과 release manifest의 파일별 바이트·SHA-256도 확인했다. 이 스크립트는 과거 로컬 검증 도구이며 저장소 복제본에서 실행할 수 있는 명령이 아니다. 실제 파일 누락·잉여와 해시 불일치는 실패이며, 임시 inventory에 미등록 그림을 추가한 대조 검사에서 누락이 검출되어야 한다. 결과는 `.omo/evidence/ulw/commercial-readiness-20261022-01a139fb/G001-release-candidate-48-16-desktop-mobi/a1/inventory-fix/verification.json` (로컬 검증 기록; 저장소 미포함), 명령·범위·정리는 `.omo/evidence/ulw/commercial-readiness-20261022-01a139fb/G001-release-candidate-48-16-desktop-mobi/a1/inventory-fix/report.md` (로컬 검증 기록; 저장소 미포함)를 따른다.

2026-10-18 T5/T9 기록은 당시 그림·음원·표정 검사에 대한 역사 자료다. 새 공간 원화는 제작 manifest의 PNG/WebP 해시를 현재 직접 대조했고, 선택된 C안은 보존 PNG와 배포본을 직접 비교했다. 오프닝 공장·항구의 무손실 변환 설명은 제작 기록이며 이번 검사에서 픽셀 동등성을 새로 입증한 것은 아니다.

기존 원본 그림 23개와 아이콘 2개의 출처·권리 근거는 여전히 미확인이다. 추가 자산의 제작 소스·프롬프트·해시 일치도 법적 상업 이용 허락을 대신하지 않는다. 권리자·생성 서비스 약관·필요 허가의 수동 확인, 물리 iOS/Safari 설치와 사람의 헤드폰/스피커 청취는 별도 출고 선행 조건이다. 현재 자료만으로 상업 배포 준비 완료를 선언하지 않는다.
