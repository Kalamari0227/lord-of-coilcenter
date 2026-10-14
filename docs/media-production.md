# Strategy game media production

## Domain corrections

Initial map and office generations incorrectly included steelmaking towers. Both were corrected with built-in image editing after viewing the local inputs. Final visual inspection confirms broad cold-coil processing halls, silver cold coils and gantry cranes; no blast furnace or hot orange steel. Office technical drawing now depicts coil processing rollers.

### Map revision prompt

Use case: precise-object-edit. This map is for a cold steel coil service center, NOT a steelmaking smelter. Change ONLY the central factory complex. Replace the central blast-furnace towers, smokestacks, tall refinery apparatus and hot glowing orange steel with broad low-roof slitting and leveling factory halls, open loading bays containing COLD silver-gray steel coils, orderly pallets, internal cold-sheet rollers and overhead gantry cranes. No glowing molten steel, no blast furnaces, no smokestacks. Preserve exact landscape composition, isometric camera, pixel-art/dithering style, palette, lighting, map regions, headquarters upper left, automotive customer factories upper right, coil storage lower left, harbor cranes and cargo ship lower right, hills, city and sea. No text, markers, labels or UI.

### Office revision prompt

Use case: precise-object-edit. Correct this fictional cold-coil service-center office scene: change ONLY the distant industrial architecture outside the windows and the subject of the framed technical drawing. Remove every blast-furnace tower and smokestack outside, replacing them with low-roof cold-coil slitting/leveling halls and gantry cranes. Keep the outdoor cold silver steel coils and harbor cranes. Replace the framed drawing of a smelter with a precise unlabelled line drawing of cold-coil slitting rollers and a low-roof warehouse. No smelting, hot glow or molten steel anywhere. Preserve entire office interior, desk, phone, folders, chairs, windows, sunrise light, camera, composition, 1990s PC98 pixel art and dithering, dimensions and palette. No people, labels, readable text, UI or new objects.

Final generated map source: `/Users/ethanlee/.codex/generated_images/01a13a15-8853-7623-87ab-84c134225b3f/exec-c80d3cea-77e2-48a8-ac70-bf474e9caf91.png`.

Final generated office source: `/Users/ethanlee/.codex/generated_images/01a13a15-8853-7623-87ab-84c134225b3f/exec-d06030f5-94f8-4ce9-a449-9346bb670df1.png`.


Created 2026-10-14 using the built-in `image_gen.imagegen` tool through the imagegen skill. No paid API/CLI fallback and no external reference images were used. The scenes and six fictional people are newly generated original illustrations. Source concepts: the repository's coil-center setting and existing six officer roles; user's requested classic strategy simulation direction. No existing Koei or Renaissance image was copied.

## Deliverables and inspection

| Asset | Dimensions | Visual inspection |
|---|---|---|
| `art/strategy-map.png` | 1586 × 992 | Industrial coastal map, central plant, upper-left headquarters, upper-right automotive factories, lower-left coil storage, lower-right cargo port; no UI or text. |
| `art/strategy-office.png` | 1586 × 992 | Manager office, telephone, plans, sunrise coil-yard window; no people or UI. |
| `art/strategy-officers.png` | 1536 × 1024 | Three columns × two rows of six distinct human busts; 512 × 512 cells. Row order: Jung, Seo, Gu / Han, Oh, Lin. No names or frames. |

Binary dimensions were verified with `sips -g pixelWidth -g pixelHeight art/strategy-map.png art/strategy-office.png art/strategy-officers.png`. The generated images were visually inspected directly in tool output before copying unchanged into `art/`. Matching dimensions and six complete portrait cells are observable in the PNG files themselves. Runtime integration and browser layout are verified separately by the implementing agent.

## Generation prompts

### map

Use case: stylized-concept. Asset type: original playable strategy-game map background, landscape 8:5. Create richly detailed 1990s PC-98 strategy simulation pixel art with visible carefully placed pixels, restrained dithering, crisp silhouettes, no blur. A fictional Novaria coastal industrial harbor viewed from elevated isometric angle. Composition anchors: central steel-coil processing factory centered at 50% width 40% height; warehouse and outdoor rolls-of-steel coil yard at 25% width 65% height; cargo harbor with freighter and gantry cranes at 78% width 75% height; automotive customer factories at 80% width 22% height; headquarters office at 25% width 25% height. Connect districts with plausible roads; lush coastal hills and distant urban context. Strong geographic readability at 640x400, intricate small industrial detail. Palette dark teal, navy shadows, sage roofs, warm beige concrete and muted gold sunlight. It must feel like an authentic sophisticated old Japanese PC strategy game world. No text, labels, letters, numbers, logos, buttons, markers, UI, frames or watermark. Original scenery, no copied existing game layout.

### office

Use case: stylized-concept. Asset type: original strategy simulation office scene background, landscape 8:5. Create sophisticated 1990s PC-98 game pixel art with crisp stepped edges and restrained deliberate dithering. Isometric cutaway manager office inside a steel coil processing company. Warm wood desk with period office telephone, paper plans with indistinct linework only, tidy folders, chairs, a side cabinet and wall technical drawing. Large windows overlook steel coils, processing sheds and harbor cranes at sunrise. Strong cohesive readable composition suitable as backdrop to a strategy-game council meeting. No people. Palette dark teal, navy shadows, sage, warm beige and muted gold sunlight. Authentic high-quality early Japanese PC strategy game environmental illustration, not photorealistic, not smooth 3D. No readable text, letters, numbers, logos, buttons, interface, frame or watermark.

### officers

Use case: stylized-concept. Asset type: original six-person portrait atlas for a classic strategy simulation. One image containing exactly THREE equal columns and TWO equal rows, six equal rectangular panels edge to edge, with no gutters, no borders. Each portrait is a waist/chest-up HUMAN character, head and shoulders fully visible with generous breathing room, centered in its own panel, all the same scale. Distinct original fictional characters in mature 1990s PC strategy-game painted pixel-art style, restrained dithering, crisp pixel edges, expressive faces, no photorealism, no chibi. Top row left to right: 1 energetic Korean male sales manager in his 40s, navy jacket and loosened tie, confident smile; 2 quiet polite Korean young male assistant in his 30s with glasses and light shirt, thoughtful expression; 3 gruff older Korean male factory chief in his 50s, industrial safety helmet and grey work jacket, weathered face. Bottom row left to right: 4 cynical Korean male finance manager in his 50s, neat glasses, charcoal suit, dry measured expression; 5 exacting Korean female quality engineer in her 40s, white work jacket holding a clipboard, attentive gaze; 6 warm bright local female manager in her 30s, olive jacket, approachable confident expression. Unified flat dark teal background in every panel. Palette navy, sage, beige, muted gold, natural skin colors. Original characters; no text, labels, names, letters, numbers, frames, logos or watermark.

## Original generated files

- Map: `/Users/ethanlee/.codex/generated_images/01a13a15-8853-7623-87ab-84c134225b3f/exec-50d27376-c603-48c2-9f45-780313e58cac.png`
- Office: `/Users/ethanlee/.codex/generated_images/01a13a15-8853-7623-87ab-84c134225b3f/exec-2fbe0971-c49a-4c10-a88f-9412901fbbe4.png`
- Officers: `/Users/ethanlee/.codex/generated_images/01a13a15-8853-7623-87ab-84c134225b3f/exec-0929af83-66a8-46ae-9b4e-d51856ab15e9.png`
