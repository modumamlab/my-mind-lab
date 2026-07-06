# 모두의 마음연구소 AI 마음 체크인 v4

## 적용 파일

- `netlify/functions/gemini-intake.js`
- `ai/clinicalReasoning.js`
- `ai/conversationDirector.js`
- `ai/expressionMemory.js`
- `ai/questionPlanner.js`

## 핵심 변화

- Gemini에게 바로 답변을 맡기지 않음
- 상담 상태를 먼저 정리
- Conversation Director가 이번 응답 모드 결정
- 최근 표현 반복 방지
- 질문 없는 응답 허용
- 고장난 로봇처럼 반복되는 구조 완화

## 테스트 문장

1. 교수 목소리만 들어도 숨이 막혀
2. 6개월 정도 된 것 같아
3. 위축돼
4. 심리상담 받아본 적 있어
