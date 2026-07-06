# AI 마음체크인 v9 업데이트 보고서

## 반영 내용
- 이용 기준을 질문 수가 아니라 시간 기준으로 전환
- 10분 이후 정리 가능, 12분 이후 마무리, 최대 15분 종료 구조
- 욕설/혐오 표현 1차·2차·3차 경고 로직
- 자살/자해 위험 표현 감지 시 안전 안내 우선
- 반복 표현 방지 강화
- “말씀해 주신 내용을 보니”, “중요한 단서”, “흐름이라면” 반복 제거
- `js/app.js`의 고정 답변틀을 Netlify 함수 호출 방식으로 교체

## 배포 전 확인
- `netlify/functions/gemini-intake.js`
- `ai/safetyGuard.js`
- `ai/sessionTime.js`
- `ai/intakeSummary.js`
- `ai/testRecommendation.js`
