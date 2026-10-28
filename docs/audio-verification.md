# 오디오 검증 기록

2026-10-28. 현재 24개 창작 WAV와 오프닝·엔딩 transport를 기술 검사와 격리 실제 브라우저에서 확인했다. 아래 결과는 사람 청취와 물리 기기 검증을 구분한다.

## 기술 검사

- `npm run audio:verify`: 24개 WAV, 22,050Hz·16-bit·stereo, 74,420,068B(70.97251MiB)로 80MiB 이하. 파일/소스 해시, 길이, loop, peak/RMS, stereo 차이와 mix 상한을 검사한다.
- `ending-journey`: 정확히 2,646,000 frames/120초/10,584,044B. `ending-unfinished`: 1,323,000 frames/60초/5,292,044B. 둘 다 cinematic, gain .22, loop null이다.
- 격리 복사본에서 전체 렌더 두 번의 24개 file/PCM 해시가 같고, 기존 22개 해시가 보존됐다. sourceHash 순서는 [오디오 제작 기록](audio-production.md)에 고정했다.
- `node --test tests/ending-player.test.mjs tests/audio-cinematic.test.mjs`: 120/60초 경계, pause/resume, offset, 5초 timeout·404·늦은 promise, 무음/오디오 객체 부재와 자원 정리를 검사한다.
- `node --test tests/ending-integration.test.mjs tests/audio-ui.test.mjs tests/audio-integration.test.mjs`: 마지막 결산 뒤 단일 cinematic, 종료 징글 중복 방지, 결과 BGM 복귀, 같은 세션 replay와 저장·경제·RNG 불변을 검사한다.

## 실제 브라우저 — 2026-10-28

사용자 서버·탭·dist가 아닌 격리 source, 고유 port와 소유 Chrome profile에서 B01–B12를 실행했다. 최종 제품 커밋 `2fc196f`의 `src/ui/ending-player.js` SHA-256과 QA 복사본이 일치했고, 정상 120초와 조기 60초 실제 시간 재생, pause/next/skip/replay, hidden/visible, 404·지연·무음, suspended AudioContext 활성화, 오프라인 선택 캐시, resume/import/recovery를 확인했다.

실제 B07에서 AudioContext가 suspended인 동안 「계속 보기」가 보이지 않는 결함을 발견해 수정했다. fresh page에서 position/voice 정지와 버튼 노출을 확인하고 native 클릭 뒤 context `running`, voice 1을 관측했다. B05 초점 누출도 수정 후 키보드·전체화면 시나리오를 재실행했다.

최종 격리 검증은 `npm test` 1248/1248, `npm run audio:verify`, 33-source production build를 통과했다. release version은 `c6fbb27336fa`, 생성 `release.json` SHA-256은 `74192eb6ab5ed9e1e3b9a752b891f8e82c9b422fa75ba40e784d247b8c364968`다. 이는 공개 배포 완료를 뜻하지 않는다.

## 오프라인 정책

앱 shell은 필수 캐시하지만 manifest·WAV·엔딩 그림은 요청 성공 때만 선택적으로 캐시한다. 미캐시 음원은 오프라인에서 503으로 실패하고 엔딩은 무음 transport로 계속된다. 실패 응답은 캐시하지 않는다. 온라인 복귀 뒤 요청한 해당 곡·그림만 캐시된다. 음원 전체 다운로드를 설치 선행조건으로 두지 않는다.

## 검증 상태

| 항목 | 상태 |
|---|---|
| WAV 구조·해시·길이·신호·80MiB 예산 | PASS |
| 소유 Chrome의 120/60초 transport·활성화·숨김·오프라인 | PASS |
| 데스크톱/모바일 배치·키보드·초점·fallback | PASS |
| 물리 iOS/Safari의 입력·중단·실제 출력 | **UNVERIFIED** |
| 헤드폰·작은 스피커에서 사람의 전곡 청취 | **UNVERIFIED** |

headless 브라우저의 AudioContext/voice 상태와 fullscreen API 성공은 실제 스피커 청취나 물리 화면 전환 증거가 아니다. 청취 기록에는 날짜·기기·볼륨·음원 해시, 루프 연결, 대사 읽기 방해와 연타 피로를 별도로 남겨야 한다.
