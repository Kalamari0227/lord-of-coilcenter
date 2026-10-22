# 스튜디오 로고 필기체 시안

2026-10-21. 사용자가 요청한 필기체·붓 흘림체 방향으로 만든 세 가지 비교용 시안이다. 각 이미지에 Production Gonsama와 Ethan.J Studio 두 이름이 함께 들어간다. 사용자가 C안을 선택했다.

- A (`a-brush.png`): 굵고 힘 있는 마른 붓글씨. 가장 강한 인상과 두꺼운 획.
- B (`b-pen.png`): 차분한 펜 서명체. 얇고 길게 연결된 필기체.
- C (`c-flow.png`): 유려한 붓 흘림체. 붓결과 흐르는 획을 함께 살린 안. 고전 전략 게임 오프닝 기준 추천.

내장 image_gen 도구로 각각 새로 생성했다. 원본 PNG를 변경 없이 이 폴더에 복사했다. 정확한 생성 프롬프트는 `prompts.json`에 보존한다. 별도 유료 API/CLI, 외부 폰트, 기존 제작사 로고는 사용하지 않았다.

## 선택된 C안의 게임 적용

C 원본을 바이트 변경 없이 `art/opening/studio-calligraphy.png`에 복사했다. 런타임에서 위·아래 두 영역을 각각 표시하여 승인된 획과 글자를 그대로 보존한다. 이미지 자체의 축소·팔레트 변환·다시 그리기는 하지 않았다. 이 파일은 원래 남색 배경이 있는 불투명 PNG이며, 투명 이미지라고 주장하지 않는다.

별도 투명 이미지 추출도 내장 도구로 시도했으나 획 주변 잡티와 원본에 없는 음영이 생겨 채택하지 않았다. 해당 출력과 프롬프트는 `rejected-extraction/`에 기록으로 보관하며 배포하지 않는다.

생성 원본 파일명과 저장소 보관 경로:

- A: `exec-55014c58-da72-4d69-bbcf-b1ae9d6d16a5.png` → `source-art/opening/calligraphy-20261021/a-brush.png`
- B: `exec-ba63cde3-94c4-434b-a2ff-af8161127428.png` → `source-art/opening/calligraphy-20261021/b-pen.png`
- C: `exec-b7713550-3a44-44ab-9c77-7e27c8458160.png` → `source-art/opening/calligraphy-20261021/c-flow.png`
