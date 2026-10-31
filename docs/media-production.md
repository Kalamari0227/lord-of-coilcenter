# Strategy game media production

## Journey ending artwork — 2026-10-28

Built-in `image_gen.imagegen` produced eight new ending sources after the existing map, office, opening harbor/factory and location scenes were viewed as style and environment references. Six independent company scenes represent growth, financial stability, customer relationships, production/quality, headquarters contribution and recovery. Two identity-preserving office edits show a completed handover and an early ending. Common/fallback endings reuse the existing office and do not add a ninth image.

Original PNGs and exact prompts/reference hashes are preserved in [`source-art/ending`](../source-art/ending/provenance.json). Runtime deliveries are [`art/ending`](../art/ending), encoded with `cwebp -lossless -z 9 -exact`. The PNG and WebP for every asset decode to identical RGBA pixels at native size; no palette reduction, blur or forced downsampling was used. Width is 1585 or 1586 and height 992, retaining the generated near-8:5 composition. Each WebP is below 3MiB and the eight total 18,928,332 bytes, below the 24MiB art budget.

| Delivery | Intended evidence, not a new simulation fact |
|---|---|
| `legacy-growth.webp` | Existing coil-transfer road and routes; no guaranteed new building |
| `legacy-finance.webp` | Ordered ledgers and a calm yard; no cash pile or debt-free certificate |
| `legacy-customer.webp` | Consultation threshold and waiting shipments; no customer count or signed contract |
| `legacy-craft.webp` | Cold rollers, inspection tools and sheet; no perfect-quality badge or molten steel |
| `legacy-headquarters.webp` | Existing quay, freighter and sea route; no new headquarters or world-conquest map |
| `legacy-recovery.webp` | Familiar equipment, maintenance traces and returning light; no guaranteed restart or debt forgiveness |
| `office-complete.webp` | Same empty office, tidy blank handover papers and morning light; no successor or promotion |
| `office-early.webp` | Same empty office, open blank ledger and subdued afternoon; no closure sign, damage or layoffs |

The source manifest records built-in generation, `paidFallbackUsed:false`, generated/source/delivery SHA-256, prompts and viewed local references. It is provenance and pixel evidence, not an independent certification of commercial rights. The runtime loads only the selected company image and matching office image. All eight are release-hashed but optional, success-200-only cache assets; source PNGs are not shipped. Missing art falls back through existing scene art and finally readable HTML, so it cannot block results.

## Location scene artwork — 2026-10-21

Four new location backgrounds were generated with the built-in `image_gen.imagegen`: processing factory, coil yard, import port and automotive customer premises. The existing office was visually inspected to ground the text prompts in its palette, crisp detailed pixel illustration and warm morning light. Each scene is an independent new generation. All four are 1586×992 PNGs, copied byte-for-byte into [source-art/locations/20261021](../source-art/locations/20261021/README.md). Exact prompts and generated source filenames are in that folder's `generation-prompts.json`; `manifest.json` records dimensions, SHA-256 and exact-copy checks. Generation used no raster post-processing or external API/CLI.

The user approved applying all four scenes. Runtime deliveries are `art/locations/{factory,yard,port,customers}.webp`, encoded losslessly with `cwebp -lossless -z 9 -exact`. They retain the original dimensions and decoded RGBA pixels, totaling 9,556,578 bytes. `.omo/evidence/location-scenes-20261021/assets/pixel-proof.json` (local evidence; not included in the repository) and the source manifest record the comparisons. The shared location renderer in `src/ui/company.js` opens these backgrounds from map buttons and supplies existing staff reports and dossiers. The original office remains unchanged. Navigation state is presentation-only; no time, economic calculation or save fields are added. Delivery images are included in the existing versioned build and offline art cache; source PNGs are not shipped.

## Domain corrections

Initial map and office generations incorrectly included steelmaking towers. Both were corrected with built-in image editing after viewing the local inputs. Final visual inspection confirms broad cold-coil processing halls, silver cold coils and gantry cranes; no blast furnace or hot orange steel. Office technical drawing now depicts coil processing rollers.

### Map revision prompt

Use case: precise-object-edit. This map is for a cold steel coil service center, NOT a steelmaking smelter. Change ONLY the central factory complex. Replace the central blast-furnace towers, smokestacks, tall refinery apparatus and hot glowing orange steel with broad low-roof slitting and leveling factory halls, open loading bays containing COLD silver-gray steel coils, orderly pallets, internal cold-sheet rollers and overhead gantry cranes. No glowing molten steel, no blast furnaces, no smokestacks. Preserve exact landscape composition, isometric camera, pixel-art/dithering style, palette, lighting, map regions, headquarters upper left, automotive customer factories upper right, coil storage lower left, harbor cranes and cargo ship lower right, hills, city and sea. No text, markers, labels or UI.

### Office revision prompt

Use case: precise-object-edit. Correct this fictional cold-coil service-center office scene: change ONLY the distant industrial architecture outside the windows and the subject of the framed technical drawing. Remove every blast-furnace tower and smokestack outside, replacing them with low-roof cold-coil slitting/leveling halls and gantry cranes. Keep the outdoor cold silver steel coils and harbor cranes. Replace the framed drawing of a smelter with a precise unlabelled line drawing of cold-coil slitting rollers and a low-roof warehouse. No smelting, hot glow or molten steel anywhere. Preserve entire office interior, desk, phone, folders, chairs, windows, sunrise light, camera, composition, 1990s PC98 pixel art and dithering, dimensions and palette. No people, labels, readable text, UI or new objects.

Final generated map source: `exec-c80d3cea-77e2-48a8-ac70-bf474e9caf91.png`.

Final generated office source: `exec-d06030f5-94f8-4ce9-a449-9346bb670df1.png`.


Created 2026-10-14 using the built-in `image_gen.imagegen` tool through the imagegen skill. No paid API/CLI fallback and no external reference images were used. The scenes and six fictional people are newly generated original illustrations. Source concepts: the repository's coil-center setting and existing six officer roles; user's requested classic strategy simulation direction. No existing Koei or Renaissance image was copied.

## Deliverables and inspection

| Asset | Dimensions | Visual inspection |
|---|---|---|
| `art/strategy-map.png` | 1586 × 992 | Industrial coastal map, central plant, upper-left headquarters, upper-right automotive factories, lower-left coil storage, lower-right cargo port; no UI or text. |
| `art/strategy-office.png` | 1586 × 992 | Manager office, telephone, plans, sunrise coil-yard window; no people or UI. |
| `source-art/strategy-officers.png` → `art/strategy-officers.webp` | 1536 × 1024 | Original neutral PNG preserved byte-for-byte; lossless WebP delivery added 2026-10-18. Three columns × two rows, 512 × 512 cells: Jung, Seo, Gu / Han, Oh, Lin. |

The 2026-10-14 inspection used `sips -g pixelWidth -g pixelHeight` on the three original PNGs, then inspected the generated images before copying them into `art/`. Neutral has since moved unchanged to `source-art/strategy-officers.png`; the 2026-10-18 delivery and pixel verification is recorded below. Map and office paths are unchanged.

## Generation prompts

### map

Use case: stylized-concept. Asset type: original playable strategy-game map background, landscape 8:5. Create richly detailed 1990s PC-98 strategy simulation pixel art with visible carefully placed pixels, restrained dithering, crisp silhouettes, no blur. A fictional Novaria coastal industrial harbor viewed from elevated isometric angle. Composition anchors: central steel-coil processing factory centered at 50% width 40% height; warehouse and outdoor rolls-of-steel coil yard at 25% width 65% height; cargo harbor with freighter and gantry cranes at 78% width 75% height; automotive customer factories at 80% width 22% height; headquarters office at 25% width 25% height. Connect districts with plausible roads; lush coastal hills and distant urban context. Strong geographic readability at 640x400, intricate small industrial detail. Palette dark teal, navy shadows, sage roofs, warm beige concrete and muted gold sunlight. It must feel like an authentic sophisticated old Japanese PC strategy game world. No text, labels, letters, numbers, logos, buttons, markers, UI, frames or watermark. Original scenery, no copied existing game layout.

### office

Use case: stylized-concept. Asset type: original strategy simulation office scene background, landscape 8:5. Create sophisticated 1990s PC-98 game pixel art with crisp stepped edges and restrained deliberate dithering. Isometric cutaway manager office inside a steel coil processing company. Warm wood desk with period office telephone, paper plans with indistinct linework only, tidy folders, chairs, a side cabinet and wall technical drawing. Large windows overlook steel coils, processing sheds and harbor cranes at sunrise. Strong cohesive readable composition suitable as backdrop to a strategy-game council meeting. No people. Palette dark teal, navy shadows, sage, warm beige and muted gold sunlight. Authentic high-quality early Japanese PC strategy game environmental illustration, not photorealistic, not smooth 3D. No readable text, letters, numbers, logos, buttons, interface, frame or watermark.

### officers

Use case: stylized-concept. Asset type: original six-person portrait atlas for a classic strategy simulation. One image containing exactly THREE equal columns and TWO equal rows, six equal rectangular panels edge to edge, with no gutters, no borders. Each portrait is a waist/chest-up HUMAN character, head and shoulders fully visible with generous breathing room, centered in its own panel, all the same scale. Distinct original fictional characters in mature 1990s PC strategy-game painted pixel-art style, restrained dithering, crisp pixel edges, expressive faces, no photorealism, no chibi. Top row left to right: 1 energetic Korean male sales manager in his 40s, navy jacket and loosened tie, confident smile; 2 quiet polite Korean young male assistant in his 30s with glasses and light shirt, thoughtful expression; 3 gruff older Korean male factory chief in his 50s, industrial safety helmet and grey work jacket, weathered face. Bottom row left to right: 4 cynical Korean male finance manager in his 50s, neat glasses, charcoal suit, dry measured expression; 5 exacting Korean female quality engineer in her 40s, white work jacket holding a clipboard, attentive gaze; 6 warm bright local female manager in her 30s, olive jacket, approachable confident expression. Unified flat dark teal background in every panel. Palette navy, sage, beige, muted gold, natural skin colors. Original characters; no text, labels, names, letters, numbers, frames, logos or watermark.

## Original generated files

These are the original local generation filenames. The repository preserves the neutral officer PNG at `source-art/strategy-officers.png`; the final map and office deliveries are listed above.

- Map: `exec-50d27376-c603-48c2-9f45-780313e58cac.png`
- Office: `exec-2fbe0971-c49a-4c10-a88f-9412901fbbe4.png`
- Officers: `exec-0929af83-66a8-46ae-9b4e-d51856ab15e9.png`

## Staff expressions — 2026-10-18 (T9)

Built-in `image_gen.imagegen` edited the viewed original officer atlas twice, using `identity-preserve` prompts: concerned and positive. No external images, paid API, tint substitution, palette quantization or resampling were used. The requested edits were eyebrows, eyes and mouth; identity, apparent age, hair, clothing, pose, hands, props, cell placement and teal background were retained by visual comparison. Generative edits are not claimed to preserve every background pixel. Neutral means the unchanged baseline artwork, which already includes smiles on Jung and Lin.

The exact prompts are in `.omo/evidence/ulw/commercial-20261018-01a139fb/G003-trust-v1-checkpoint/a1/task-9/generation-prompts.json` (local evidence; not included in the repository). Sources are `exec-52238584-cbab-4d3a-9914-040a78ed907b.png` (concerned) and `exec-afc4d287-acb7-496e-840b-c720fe5f9244.png` (positive). Source SHA-256 values respectively: `d41cb7223c10edb9c35ef9d02f8cc6af3e74d517e53d2f931cfa686edeadd210`, `f68092d9e8d415965794ca9a62d3b1b124a652fd472e04f78df0ffaa2af0a10e`.

All three delivery atlases are 1536×1024, 3 columns × 2 rows of 512×512 cells, encoded with `cwebp -lossless -z 9 INPUT -o OUTPUT`. `.omo/evidence/ulw/commercial-20261018-01a139fb/G003-trust-v1-checkpoint/a1/task-9/pixel-proof.json` (local evidence; not included in the repository) verifies decoded RGBA equality against each PNG, and the exact original neutral PNG bytes against the 2026-10-14 generation source. Moving that PNG to `source-art/` preserves the original without shipping both encodings; current build only ships `art/`.

| Delivered asset | Bytes | SHA-256 |
|---|---:|---|
| `art/strategy-officers.webp` | 1,588,854 | `94e34492059c124e201389d53a7ad27d2b189c055a064acfb4ea4eb73195258e` |
| `art/strategy-officers-concerned.webp` | 1,491,592 | `1877b380c6cd08938168fbdde2ae724fa61f2b1c4d37bde2e3a0ac5977835bab` |
| `art/strategy-officers-positive.webp` | 1,507,602 | `acd0b6c6aebb3aed9def79ed4af8893c183b2b263bba8eba71eca1989a8e1268` |

Preserved source: `source-art/strategy-officers.png`, SHA-256 `2848705ba69d47ed3477e5c60248bf9600d43956876dbb7c622250fc23ca6d56`. [staff-expressions.json](../art/staff-expressions.json) provides all 18 identity/state/file/cell mappings and the fallback order: requested state → neutral → readable name and role. It has no economic state or RNG logic. The current game displays the neutral WebP through the existing portrait CSS; T16 owns runtime expression selection and runtime failure handling. T9's failure handling is explicitly exercised in a labelled gallery fixture, alongside a separate actual game on port 4204.

The `.omo/evidence/ulw/commercial-20261018-01a139fb/G003-trust-v1-checkpoint/a1/task-9/visual-review.md` (local evidence; not included in the repository) links the rendered 18-image contact sheet, full-size comparison, forced HTTP 404 fallbacks, live game command checks, exact shell/art budget and cleanup. The AVIF lossless probe was larger than WebP and was rejected; only WebP is delivered. Provenance verification does not independently certify commercial rights.
