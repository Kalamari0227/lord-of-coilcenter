# 철의 항로 그림 제작 기록

2026-10-21. 첫 실행 가능한 오프닝의 항구·공장 그림을 내장 image_gen.imagegen으로 새로 제작했다. 첨부 DOS 게임의 파일·그림을 입력으로 제공하지 않았으며, 별도 API/CLI 생성 경로를 사용하지 않았다. 기존 게임의 남색·청록·은색·황동빛과 디더링 질감을 언어로 지정했다.

| 장면 | 보존 원본 | 배포본 | 크기 |
| --- | --- | --- | --- |
| 냉간 코일 공장 | source-art/opening/factory.png | art/opening/factory.webp | 1586×992 |
| 새벽 산업항 | source-art/opening/harbor.png | art/opening/harbor.webp | 1586×992 |

원본 PNG를 복사해 보존하고 cwebp -lossless -z 9로 WebP를 만들었다. 크롭·색 변경·리사이즈 없이 인코딩만 변환했다. 배포본은 art/opening/의 선택 캐시 자산이며 필수 shell 사전 캐시에서는 제외한다. 화면 문자와 로고 이름은 HTML이고 그림에 포함하지 않는다.

육안 검토: 공장 그림은 은색 냉간 코일, 가공 라인과 지붕 크레인, 작은 현장 인물로 구성되며 용광로·용융강·불꽃이 없다. 항구 그림은 현대 화물선·크레인·낮은 창고·산과 바다로 구성된다. 두 그림 모두 게임 인터페이스나 읽을 수 있는 글자가 없다. 장비의 세부 공학 도면 정확도를 검증한 자료는 아니며 오프닝 분위기용 삽화다.

제작 원본:

- factory: /Users/ethanlee/.codex/generated_images/01a139fb-6b3b-7d70-bf59-5b2b37945553/exec-6f6e2015-0373-4f51-98fe-80cefec49b58.png
- harbor: /Users/ethanlee/.codex/generated_images/01a139fb-6b3b-7d70-bf59-5b2b37945553/exec-86c3ddb1-1cb1-4f64-ba7a-26a379df9e17.png

## Factory prompt

Use case: stylized-concept. Asset type: a single original full-screen background keyframe for a classic Korean PC strategy game's opening. Landscape 8:5 aspect ratio, richly detailed 1990s painted pixel art with deliberate restrained dithering and crisp stepped edges, matching a sophisticated coastal industrial strategy game. Inside an impressive COLD steel coil service-center warehouse, viewed from a slightly elevated three-quarter angle down the processing hall. Foreground has several large silver steel coils correctly secured on wooden saddles with central holes facing the viewer; middle distance a cold-sheet leveling and slitting line, distant industrial workers small in scale with safety helmets, overhead gantry cranes and broad high roof trusses. A crane can be parked without lifting any load. No blast furnace, smokestacks, molten metal, glowing hot steel, fire, or sparks. This is a modern cold coil processing plant, not a smelter. Warm late-morning sun through high right-side windows crosses cool navy/teal shadows, and glints across the curved steel. Palette navy #0b1b24, deep teal, steel gray, muted sage, restrained old gold #d8b56f and ivory. Emotional impression of a large living workplace and the anticipation of leading it. Carefully coherent equipment geometry and readable composition at small game-screen size. Full bleed picture, no borders, no panels, no text, no letters, no numbers, no logos, no UI, no watermark. Not photography or smooth 3D; highly crafted painted pixel/dithered illustration.

## Harbor prompt

Use case: stylized-concept. Asset type: one original full-screen background keyframe for the opening of a Korean retro PC business strategy game. Landscape 8:5, full bleed, no text. A beautiful fictional coastal industrial harbor at dawn, seen from an elevated promontory looking out across the bay. A modern bulk cargo freighter slowly approaching in the left middle distance with a restrained curling wake, orderly red cargo cranes and low-roof cold steel coil service-center warehouses on the right shore, coiled silver steel in a small yard, wooded hills enclosing the bay and a distant quiet city. Vast luminous ocean reflecting the first pale golden sunlight through layered clouds, birds tiny in distance. Emotional direction: discovery, departure, a promising new chapter, the world beyond one's desk; hopeful rather than triumphant. Not a battle or dystopia. Richly detailed hand-painted 1990s computer strategy illustration with clearly crafted pixel edges and restrained dithering, elegant sophisticated realistic perspective but not photographic or smooth3D. Palette deep navy #0b1b24 and teal water, muted green hills, steel grey port, pale ivory highlights and restrained old gold #d8b56f. Keep clear sky/sea breathing room, strong foreground/middle/distant planes suitable for a very slow camera movement. Modern ship, not a historical sailing ship. No smokestacks, blast furnaces, molten metal, huge oil refinery, fire or sparks. No readable signage, letters, numbers, logos, title, border, panels, menus, watermark or UI.
