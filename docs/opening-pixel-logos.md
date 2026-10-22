# 오프닝 독립 SVG 로고 — 이전 시안 기록

이 로고는 이후 사용자가 선택한 C안의 붓 흘림체로 교체했다. 현재 구현은 [오프닝 문서](opening.md), 선택된 이미지와 제작 과정은 [필기체 시안 기록](../source-art/opening/calligraphy-20261021/README.md)을 따른다. 아래 설명과 검증은 이전 SVG 시안에 대한 기록이다.

2026-10-21 본편 작화 통일 개정. 사용자가 거절한 320×200 전체 화면·5×7 이름 글리프·강제 픽셀 확대 버전은 이전 시안이다. 현재 `scripts/render-opening-logos.mjs`는 작은 독립 SVG 심벌만 결정적으로 생성한다. 실행은 `node scripts/render-opening-logos.mjs`다. 두 문장은 이 프로젝트에서 직접 작성했으며 외부 로고, 이미지 생성 API, 외부 패키지를 사용하지 않았다.

| 자산 | viewBox | 평면 색 | 별도 HTML 이름 |
| --- | --- | --- | --- |
| `art/opening/gonsama.svg` | 80×64 | 상아 `#e9e1cc`, 황동 `#d8b56f` | Production Gonsama |
| `art/opening/ethan.svg` | 80×64 | 상아 `#e9e1cc`, 회녹색 `#708c87` | Ethan.J Studio |

곤사마는 코일 단면을 닮은 열린 G, 이던 제이는 E와 J의 단순한 모노그램이다. 배경은 투명하며 본편 남색 `#0b1b24` 위에 놓는다. SVG에는 이름·검정 전체 프레임·비트맵 글리프·장식 테두리·그라데이션·필터가 없다. 기본 벡터 렌더링을 사용해 약 112px 표시에서도 윤곽이 선명하다.

제작사 이름은 SVG 아래 실제 HTML로 표시한다. 본편 `--cc-font-title`/`--cc-font-body`와 상아·황동색을 따르며 글자 배율과 화면 너비에 대응한다. 심벌 크기와 이름 크기는 독립적이다. SVG를 전체 장면으로 확대하거나 이름을 그림으로 래스터화하지 않는다.

## 이전 픽셀 버전의 글꼴 출처 (역사 기록)

이전 320×200 픽셀 버전에서는 Galmuri 2.40.3의 Regular WOFF2를 사용했다. 현재 오프닝은 본편의 제목·본문 글꼴을 사용하며 아래는 배포에서 제외한 자산의 출처 기록이다. 저작권 표시와 SIL Open Font License 1.1 전문은 `source-art/opening/pixel-attempt/fonts/OFL.md`에 원문 그대로 보존한다. 새 런타임 의존성이나 CDN 요청은 없다.

- 공식 저장소: [quiple/galmuri](https://github.com/quiple/galmuri)
- 고정 커밋: `71e1cacf1437a11220307120e63e30bc275312d4`
- 폰트 원본: [dist/Galmuri11.woff2](https://github.com/quiple/galmuri/blob/71e1cacf1437a11220307120e63e30bc275312d4/dist/Galmuri11.woff2)
- 라이선스 원본: [ofl.md](https://github.com/quiple/galmuri/blob/71e1cacf1437a11220307120e63e30bc275312d4/ofl.md)
- 보관 경로: `source-art/opening/pixel-attempt/fonts/Galmuri11.woff2` (505,400 bytes)
- WOFF2 SHA-256: `8bad9322b3340bfb5cb26cb00f4752bf4c8e7d1b526bb07205f4af458eebed31`
- OFL SHA-256: `9a9e5a342c430c3fcf01a408b680f4405d5bf4ac659c931be35f8a1b27ea69c9`

## 당시 SVG 자산의 로컬 검증 기록

당시 `.omo/evidence/opening-flat-marks/verify.py` (로컬 검증 스크립트; 저장소 미포함)를 실행해 80×64 viewBox, 허용된 두 평면 색, 두 path, 투명 배경, 이름과 효과의 부재, 두 번 생성한 바이트의 일치 여부를 검사했다. `rsvg-convert`로 실제 112px 폭 PNG를 출력하고 투명도와 시각 결과를 확인했다. 기록은 같은 로컬 폴더의 `verification.json`, `gonsama.png`, `ethan.png`이며 저장소에 포함하지 않는다. 이는 과거 로컬 검증 절차로, 저장소 복제본에서 실행할 수 있는 명령이 아니다. 당시 게임의 HTML 이름·배율·시간축·건너뛰기는 통합 브라우저 QA의 별도 확인 대상이었다.

이전 `.omo/evidence/opening-pixel-logos/` 기록(로컬 검증 기록; 저장소 미포함)은 폐기된 픽셀 시안의 역사 자료이며 현재 결과의 통과 근거가 아니다.
