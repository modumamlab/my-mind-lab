# 모두의 마음연구소 V2 로컬 실행

## 유지할 기존 파일
- `.env`
- `.git`
- `node_modules`

## 실행
```powershell
# 실행 중인 기존 서버가 있으면 각 터미널에서 Ctrl+C
npx netlify dev
```

## 접속 주소
- 사용자: http://localhost:8888/
- 관리자: http://localhost:8888/admin/

Vite 내부 포트는 5190으로 고정되어 있으며 직접 접속할 필요가 없습니다.

## 5190 포트가 이미 사용 중일 때
```powershell
netstat -ano | findstr :5190
taskkill /PID 표시된번호 /F
npx netlify dev
```

## 관리자 접속이 안 될 때
터미널 마지막 부분에 다음 문구가 있어야 합니다.
```text
Server now ready on http://localhost:8888
```
