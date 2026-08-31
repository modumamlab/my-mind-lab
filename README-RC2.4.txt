RC2.4 홈페이지 Supabase Auth
- 홈페이지 로그인/회원가입을 모바일 앱 이동 없이 홈페이지 내부에서 처리
- 모바일 앱과 동일 Supabase 프로젝트 계정 공유
- 로그인: 이메일 + 비밀번호
- 회원가입: 이름 + 연락처 + 이메일 + 비밀번호
- 기존 Google Sheet/localStorage 전용 인증 제거
- Netlify Function home-auth.js에서 Supabase Auth 호출
필요 환경변수(기존 값 사용 가능):
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
또는 SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY
