# 명운당 사주 (命運堂)

만세력 기반 사주팔자 풀이에 **MBTI·혈액형·별자리**를 겹쳐 보는 운세 웹앱입니다. 친구처럼 반말로 뼈 때리는 **팩폭 모드**도 있어요.

**바로 써보기 → https://steve5781-a11y.github.io/myeongun-saju/**

## 주요 기능
- **나의 사주팔자**: 사주 원국(네 기둥·십신·지장간), 오행 비율과 용신, 성향·강점·주의점, 신살, 대운 타임라인과 운세 곡선, 오행 궁합, 생활 처방
- **사중 분석**: 사주 × MBTI × 혈액형 × 별자리 통합 캐릭터, 별자리 캐릭터와 오행 시너지, 사주로 본 MBTI 싱크로율, 연애·일·돈·스트레스 상황별 분석, 궁합
- **오늘의 운세**: 일진 기반 총운과 분야별 점수, 시간대별 길흉, 올해의 흐름
- **입력 화면**: MBTI 축마다 두 성향 설명을 펼쳐 보며 고르기, 생일로 자동 선택되는 별자리 캐릭터 연출
- **팩폭 모드**: 결과 화면 상단 토글로 친구 말투 버전으로 전환
- 출생지 경도에 따른 진태양시 보정, 한국 서머타임 자동 보정, 양력/음력(윤달) 입력 지원

입력한 생년월일은 브라우저 안에서만 계산·저장되며 서버로 전송되지 않습니다.

## 로컬에서 실행
`saju-app/index.html`을 브라우저로 열면 됩니다. 빌드가 필요 없습니다.

## 구조
```
saju-app/            웹앱 (GitHub Pages로 배포되는 폴더)
  index.html
  css/style.css
  js/saju.js         계산 엔진
  js/content.js      사주 해석 문구
  js/persona.js      MBTI·혈액형·팩폭 문구
  js/zodiac.js       별자리 12궁 캐릭터·별자리 모양·문구
  js/app.js          화면 렌더링
  lib/lunar.js       만세력 라이브러리 (lunar-javascript, MIT)
research/
  crawl_daum.py      서비스 조사용 Firecrawl 수집 스크립트 (.env에 FIRECRAWL_API_KEY 필요)
.github/workflows/pages.yml   main 브랜치에 push하면 자동 배포
```

## 배포
`main` 브랜치에 push하면 GitHub Actions가 `saju-app` 폴더를 GitHub Pages로 배포합니다.

## 참고
- 만세력 계산: [lunar-javascript](https://github.com/6tail/lunar-javascript) (MIT License)
- 해석은 명리학의 전통 개념을 바탕으로 한 참고용 콘텐츠이며, MBTI·혈액형 분석은 재미를 위한 것입니다.
