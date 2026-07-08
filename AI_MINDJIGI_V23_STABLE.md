# AI 마음지기 v23 Stable

## 목적
현재 배포 중인 홈페이지 구조는 유지하고, AI 마음지기 대화 문제만 우선 수정한 버전입니다.

## 수정 핵심
- Netlify Function `gemini-intake.js`를 v23 안정 버전으로 교체
- Gemini 2.5 Flash 실패 시 1.5 Flash로 자동 재시도
- 반복 확인 질문과 고정 공감문을 프롬프트에서 금지
- 자동 고정 질문(buildSilenceFollowUp) 비활성화
- Gemini 실패 시 로컬 상담문장 대신 연결 안내만 표시
- `postProcess`에서 반복 문구와 금지 문구 제거

## 배포 방법
1. 이 ZIP을 기존 GitHub 프로젝트에 전체 덮어쓰기
2. GitHub Commit / Push
3. Netlify 자동 배포 확인
4. 배포 주소에서 AI 마음지기 테스트

## 테스트 문장
- 피곤해
- 하루하루 피곤해
- 회사 때문인 것 같아
- 상사만 보면 숨이 막혀
- 집에 와도 쉬는 느낌이 없어

같은 질문을 반복하지 않고 앞선 말을 이어가면 정상입니다.
