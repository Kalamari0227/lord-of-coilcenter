# 오디오 제작과 재현

2026-10-28 현재 로컬 창작 자산은 BGM 6개, 징글 3개, 효과음 12개, 72초 오프닝 1개, 엔딩 cinematic 2개로 총 24개 WAV다. Node 내장 모듈만 사용하며 네트워크·샘플 다운로드·유료 API·게임 RNG 호출은 없다.

## 재현 명령

프로젝트 디렉터리에서 Node 22 이상으로 실행한다.

```sh
node scripts/render-audio.mjs --only title,office
node scripts/render-audio.mjs
node scripts/verify-audio.mjs
```

`--only`는 알려진 중복 없는 ID만 받고 manifest를 해당 목록으로 교체하므로 전체 배포 전에는 전체 렌더가 필요하다. 렌더러는 `music/score.mjs`, `music/opening.mjs`, `music/ending.mjs`, `music/synth.mjs`, `music/wav.mjs`를 사용한다.

## 자산과 해시 계약

`audio/manifest.json`은 version 1, PCM signed 16-bit little-endian, 22,050Hz, stereo다. 항목은 id/title/kind/file/sourceHash/fileHash/sampleRate/frames/duration/loopStartFrame/loopEndFrame/gain을 가진다.

sourceHash는 다음 파일 바이트를 **이 순서로** 연결한 SHA-256이다.

1. `music/opening.mjs`
2. `music/score.mjs`
3. `music/synth.mjs`
4. `music/wav.mjs`
5. `scripts/render-audio.mjs`
6. `music/ending.mjs`

timestamp는 포함하지 않는다. fileHash는 완성 WAV 전체 바이트의 해시다. 같은 소스와 Node 환경에서 두 번 렌더한 24개 파일의 바이트가 일치했고, 기존 22개 WAV의 file/PCM 해시도 보존됐다. 플랫폼별 삼각함수 구현까지 동일함을 보장하지는 않는다.

## 전용 엔딩 편곡

| ID · 제목 | 계약 | 구성 |
|---|---|---|
| `ending-journey` · 당신이 남긴 항로 | cinematic, 120초, 2,646,000 frames, gain .22, loop 없음 | 0–24초 피아노·오보에 회고, 24–40초 작은 현악 확장, 40–88초 여섯 인사 아래 얇은 편성, 88–104초 오프닝 motif 귀환, 104–116초 종지, 116–120초 잔향 |
| `ending-unfinished` · 다하지 못한 항로 | cinematic, 60초, 1,323,000 frames, gain .22, loop 없음 | 0–16초 낮은 목관·현악, 16–40초 인사 아래 여백, 40–52초 오프닝 motif의 짧은 응답, 52–60초 열린 화음·잔향 |

둘 다 80BPM이며 자체 오프닝 motif와 기존 「남겨진 항로」 선율을 변주한다. 타사 OST나 샘플을 사용하지 않는다. 조기 종료곡에는 공포·벌을 주는 효과음을 넣지 않는다.

## 루프와 믹싱 예산

frame은 채널별 샘플 위치다. BGM은 도입 16박 뒤부터 exclusive loop end까지 반복하고, 원샷·cinematic은 loop 값이 null이다. BGM 루프 경계는 마지막 128 frame의 짧은 선형 연결, 원샷은 마지막 256 frame 감쇠를 사용한다. 이 수치 검사는 자연스러운 프레이징의 청감 판정과 별개다.

각 파일 peak는 0.65(-3.74dBFS) 이하, BGM/cinematic·징글 gain은 .22, SFX는 .10이다. 음악 2개+징글 1개+SFX 4개의 최악 합산 상한은 약 .689다. 전체 24개 WAV는 74,420,068B(70.97251MiB)로 80MiB 제한 안이며, 제한을 자동으로 늘리지 않는다.

사람의 헤드폰·스피커 청취는 **UNVERIFIED**다. WAV 헤더·ffprobe·길이·peak/RMS·스테레오 차이·해시·루프·재렌더 검사는 청감상 선율, 피로, 대사 방해, 음색을 대신하지 않는다. 물리 iOS/Safari 출력도 별도 검증 대상이다.
