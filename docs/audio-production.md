# 오디오 제작과 재현

2026-10-21. 승인된 로컬 제작 범위: 원곡 BGM 6개, 징글 3개, 효과음 12개, 72초 오프닝 1개(총 22개). Node 내장 모듈만 사용한다. 네트워크·샘플 다운로드·유료 API·게임 RNG 호출은 없다.

## 재현 명령

프로젝트 디렉터리에서 Node 22 이상으로 실행한다.

```sh
node scripts/render-audio.mjs --only title,office
node scripts/render-audio.mjs
node scripts/verify-audio.mjs
```

마지막 명령은 별도 통합 검증기의 명령이다. 렌더러는 `music/score.mjs` 악보와 `music/opening.mjs` 오프닝 악보, `music/synth.mjs` 음색/합성, `music/wav.mjs` PCM 파일 인코더를 사용한다. `--only`는 알려진 중복 없는 ID만 받고 manifest를 정확히 선택한 목록으로 교체한다. 기존 다른 WAV는 지우지 않지만 manifest에 포함하지 않는다. 전체 배포 전에는 전체 렌더가 필요하다.

## 자산 계약

`audio/manifest.json`: version 1, format pcm-s16le, sampleRate 22050, channels 2, bitsPerSample 16. 각 항목은 id/title/kind/file/sourceHash/fileHash/sampleRate/frames/duration/loopStartFrame/loopEndFrame/gain을 가진다. file은 `audio/<id>.wav`; 해시는 소문자 SHA-256. sourceHash는 `music/opening.mjs` → `music/score.mjs` → `music/synth.mjs` → `music/wav.mjs` → `scripts/render-audio.mjs`의 파일 바이트를 고정 순서로 연결한 값이며 timestamp를 포함하지 않는다. fileHash는 완성 WAV 전체 바이트의 해시다. 같은 소스와 Node 환경에서 같은 바이트를 재현한다. 플랫폼별 삼각함수 구현 차이까지 동일함을 보장하지는 않는다.

frame은 채널별 샘플 위치다. BGM의 도입 16박 뒤부터 루프 끝까지 반복하고 끝은 exclusive다. 음표 release와 반사음이 파일 끝을 넘으면 루프 시작에 합산한다. 반올림한 frame 경계의 미세 불연속은 마지막 128 frame(5.8ms)의 짧은 선형 연결로 제거한다. 이는 신호 연속성 조치이며 청감상 자연스러운 프레이징 판정과는 별개다. 원샷은 루프 값이 null이며 마지막 256 frame을 감쇠한다.

## 믹싱 예산

각 파일 peak를 0.65 (-3.74dBFS)로 맞춘다. BGM 및 cinematic gain .22, 징글 .22, SFX .10이다. 전환 중 음악(BGM/cinematic) 2개 + 징글 1개 + SFX 4개의 모든 최대 샘플이 동시에 일치해도 `0.65 × (2 × .22 + .22 + 4 × .10) = .689`다. 슬라이더/버스 gain이 0..1일 때 duck 없이도 clipping 한계보다 낮다. 이 상한은 런타임의 동시 재생 제한이 지켜지는 경우에만 유효하다.

## 청취 상태

기술 검사는 WAV 헤더, ffprobe, 길이, peak/RMS, 스테레오 차이, 해시, 루프 경계, 60MiB 한도 및 재렌더 바이트 일치를 직접 검사한다. 이는 사람의 실제 청취가 아니다. 헤드폰·작은 스피커에서 6곡 도입+2회 루프, 징글 3개, 효과음 12개를 듣고 피로도·역할 구별·음색·선율·대사 읽기 방해·루프 프레이징을 평가하는 작업은 UNVERIFIED다. 게임의 음향 설정 미리듣기 또는 `audio/*.wav`를 재생해 평가할 수 있다.

증거 경로: `.omo/evidence/ulw/01a139fb-6b3b-7d70-bf59-5b2b37945553/G001-fm/a1/composer/`. `prototype-stats.json`, `full-stats.json`, `determinism.json`, `report.md`에 실제 결과를 기록한다.

## 오프닝 자산과 이번 검증

`audio/opening.wav`는 `id: opening`, `title: 철의 항로`, `kind: cinematic`이며 정확히 1,587,600 frame / 72초, 6,350,444바이트다. loopStartFrame과 loopEndFrame은 null, gain은 .22이며 검증기는 cinematic의 .22 초과 gain과 다른 길이를 거절한다. BGM 루프 범위 검사는 그대로 유지한다. 작은 반사음은 BGM과 cinematic에 적용하되 cinematic의 파일 끝에서는 루프 시작으로 합산하지 않는다.

검증기 믹스 상한은 `2 × max(BGM peak×gain, cinematic peak×gain) + jingle + 4×SFX`다. 60MiB 제한과 -3dBFS peak 제한은 유지한다. 기존 21개 WAV의 파일 전체 및 PCM SHA-256은 오프닝 추가 전후 동일함을 확인했다. 모든 22개를 두 번 전체 렌더하여 완성 WAV 해시가 동일함을 확인했다.

이번 증거: `.omo/evidence/ulw/opening-20261021-01a139fb/G001-72-production-gonsama-ethan/a1/score/report.md`. 원곡의 감성·음색·타이틀 연결 청취 평가는 이 자동 검사 결과로 대체하지 않는다.
